import { BUNDLED_FONTS, isCustomFont, type CustomFont } from "./fonts"

export type FontSlot = "font" | "fontHeading"

// Custom font per picker. A missing slot means the site's own value wins.
export type FontOverrides = Partial<Record<FontSlot, CustomFont>>

export type ApplyFontsMessage = {
  source: "shadcn-create-extension"
  type: "apply-fonts"
  overrides: FontOverrides
}

// sessionStorage is shared by the create page and its same origin preview
// iframe, survives reloads, and stays scoped to the tab.
const OVERRIDES_KEY = "shadcn-create-extension:font-overrides"
// Fonts picked from search, kept across sessions in the site's localStorage.
const RECENT_KEY = "shadcn-create-extension:recent-fonts"
const MAX_RECENT = 6

function readJson(storage: Storage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null")
  } catch {
    return null
  }
}

function writeJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (blocked site data). Things still work in
    // memory, they just will not survive a reload.
  }
}

function toFont(value: unknown) {
  if (isCustomFont(value)) {
    return value
  }
  // Releases up to 0.1.x stored bundled font ids as plain strings.
  return typeof value === "string"
    ? BUNDLED_FONTS.find((font) => font.id === value)
    : undefined
}

export function readOverrides(): FontOverrides {
  const value = readJson(sessionStorage, OVERRIDES_KEY) as Record<string, unknown> | null
  const overrides: FontOverrides = {}
  for (const slot of ["font", "fontHeading"] as const) {
    const font = toFont(value?.[slot])
    if (font) {
      overrides[slot] = font
    }
  }
  return overrides
}

export function writeOverrides(overrides: FontOverrides) {
  writeJson(sessionStorage, OVERRIDES_KEY, overrides)
}

export function readRecentFonts(): CustomFont[] {
  const value = readJson(localStorage, RECENT_KEY)
  return Array.isArray(value) ? value.filter(isCustomFont) : []
}

export function addRecentFont(font: CustomFont) {
  if (font.source !== "fontsource") {
    return
  }
  const recent = [font, ...readRecentFonts().filter((item) => item.id !== font.id)]
  writeJson(localStorage, RECENT_KEY, recent.slice(0, MAX_RECENT))
}

export function isApplyFontsMessage(data: unknown): data is ApplyFontsMessage {
  return (
    !!data &&
    typeof data === "object" &&
    (data as ApplyFontsMessage).source === "shadcn-create-extension" &&
    (data as ApplyFontsMessage).type === "apply-fonts"
  )
}
