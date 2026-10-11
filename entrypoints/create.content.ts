import { loadFont } from "@/lib/font-loader"
import {
  CUSTOM_FONTS,
  getCustomFont,
  getFontStack,
  type CustomFont,
} from "@/lib/fonts"
import {
  readOverrides,
  writeOverrides,
  type ApplyFontsMessage,
  type FontOverrides,
  type FontSlot,
} from "@/lib/state"

// Selectors come from the site's picker (Base UI Menu) in
// apps/v4/app/(app)/(create)/components/picker.tsx.
const TRIGGER = '[data-slot="dropdown-menu-trigger"]'
const POPUP = '[data-slot="dropdown-menu-content"]'
const GROUP = '[data-slot="dropdown-menu-group"]'
const LABEL = '[data-slot="dropdown-menu-label"]'
const RADIO_GROUP = '[data-slot="dropdown-menu-radio-group"]'
const RADIO_ITEM = '[data-slot="dropdown-menu-radio-item"]'
const RADIO_INDICATOR = '[data-slot="dropdown-menu-radio-item-indicator"]'

const SLOT_LABELS: Record<string, FontSlot> = {
  Heading: "fontHeading",
  Font: "font",
}

const ATTR = {
  hidden: "data-sce-hidden",
  value: "data-sce-value",
  aa: "data-sce-font",
  group: "data-sce-group",
  item: "data-sce-item",
  customActive: "data-sce-custom-active",
} as const

const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 pointer-coarse:size-5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

const CSS = [
  `[${ATTR.hidden}] { display: none !important; }`,
  // The site still thinks its own font is selected; hide that checkmark
  // while a custom font owns the slot.
  `[${ATTR.customActive}] ${RADIO_ITEM}:not([${ATTR.item}]) ${RADIO_INDICATOR} > * { display: none !important; }`,
  ...CUSTOM_FONTS.map(
    (font) =>
      `[${ATTR.aa}="${font.id}"] { font-family: ${getFontStack(font)} !important; }`
  ),
].join("\n")

// Matches the site's useIsMobile(): below 768px menu items close the menu on
// click and hovering does not preview.
const isMobile = () => window.innerWidth < 768

type Trigger = {
  slot: FontSlot
  element: HTMLElement
  label: HTMLElement
  value: HTMLElement
  aa: HTMLElement | null
}

