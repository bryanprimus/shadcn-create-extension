// A font the extension can apply. Bundled fonts ship inside the extension;
// Fontsource fonts are resolved at runtime (lib/fontsource.ts). Both share
// this serialisable shape so a choice can be stored and sent to the preview
// iframe as is.

export type FontFile = {
  // Absolute URL, or a path inside the extension when `bundled` is set.
  src: string
  bundled?: boolean
  weight: string
  style: string
  unicodeRange?: string
}

export type CustomFont = {
  id: string
  name: string
  family: string
  category: string
  fallback: string
  source: "bundled" | "fontsource"
  // npm package a project would install to ship this font.
  dependency: string
  files: FontFile[]
}

type BundledFile = FontFile & { package: string; packagePath: string }

const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
const LATIN_EXT_RANGE =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

function fontsourceVariable(
  slug: string,
  options: { weight: string; subsets: Record<string, string> }
): BundledFile[] {
  return Object.entries(options.subsets).map(([subset, unicodeRange]) => ({
    src: `fonts/${slug}-${subset}-wght-normal.woff2`,
    bundled: true,
    package: `@fontsource-variable/${slug}`,
    packagePath: `files/${slug}-${subset}-wght-normal.woff2`,
    weight: options.weight,
    style: "normal",
    unicodeRange,
  }))
}

export const BUNDLED_FONTS: readonly (CustomFont & { files: BundledFile[] })[] = [
  {
    id: "gabarito",
    name: "Gabarito",
    // Same naming convention shadcn uses for its own variable fonts.
    family: "Gabarito Variable",
    category: "sans-serif",
    fallback: "sans-serif",
    source: "bundled",
    dependency: "@fontsource-variable/gabarito",
    files: fontsourceVariable("gabarito", {
      weight: "400 900",
      subsets: { latin: LATIN_RANGE, "latin-ext": LATIN_EXT_RANGE },
    }),
  },
]

export function getFontStack(font: CustomFont) {
  return `'${font.family.replaceAll("'", "\\'")}', ${font.fallback}`
}

// Generic family for a Fontsource category.
export function fallbackFor(category: string) {
  switch (category) {
    case "serif":
      return "serif"
    case "monospace":
      return "monospace"
    case "handwriting":
      return "cursive"
    default:
      return "sans-serif"
  }
}

export function isCustomFont(value: unknown): value is CustomFont {
  const font = value as CustomFont
  return (
    !!font &&
    typeof font === "object" &&
    typeof font.id === "string" &&
    typeof font.family === "string" &&
    Array.isArray(font.files)
  )
}
