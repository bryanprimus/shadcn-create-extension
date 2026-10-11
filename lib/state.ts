export type FontSlot = "font" | "fontHeading"

// Custom font id per picker. A missing slot means the site's own value wins.
export type FontOverrides = Partial<Record<FontSlot, string>>

export type ApplyFontsMessage = {
  source: "shadcn-create-extension"
  type: "apply-fonts"
  overrides: FontOverrides
}

// sessionStorage is shared by the create page and its same origin preview
// iframe, survives reloads, and stays scoped to the tab.
const STORAGE_KEY = "shadcn-create-extension:font-overrides"

export function readOverrides(): FontOverrides {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}")
    return value && typeof value === "object" ? value : {}
  } catch {
    return {}
  }
}

export function writeOverrides(overrides: FontOverrides) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // Storage can be unavailable (blocked site data). The session still works
    // in memory, it just will not survive a reload.
  }
}

export function isApplyFontsMessage(data: unknown): data is ApplyFontsMessage {
  return (
    !!data &&
    typeof data === "object" &&
    (data as ApplyFontsMessage).source === "shadcn-create-extension" &&
    (data as ApplyFontsMessage).type === "apply-fonts"
  )
}
