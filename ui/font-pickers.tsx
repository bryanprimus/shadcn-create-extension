import * as React from "react"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { BUNDLED_FONTS, getFontStack, type CustomFont } from "@/lib/fonts"
import {
  fontsourceId,
  loadCatalog,
  searchCatalog,
  type FontsourceEntry,
} from "@/lib/fontsource"
import { findShadcnFont, SHADCN_FONTS, toPreviewFont } from "@/lib/shadcn-fonts"
import type { FontOverrides, FontSlot } from "@/lib/state"

export type FontOption =
  | { kind: "inherit"; key: "inherit"; label: string }
  | { kind: "shadcn"; key: string; label: string }
  | { kind: "font"; key: string; label: string; font: CustomFont }
  | { kind: "fontsource"; key: string; label: string; entry: FontsourceEntry }

type FontGroup = { value: string; label?: string; items: FontOption[] }

export type PickerState = {
  // Names shown by the site's own (hidden) pickers.
  native: { font?: string; fontHeading?: string; headingInherits: boolean }
  committed: FontOverrides
  recent: CustomFont[]
}

export type PickerController = {
  subscribe: (listener: () => void) => () => void
  getState: () => PickerState
  select: (slot: FontSlot, option: FontOption) => void
  preview: (slot: FontSlot, option: FontOption | null) => void
  portalContainer: HTMLElement
  // Called right before a popup opens.
  beforeOpen: () => void
}

const SEARCH_LIMIT = 30

// Same order as the site's picker, plus the categories only Fontsource has.
const CATEGORIES = [
  { value: "sans", label: "Sans", match: ["sans", "sans-serif"] },
  { value: "mono", label: "Mono", match: ["mono", "monospace"] },
  { value: "serif", label: "Serif", match: ["serif"] },
  { value: "display", label: "Display", match: ["display", "other"] },
  { value: "handwriting", label: "Handwriting", match: ["handwriting"] },
] as const

const categoryOf = (category: string) =>
  CATEGORIES.find((item) => (item.match as readonly string[]).includes(category))
    ?.value ?? "display"

const normalize = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, "")

function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches
  )
}

// The site's useIsMobile(): below 768px.
const useIsMobile = () => useMediaQuery("(max-width: 767px)")

type CatalogState = { entries: FontsourceEntry[]; status: "idle" | "loading" | "ready" | "error" }

