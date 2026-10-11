import { loadFont } from "@/lib/font-loader"
import { BUNDLED_FONTS, getFontStack, type CustomFont } from "@/lib/fonts"
import {
  fontsourceId,
  loadCatalog,
  resolveFont,
  searchCatalog,
  type FontsourceEntry,
} from "@/lib/fontsource"
import {
  addRecentFont,
  readOverrides,
  readRecentFonts,
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
  search: "data-sce-search",
  results: "data-sce-results",
  status: "data-sce-status",
  item: "data-sce-item",
  customActive: "data-sce-custom-active",
} as const

const SEARCH_LIMIT = 8

const CHECK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 pointer-coarse:size-5" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

// Only classes the site already ships are reused (copied from its own
// elements at runtime); everything new is styled here.
const CSS = `
[${ATTR.hidden}] { display: none !important; }
/* The site still thinks its own font is selected; hide that checkmark while
   a custom font owns the slot. */
[${ATTR.customActive}] ${RADIO_ITEM}:not([${ATTR.item}]) ${RADIO_INDICATOR} > * { display: none !important; }
[${ATTR.aa}] { font-family: var(--sce-font) !important; }
[${ATTR.search}] {
  position: sticky;
  top: -6px;
  z-index: 1;
  margin: -6px -6px 4px;
  padding: 6px 6px 4px;
  background: rgb(10 10 10 / 0.9);
  backdrop-filter: blur(24px);
}
[${ATTR.search}] input {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  border-radius: 8px;
  padding: 6px 8px;
  background: rgb(255 255 255 / 0.08);
  color: rgb(245 245 245);
  font: inherit;
  font-size: 14px;
  outline: none;
}
[${ATTR.search}] input::placeholder { color: rgb(163 163 163); }
[${ATTR.search}] input:focus { box-shadow: 0 0 0 1px rgb(255 255 255 / 0.3); }
[${ATTR.status}] {
  padding: 6px 8px;
  font-size: 12px;
  color: rgb(163 163 163);
}
`

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

// What a menu item applies: a ready font, or a search hit resolved on demand.
type ItemSource =
  | { kind: "font"; font: CustomFont }
  | { kind: "fontsource"; entry: FontsourceEntry }

const itemId = (source: ItemSource) =>
  source.kind === "font" ? source.font.id : fontsourceId(source.entry.id)

const itemName = (source: ItemSource) =>
  source.kind === "font" ? source.font.name : source.entry.family

