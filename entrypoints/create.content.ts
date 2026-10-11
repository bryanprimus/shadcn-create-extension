import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

import { loadFont } from "@/lib/font-loader"
import type { CustomFont } from "@/lib/fonts"
import { resolveFont } from "@/lib/fontsource"
import { findShadcnFont, toPreviewFont } from "@/lib/shadcn-fonts"
import {
  addRecentFont,
  readOverrides,
  readRecentFonts,
  writeOverrides,
  type ApplyFontsMessage,
  type FontOverrides,
  type FontSlot,
} from "@/lib/state"
import {
  FontPickers,
  type FontOption,
  type PickerController,
  type PickerState,
} from "@/ui/font-pickers"
import styles from "@/ui/styles.css?inline"

// Selectors come from the site's picker (Base UI Menu) in
// apps/v4/app/(app)/(create)/components/picker.tsx.
const TRIGGER = '[data-slot="dropdown-menu-trigger"]'
const POPUP = '[data-slot="dropdown-menu-content"]'
const RADIO_ITEM = '[data-slot="dropdown-menu-radio-item"]'

const SLOT_LABELS: Record<string, FontSlot> = {
  Heading: "fontHeading",
  Font: "font",
}

const HOST_TAG = "shadcn-create-extension-fonts"
const HIDDEN = "data-sce-hidden"
const DRIVING = "data-sce-driving"

const PAGE_CSS = `
[${HIDDEN}] { display: none !important; }
/* While the extension operates the site's hidden picker, keep its menu
   (and the click shield the site renders next to it) out of sight. */
html[${DRIVING}] body > :has(${POPUP}) {
  visibility: hidden !important;
  pointer-events: none !important;
}
`

type NativeTrigger = {
  slot: FontSlot
  element: HTMLElement
  wrapper: HTMLElement
  value: HTMLElement
}

const isMobile = () => window.innerWidth < 768

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

async function waitFor<T>(find: () => T | null | undefined, timeout = 1500) {
  const start = performance.now()
  while (performance.now() - start < timeout) {
    const found = find()
    if (found) {
      return found
    }
    await nextFrame()
  }
  return null
}