function useCatalog(enabled: boolean): CatalogState {
  const [state, setState] = React.useState<CatalogState>({ entries: [], status: "idle" })
  React.useEffect(() => {
    if (!enabled || state.status === "loading" || state.status === "ready") {
      return
    }
    let cancelled = false
    setState((current) => ({ ...current, status: "loading" }))
    loadCatalog().then(
      (entries) => !cancelled && setState({ entries, status: "ready" }),
      () => !cancelled && setState({ entries: [], status: "error" })
    )
    return () => {
      cancelled = true
    }
    // Retry after an error the next time the picker opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
  return state
}

function effectiveFontName(slot: FontSlot, state: PickerState) {
  const { committed, native } = state
  if (slot === "font") {
    return committed.font?.name ?? native.font
  }
  return (
    committed.fontHeading?.name ??
    (native.headingInherits ? (committed.font?.name ?? native.font) : native.fontHeading)
  )
}

function effectiveFontStack(slot: FontSlot, state: PickerState) {
  const custom =
    slot === "font"
      ? state.committed.font
      : (state.committed.fontHeading ??
        (state.native.headingInherits ? state.committed.font : undefined))
  if (custom) {
    return getFontStack(custom)
  }
  const shadcn = findShadcnFont(effectiveFontName(slot, state))
  return shadcn ? getFontStack(toPreviewFont(shadcn)) : undefined
}

function selectedKey(slot: FontSlot, state: PickerState) {
  const custom = state.committed[slot]
  if (custom) {
    return custom.id
  }
  if (slot === "fontHeading" && state.native.headingInherits) {
    return "inherit"
  }
  const name = slot === "font" ? state.native.font : state.native.fontHeading
  const shadcn = findShadcnFont(name)
  return shadcn ? `shadcn:${shadcn.name}` : undefined
}

function buildGroups(
  slot: FontSlot,
  state: PickerState,
  query: string,
  catalog: FontsourceEntry[]
): FontGroup[] {
  const needle = query.trim().toLowerCase()
  const matches = (label: string) => !needle || label.toLowerCase().includes(needle)
  const byCategory = new Map<string, FontOption[]>()
  const add = (category: string, option: FontOption) => {
    const items = byCategory.get(category) ?? []
    items.push(option)
    byCategory.set(category, items)
  }

  const known = new Set<string>()
  for (const font of SHADCN_FONTS) {
    known.add(normalize(font.title))
    if (matches(font.title)) {
      add(font.type, { kind: "shadcn", key: `shadcn:${font.name}`, label: font.title })
    }
  }
  const extras = [...BUNDLED_FONTS, ...state.recent].filter((font) => {
    const key = normalize(font.name)
    if (known.has(key)) {
      return false
    }
    known.add(key)
    return true
  })
  for (const font of extras) {
    if (matches(font.name)) {
      add(categoryOf(font.category), { kind: "font", key: font.id, label: font.name, font })
    }
  }
  if (needle) {
    for (const entry of searchCatalog(catalog, needle, SEARCH_LIMIT + known.size)) {
      if (known.has(normalize(entry.family))) {
        continue
      }
      known.add(normalize(entry.family))
      add(categoryOf(entry.category), {
        kind: "fontsource",
        key: fontsourceId(entry.id),
        label: entry.family,
        entry,
      })
    }
  }

  const groups: FontGroup[] = []
  if (slot === "fontHeading") {
    // Like the site: the first entry follows the body font.
    const bodyName = state.committed.font?.name ?? state.native.font ?? "Body font"
    if (matches(bodyName)) {
      groups.push({
        value: "inherit",
        items: [{ kind: "inherit", key: "inherit", label: bodyName }],
      })
    }
  }
  for (const category of CATEGORIES) {
    const items = byCategory.get(category.value)
    if (items?.length) {
      groups.push({ value: category.value, label: category.label, items })
    }
  }
  return groups
}

function FontPicker({
  controller,
  slot,
  label,
}: {
  controller: PickerController
  slot: FontSlot
  label: string
}) {
  const state = React.useSyncExternalStore(controller.subscribe, controller.getState)
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const catalog = useCatalog(open)

  const groups = React.useMemo(
    () => buildGroups(slot, state, query, catalog.entries),
    [slot, state, query, catalog.entries]
  )

  const key = selectedKey(slot, state)
  const value = React.useMemo<FontOption | null>(() => {
    for (const group of buildGroups(slot, state, "", [])) {
      const match = group.items.find((item) => item.key === key)
      if (match) {
        return match
      }
    }
    const custom = state.committed[slot]
    return custom ? { kind: "font", key: custom.id, label: custom.name, font: custom } : null
  }, [slot, state, key])

  const searching = query.trim() !== "" && catalog.status === "loading"

  return (
    <div className="group/picker relative" data-sce-picker={slot}>
      <Combobox
        items={groups}
        filter={null}
        value={value}
        onValueChange={(option) => {
          if (option) {
            controller.select(slot, option)
          }
        }}
        inputValue={query}
        onInputValueChange={setQuery}
        open={open}
        onOpenChange={(next) => {
          if (next) {
            controller.beforeOpen()
          }
          setOpen(next)
          if (!next) {
            setQuery("")
            controller.preview(slot, null)
          }
        }}
        onItemHighlighted={(option) => {
          if (!isMobile) {
            controller.preview(slot, option ?? null)
          }
        }}
        itemToStringLabel={(option: FontOption) => option.label}
        isItemEqualToValue={(a: FontOption, b: FontOption) => a.key === b.key}
      >
        {/* Same markup and classes as the site's own picker trigger. */}
        <ComboboxTrigger
          className="relative w-36 shrink-0 touch-manipulation rounded-xl p-3 ring-1 ring-foreground/10 select-none hover:bg-muted focus-visible:ring-foreground/50 focus-visible:outline-none disabled:opacity-50 data-popup-open:bg-muted md:w-full md:rounded-lg md:px-2.5 md:py-2 [&>svg:last-child]:hidden"
        >
          <div className="flex flex-col justify-start text-left">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="line-clamp-1 max-w-[80%] truncate text-sm font-medium text-foreground">
              {effectiveFontName(slot, state)}
            </div>
          </div>
          <div
            className="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-base text-foreground select-none md:right-2.5"
            style={{ fontFamily: effectiveFontStack(slot, state) }}
          >
            Aa
          </div>
        </ComboboxTrigger>
        <ComboboxContent
          container={controller.portalContainer}
          side={isMobile ? "top" : "right"}
          align={isMobile ? "center" : "start"}
          sideOffset={20}
          className="w-52 max-h-96"
        >
          <ComboboxInput showTrigger={false} placeholder="Search fonts…" />
          <ComboboxEmpty>{searching ? "Searching…" : "No fonts found."}</ComboboxEmpty>
          <ComboboxList className="max-h-[min(calc(var(--spacing)*86),calc(var(--available-height)-var(--spacing)*9))]">
            {(group: FontGroup) => (
              <ComboboxGroup key={group.value} items={group.items}>
                {group.label ? <ComboboxLabel>{group.label}</ComboboxLabel> : null}
                <ComboboxCollection>
                  {(option: FontOption) => (
                    <ComboboxItem key={option.key} value={option}>
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
                {group.value === "inherit" ? <ComboboxSeparator /> : null}
              </ComboboxGroup>
            )}
          </ComboboxList>
          {query.trim() && catalog.status === "error" ? (
            <div className="px-2 pb-2 text-xs text-muted-foreground">
              Couldn't load more fonts.
            </div>
          ) : null}
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

export function FontPickers({ controller }: { controller: PickerController }) {
  return (
    <>
      <FontPicker controller={controller} slot="fontHeading" label="Heading" />
      <FontPicker controller={controller} slot="font" label="Font" />
    </>
  )
}