const sameFonts = (a: FontOverrides | null, b: FontOverrides | null) =>
  a?.font?.id === b?.font?.id &&
  a?.fontHeading?.id === b?.fontHeading?.id &&
  !a === !b

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

    const effectiveFont = (slot: FontSlot, triggers: Map<FontSlot, Trigger>) =>
      slot === "font"
        ? committed.font
        : (committed.fontHeading ??
          (headingInheritsBody(triggers) ? committed.font : undefined))

    const decorateTrigger = (trigger: Trigger, font: CustomFont | undefined) => {
      const { value, aa } = trigger
      let replacement = value.parentElement?.querySelector<HTMLElement>(
        `[${ATTR.value}]`
      )

      if (!font) {
        value.removeAttribute(ATTR.hidden)
        replacement?.remove()
        aa?.removeAttribute(ATTR.aa)
        aa?.style.removeProperty("--sce-font")
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
      if (aa) {
        aa.setAttribute(ATTR.aa, font.id)
        aa.style.setProperty("--sce-font", getFontStack(font))
      }
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
      if (sameFonts(next, preview)) {
        return
      }
      preview = next
      sendToPreview()
    }

    const commit = (slot: FontSlot, font: CustomFont | undefined) => {
      if (committed[slot]?.id === font?.id) {
        return
      }
      const next = { ...committed }
      if (font) {
        next[slot] = font
        addRecentFont(font)
      } else {
        delete next[slot]
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

    const toFont = (source: ItemSource) =>
      source.kind === "font"
        ? Promise.resolve(source.font)
        : resolveFont(source.entry)

    type PopupContext = {
      popup: HTMLElement
      slot: FontSlot
      template: HTMLElement | null
      labelClass: string
    }

    const buildItem = (context: PopupContext, source: ItemSource) => {
      const { popup, slot, template } = context
      const id = itemId(source)
      const item = document.createElement("div")
      item.setAttribute(ATTR.item, id)
      item.setAttribute("role", "menuitemradio")
      item.setAttribute("aria-checked", "false")
      item.tabIndex = -1
      item.className = template?.className ?? ""
      item.dataset.slot = "dropdown-menu-radio-item"

      const indicator = document.createElement("span")
      indicator.className =
        template?.querySelector(RADIO_INDICATOR)?.className ??
        "pointer-events-none absolute right-2 flex items-center justify-center"
      indicator.dataset.slot = "dropdown-menu-radio-item-indicator"
      item.append(indicator, itemName(source))

      const hover = () => {
        if (document.activeElement !== item) {
          item.focus({ preventScroll: true })
        }
        if (isMobile()) {
          return
        }
        void toFont(source).then(
          (font) => {
            // Only preview if the pointer is still on this item.
            if (document.activeElement === item) {
              setPreview({ ...committed, [slot]: font })
            }
          },
          () => item.setAttribute("aria-disabled", "true")
        )
      }

      const select = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        void toFont(source).then(
          (font) => {
            commit(slot, font)
            if (isMobile()) {
              closeMenu(popup)
            }
          },
          () => item.setAttribute("aria-disabled", "true")
        )
      }

      item.addEventListener("mousemove", hover)
      item.addEventListener("focus", hover)
      item.addEventListener("click", select)
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          select(event)
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          moveFocus(popup, item, event.key === "ArrowDown" ? 1 : -1, event)
        }
      })
      return item
    }

    // Our items are invisible to Base UI's list navigation, so arrows between
    // the search box and our items are handled here. Leaving our items hands
    // control back to the site's menu.
    const moveFocus = (
      popup: HTMLElement,
      from: HTMLElement,
      direction: 1 | -1,
      event: KeyboardEvent
    ) => {
      const stops = [
        ...popup.querySelectorAll<HTMLElement>(
          `[${ATTR.search}] input, [${ATTR.item}]`
        ),
      ]
      const next = stops[stops.indexOf(from) + direction]
      if (next) {
        event.preventDefault()
        event.stopPropagation()
        next.focus()
      }
    }

    const createLabel = (context: PopupContext, text: string) => {
      const label = document.createElement("div")
      label.className = context.labelClass
      label.dataset.slot = "dropdown-menu-label"
      label.textContent = text
      return label
    }

    const createStatus = (text: string) => {
      const status = document.createElement("div")
      status.setAttribute(ATTR.status, "")
      status.textContent = text
      return status
    }

    const renderCustomGroup = (context: PopupContext, group: HTMLElement) => {
      const fonts = [...BUNDLED_FONTS, ...readRecentFonts()]
      const signature = fonts.map((font) => font.id).join(",")
      if (group.dataset.signature === signature) {
        return
      }
      group.dataset.signature = signature
      group.replaceChildren(
        createLabel(context, "Custom"),
        ...fonts.map((font) => buildItem(context, { kind: "font", font }))
      )
    }

    const createSearch = (context: PopupContext) => {
      const container = document.createElement("div")
      container.setAttribute(ATTR.search, "")

      const input = document.createElement("input")
      input.type = "search"
      input.placeholder = "Search Fontsource…"
      input.setAttribute("aria-label", "Search Fontsource fonts")
      input.autocomplete = "off"
      input.spellcheck = false

      const results = document.createElement("div")
      results.setAttribute(ATTR.results, "")
      results.setAttribute("role", "group")
      results.dataset.slot = "dropdown-menu-group"

      let query = ""
      let timer = 0

      const render = async () => {
        const current = query
        if (!current.trim()) {
          results.replaceChildren()
          return
        }
        results.replaceChildren(createStatus("Searching…"))
        try {
          const entries = searchCatalog(await loadCatalog(), current, SEARCH_LIMIT)
          if (current !== query) {
            return
          }
          results.replaceChildren(
            ...(entries.length
              ? [
                  createLabel(context, "Fontsource"),
                  ...entries.map((entry) =>
                    buildItem(context, { kind: "fontsource", entry })
                  ),
                ]
              : [createStatus("No fonts found")])
          )
          updateChecks(context)
        } catch (error) {
          console.error("[shadcn-create-extension] Fontsource search failed", error)
          if (current === query) {
            results.replaceChildren(createStatus("Couldn't reach Fontsource"))
          }
        }
      }

      input.addEventListener("input", () => {
        query = input.value
        clearTimeout(timer)
        timer = window.setTimeout(render, 120)
      })
      // Keep typing away from the menu's typeahead and list navigation.
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          return
        }
        if (event.key === "ArrowDown") {
          moveFocus(context.popup, input, 1, event)
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
          results.querySelector<HTMLElement>(`[${ATTR.item}]`)?.click()
        }
        event.stopPropagation()
      })
      // Start the catalog download as soon as the box is used.
      input.addEventListener("focus", () => void loadCatalog().catch(() => {}), {
        once: true,
      })
      // Hovering the search box shows the committed fonts again.
      container.addEventListener("mousemove", () => setPreview(null))

      // Only the box is sticky; results scroll with the rest of the menu.
      container.append(input)
      return [container, results]
    }

    const updateChecks = (context: PopupContext) => {
      const selected = committed[context.slot]?.id
      context.popup.toggleAttribute(ATTR.customActive, !!selected)
      for (const item of context.popup.querySelectorAll<HTMLElement>(
        `[${ATTR.item}]`
      )) {
        const checked = item.getAttribute(ATTR.item) === selected
        item.setAttribute("aria-checked", String(checked))
        item.toggleAttribute("data-checked", checked)
        const indicator = item.querySelector(RADIO_INDICATOR)
        if (indicator && checked !== !!indicator.firstChild) {
          indicator.innerHTML = checked ? CHECK_ICON : ""
        }
      }
    }

    const contexts = new WeakMap<HTMLElement, PopupContext>()

    const enhancePopup = (popup: HTMLElement, slot: FontSlot) => {
      const radioGroup = popup.querySelector<HTMLElement>(RADIO_GROUP)
      if (!radioGroup) {
        return
      }

      let context = contexts.get(popup)
      if (!context || context.slot !== slot) {
        context = {
          popup,
          slot,
          template: radioGroup.querySelector<HTMLElement>(
            `${RADIO_ITEM}:not([${ATTR.item}])`
          ),
          labelClass:
            radioGroup.querySelector(LABEL)?.className ??
            "px-2 py-1.5 text-xs font-medium text-neutral-400",
        }
        contexts.set(popup, context)
      }

      if (!radioGroup.querySelector(`[${ATTR.search}]`)) {
        radioGroup.prepend(...createSearch(context))
      }

      let group = radioGroup.querySelector<HTMLElement>(`[${ATTR.group}]`)
      if (!group) {
        // Insert before the first labelled site group (Sans) so custom fonts
        // sit right under the Heading picker's "inherit" entry.
        const firstLabelledGroup = Array.from(
          radioGroup.querySelectorAll<HTMLElement>(
            `:scope > ${GROUP}:not([${ATTR.group}])`
          )
        ).find((element) => element.querySelector(LABEL))

        group = document.createElement("div")
        group.setAttribute(ATTR.group, "")
        group.setAttribute("role", "group")
        group.dataset.slot = "dropdown-menu-group"
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

      renderCustomGroup(context, group)
      updateChecks(context)
    }

    const sync = () => {
      const triggers = findTriggers()
      if (triggers.size === 0) {
        return
      }

      for (const trigger of triggers.values()) {
        decorateTrigger(trigger, effectiveFont(trigger.slot, triggers))
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