export default defineContentScript({
  matches: ["https://ui.shadcn.com/*"],
  runAt: "document_idle",
  main(ctx) {
    let state: PickerState = {
      native: { headingInherits: true },
      committed: readOverrides(),
      recent: readRecentFonts(),
    }
    // Hover state while a picker is open. null means "show committed".
    let preview: FontOverrides | null = null
    // Last highlighted option per slot, so slow lookups do not preview stale
    // items.
    const highlighted = new Map<FontSlot, string | null>()

    const listeners = new Set<() => void>()
    const setState = (next: Partial<PickerState>) => {
      state = { ...state, ...next }
      listeners.forEach((listener) => listener())
    }

    const pageStyle = document.createElement("style")
    pageStyle.textContent = PAGE_CSS
    document.head.append(pageStyle)

    // The create page is reached through client side navigation too, so the
    // script runs site wide and only acts while the pickers are on screen.
    const findTriggers = () => {
      const triggers = new Map<FontSlot, NativeTrigger>()
      for (const element of document.querySelectorAll<HTMLElement>(TRIGGER)) {
        const label = element.querySelector<HTMLElement>(".text-xs")
        const slot = SLOT_LABELS[label?.textContent?.trim() ?? ""]
        const value = label?.nextElementSibling
        const wrapper = element.parentElement
        if (!slot || !(value instanceof HTMLElement) || !wrapper) {
          continue
        }
        triggers.set(slot, { slot, element, wrapper, value })
      }
      return triggers
    }

    const sendToPreview = () => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Preview"]'
      )
      const message: ApplyFontsMessage = {
        source: "shadcn-create-extension",
        type: "apply-fonts",
        overrides: preview ?? state.committed,
      }
      iframe?.contentWindow?.postMessage(message, location.origin)
    }

    const setPreview = (next: FontOverrides | null) => {
      const same =
        !next === !preview &&
        next?.font?.id === preview?.font?.id &&
        next?.fontHeading?.id === preview?.fontHeading?.id
      if (!same) {
        preview = next
        sendToPreview()
      }
    }

    const commit = (slot: FontSlot, font: CustomFont | undefined) => {
      const committed = { ...state.committed }
      if (font) {
        committed[slot] = font
        addRecentFont(font)
      } else {
        delete committed[slot]
      }
      writeOverrides(committed)
      setState({ committed, recent: readRecentFonts() })
      preview = null
      sendToPreview()
    }

    // Picks a value in the site's own (hidden) picker, so the site's state,
    // preset code, Get Code and history all stay in charge of built-in fonts.
    const selectNative = async (slot: FontSlot, title: string | "inherit") => {
      const trigger = findTriggers().get(slot)
      if (!trigger) {
        return
      }
      const root = document.documentElement
      root.setAttribute(DRIVING, "")
      try {
        trigger.element.click()
        const popup = await waitFor(() =>
          document.querySelector<HTMLElement>(`${POPUP}:not([data-closed])`)
        )
        if (!popup) {
          return
        }
        const items = Array.from(popup.querySelectorAll<HTMLElement>(RADIO_ITEM))
        const item =
          title === "inherit"
            ? items[0]
            : items.find((element) => element.textContent?.trim() === title)
        item?.click()
        popup.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
        )
        await waitFor(() => !document.querySelector(`${POPUP}:not([data-closed])`))
      } finally {
        root.removeAttribute(DRIVING)
      }
    }

    const toFont = (option: FontOption): Promise<CustomFont | undefined> => {
      switch (option.kind) {
        case "font":
          return Promise.resolve(option.font)
        case "fontsource":
          return resolveFont(option.entry)
        case "shadcn": {
          const font = findShadcnFont(option.label)
          return Promise.resolve(font && toPreviewFont(font))
        }
        case "inherit": {
          if (state.committed.font) {
            return Promise.resolve(state.committed.font)
          }
          const font = findShadcnFont(state.native.font)
          return Promise.resolve(font && toPreviewFont(font))
        }
      }
    }

    const controller: PickerController = {
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      getState: () => state,
      select(slot, option) {
        highlighted.set(slot, null)
        if (option.kind === "shadcn" || option.kind === "inherit") {
          commit(slot, undefined)
          void selectNative(slot, option.kind === "inherit" ? "inherit" : option.label)
          return
        }
        void toFont(option).then(
          (font) => font && commit(slot, font),
          (error) => console.error("[shadcn-create-extension] Could not load font", error)
        )
      },
      preview(slot, option) {
        highlighted.set(slot, option?.key ?? null)
        if (!option || isMobile()) {
          setPreview(null)
          return
        }
        void toFont(option).then(
          (font) => {
            if (font && highlighted.get(slot) === option.key) {
              setPreview({ ...state.committed, [slot]: font })
            }
          },
          () => {}
        )
      },
      portalContainer: document.createElement("div"),
    }

    // Mount: a shadow root keeps the extension's Tailwind build away from the
    // site's styles while inheriting its theme tokens.
    const host = document.createElement(HOST_TAG)
    const shadow = host.attachShadow({ mode: "open" })
    const sheet = document.createElement("style")
    sheet.textContent = styles
    // The customizer is a .dark scope; repeat it inside so dark: variants match.
    const scope = document.createElement("div")
    scope.className = "dark"
    scope.style.display = "contents"
    const app = document.createElement("div")
    app.style.display = "contents"
    scope.append(app, controller.portalContainer)
    shadow.append(sheet, scope)
    // Keys typed in the pickers must not reach the site's shortcuts (R
    // shuffles, D toggles dark mode). Inside a shadow root the site would see
    // the host, not an input, as the target.
    for (const type of ["keydown", "keyup", "keypress"]) {
      shadow.addEventListener(type, (event) => event.stopPropagation())
    }
    let root: Root | undefined

    const sync = () => {
      const triggers = findTriggers()
      const heading = triggers.get("fontHeading")
      const body = triggers.get("font")
      if (!heading || !body) {
        return
      }

      for (const trigger of [heading, body]) {
        trigger.wrapper.setAttribute(HIDDEN, "")
      }
      if (host.nextElementSibling !== heading.wrapper) {
        heading.wrapper.before(host)
      }
      if (!root) {
        root = createRoot(app)
        root.render(createElement(FontPickers, { controller }))
      }

      const native = {
        font: body.value.textContent?.trim() || undefined,
        fontHeading: heading.value.textContent?.trim() || undefined,
        headingInherits:
          heading.value.textContent?.trim() === body.value.textContent?.trim(),
      }
      if (
        native.font !== state.native.font ||
        native.fontHeading !== state.native.fontHeading ||
        native.headingInherits !== state.native.headingInherits
      ) {
        setState({ native })
      }

      for (const font of [state.committed.font, state.committed.fontHeading]) {
        if (font) {
          void loadFont(font)
        }
      }
    }

    let frame = 0
    const scheduleSync = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          sync()
        })
      }
    }

    const observer = new MutationObserver(scheduleSync)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    ctx.onInvalidated(() => {
      observer.disconnect()
      root?.unmount()
      host.remove()
      pageStyle.remove()
      document.querySelectorAll(`[${HIDDEN}]`).forEach((element) => {
        element.removeAttribute(HIDDEN)
      })
    })

    // A new preview iframe (base or item change) reads the committed state
    // from sessionStorage itself; this covers iframes that loaded earlier.
    document.addEventListener(
      "load",
      (event) => {
        if (event.target instanceof HTMLIFrameElement) {
          sendToPreview()
        }
      },
      true
    )

    sync()
  },
})