export default defineContentScript({
  matches: ["https://ui.shadcn.com/*"],
  runAt: "document_idle",
  main(ctx) {
    let committed: FontOverrides = readOverrides()
    // Hover state while a font menu is open. null means "show committed".
    let preview: FontOverrides | null = null

    const style = document.createElement("style")
    style.textContent = CSS
    document.head.append(style)

    // The create page is reached through client side navigation too, so the
    // script runs site wide and only acts while the pickers are on screen.
    const findTriggers = () => {
      const triggers = new Map<FontSlot, Trigger>()
      for (const element of document.querySelectorAll<HTMLElement>(TRIGGER)) {
        const label = element.querySelector<HTMLElement>(".text-xs")
        const slot = SLOT_LABELS[label?.textContent?.trim() ?? ""]
        const value = label?.nextElementSibling
        if (!slot || !label || !(value instanceof HTMLElement)) {
          continue
        }
        const aa =
          Array.from(element.children).find(
            (child): child is HTMLElement =>
              child instanceof HTMLElement && child.textContent?.trim() === "Aa"
          ) ?? null
        triggers.set(slot, { slot, element, label, value, aa })
      }
      return triggers
    }

    // The site stores "heading = body font" as inherit and then shows the
    // body font's name on the Heading trigger, so equal names mean inherit.
    const headingInheritsBody = (triggers: Map<FontSlot, Trigger>) => {
      const heading = triggers.get("fontHeading")?.value.textContent?.trim()
      const body = triggers.get("font")?.value.textContent?.trim()
      return !!heading && heading === body
    }

    const effectiveFont = (
      slot: FontSlot,
      overrides: FontOverrides,
      triggers: Map<FontSlot, Trigger>
    ): CustomFont | undefined => {
      if (slot === "font") {
        return getCustomFont(overrides.font)
      }
      return (
        getCustomFont(overrides.fontHeading) ??
        (headingInheritsBody(triggers) ? getCustomFont(overrides.font) : undefined)
      )
    }

    const decorateTrigger = (trigger: Trigger, font: CustomFont | undefined) => {
      const { value, aa } = trigger
      let replacement = value.parentElement?.querySelector<HTMLElement>(
        `[${ATTR.value}]`
      )

      if (!font) {
        value.removeAttribute(ATTR.hidden)
        replacement?.remove()
        aa?.removeAttribute(ATTR.aa)
        return
      }

      void loadFont(font)
      // Never edit the site's text nodes: React owns them. Hide its value and
      // render ours next to it instead.
      if (!replacement) {
        replacement = document.createElement("div")
        replacement.setAttribute(ATTR.value, "")
        value.after(replacement)
      }
      replacement.className = value.className
      if (replacement.textContent !== font.name) {
        replacement.textContent = font.name
      }
      value.setAttribute(ATTR.hidden, "")
      aa?.setAttribute(ATTR.aa, font.id)
    }

    const sendToPreview = () => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Preview"]'
      )
      const message: ApplyFontsMessage = {
        source: "shadcn-create-extension",
        type: "apply-fonts",
        overrides: preview ?? committed,
      }
      iframe?.contentWindow?.postMessage(message, location.origin)
    }

    const setPreview = (next: FontOverrides | null) => {
      if (JSON.stringify(next) === JSON.stringify(preview)) {
        return
      }
      preview = next
      sendToPreview()
    }

    const commit = (slot: FontSlot, fontId: string | undefined) => {
      const next = { ...committed }
      if (fontId) {
        next[slot] = fontId
      } else {
        delete next[slot]
      }
      if (JSON.stringify(next) === JSON.stringify(committed)) {
        return
      }
      committed = next
      writeOverrides(committed)
      sendToPreview()
      scheduleSync()
    }

    const closeMenu = (popup: HTMLElement) => {
      popup.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true,
        })
      )
    }

    const buildItem = (
      font: CustomFont,
      slot: FontSlot,
      popup: HTMLElement,
      template: HTMLElement | null
    ) => {
      const item = document.createElement("div")
      item.setAttribute(ATTR.item, font.id)
      item.setAttribute("role", "menuitemradio")
      item.tabIndex = -1
      item.className = template?.className ?? ""
      item.dataset.slot = "dropdown-menu-radio-item"

      const indicator = document.createElement("span")
      indicator.className =
        template?.querySelector(RADIO_INDICATOR)?.className ??
        "pointer-events-none absolute right-2 flex items-center justify-center"
      indicator.dataset.slot = "dropdown-menu-radio-item-indicator"
      item.append(indicator, font.name)

      const hover = () => {
        if (document.activeElement !== item) {
          item.focus({ preventScroll: true })
        }
        if (!isMobile()) {
          setPreview({ ...committed, [slot]: font.id })
        }
      }
      const select = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        commit(slot, font.id)
        if (isMobile()) {
          closeMenu(popup)
        }
      }
      item.addEventListener("mousemove", hover)
      item.addEventListener("focus", hover)
      item.addEventListener("click", select)
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          select(event)
        }
      })
      return item
    }

    const enhancePopup = (popup: HTMLElement, slot: FontSlot) => {
      const radioGroup = popup.querySelector<HTMLElement>(RADIO_GROUP)
      if (!radioGroup) {
        return
      }

      let group = radioGroup.querySelector<HTMLElement>(`[${ATTR.group}]`)
      if (!group) {
        // Insert before the first labelled group (Sans) so custom fonts sit
        // right under the Heading picker's "inherit" entry.
        const firstLabelledGroup = Array.from(
          radioGroup.querySelectorAll<HTMLElement>(GROUP)
        ).find((element) => element.querySelector(LABEL))
        const templateLabel = firstLabelledGroup?.querySelector(LABEL)
        const templateItem = radioGroup.querySelector<HTMLElement>(
          `${RADIO_ITEM}:not([${ATTR.item}])`
        )

        group = document.createElement("div")
        group.setAttribute(ATTR.group, "")
        group.setAttribute("role", "group")
        group.dataset.slot = "dropdown-menu-group"

        const label = document.createElement("div")
        label.className =
          templateLabel?.className ??
          "px-2 py-1.5 text-xs font-medium text-neutral-400"
        label.dataset.slot = "dropdown-menu-label"
        label.textContent = "Custom"
        group.append(label)

        for (const font of CUSTOM_FONTS) {
          group.append(buildItem(font, slot, popup, templateItem))
          void loadFont(font)
        }

        radioGroup.insertBefore(group, firstLabelledGroup ?? null)

        // Picking one of the site's fonts hands the slot back to the site.
        popup.addEventListener(
          "click",
          (event) => {
            const target = event.target as Element | null
            const native = target?.closest(RADIO_ITEM)
            if (native && !native.hasAttribute(ATTR.item)) {
              commit(slot, undefined)
            }
          },
          true
        )
        // While hovering a site font, drop our override for this slot so the
        // site's own hover preview is visible.
        const previewNative = (event: Event) => {
          const target = event.target as Element | null
          const native = target?.closest(RADIO_ITEM)
          if (native && !native.hasAttribute(ATTR.item) && !isMobile()) {
            const next = { ...committed }
            delete next[slot]
            setPreview(next)
          }
        }
        popup.addEventListener("mousemove", previewNative)
        popup.addEventListener("focusin", previewNative)
        popup.addEventListener("mouseleave", () => setPreview(null))
      }

      const selected = committed[slot]
      popup.toggleAttribute(ATTR.customActive, !!selected)
      for (const item of group.querySelectorAll<HTMLElement>(`[${ATTR.item}]`)) {
        const checked = item.getAttribute(ATTR.item) === selected
        item.setAttribute("aria-checked", String(checked))
        item.toggleAttribute("data-checked", checked)
        const indicator = item.querySelector(RADIO_INDICATOR)
        if (indicator && checked !== !!indicator.firstChild) {
          indicator.innerHTML = checked ? CHECK_ICON : ""
        }
      }
    }

    const sync = () => {
      const triggers = findTriggers()
      if (triggers.size === 0) {
        return
      }

      for (const trigger of triggers.values()) {
        decorateTrigger(trigger, effectiveFont(trigger.slot, committed, triggers))
      }

      const open = Array.from(triggers.values()).find((trigger) =>
        trigger.element.hasAttribute("data-popup-open")
      )
      const popup = document.querySelector<HTMLElement>(
        `${POPUP}:not([data-closed])`
      )
      if (open && popup) {
        enhancePopup(popup, open.slot)
      } else if (preview) {
        setPreview(null)
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
      attributes: true,
      attributeFilter: ["data-popup-open", "data-closed"],
    })
    ctx.onInvalidated(() => {
      observer.disconnect()
      style.remove()
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
