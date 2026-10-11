// Fonts this extension adds to the create page pickers.
//
// Every entry is self contained so a future remote provider (Google Fonts,
// Fontsource API) can produce the same shape at runtime.

export type FontCategory = "sans" | "serif" | "mono" | "display"

export type FontFile = {
  // Path inside the built extension, served as a web accessible resource.
  path: string
  // Where the build copies the file from.
  package: string
  packagePath: string
  weight: string
  style: string
  unicodeRange?: string
}

export type CustomFont = {
  id: string
  name: string
  family: string
  category: FontCategory
  fallback: string
  // npm package a project would install to ship this font.
  dependency: string
  files: readonly FontFile[]
}

const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
const LATIN_EXT_RANGE =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

function fontsourceVariable(
  slug: string,
  options: { weight: string; subsets: Record<string, string> }
): FontFile[] {
  return Object.entries(options.subsets).map(([subset, unicodeRange]) => ({
    path: `fonts/${slug}-${subset}-wght-normal.woff2`,
    package: `@fontsource-variable/${slug}`,
    packagePath: `files/${slug}-${subset}-wght-normal.woff2`,
    weight: options.weight,
    style: "normal",
    unicodeRange,
  }))
}

export const CUSTOM_FONTS: readonly CustomFont[] = [
  {
    id: "gabarito",
    name: "Gabarito",
    // Same naming convention shadcn uses for its own variable fonts.
    family: "Gabarito Variable",
    category: "sans",
    fallback: "sans-serif",
    dependency: "@fontsource-variable/gabarito",
    files: fontsourceVariable("gabarito", {
      weight: "400 900",
      subsets: { latin: LATIN_RANGE, "latin-ext": LATIN_EXT_RANGE },
    }),
  },
]

export function getCustomFont(id: string | undefined) {
  return id ? CUSTOM_FONTS.find((font) => font.id === id) : undefined
}

export function getFontStack(font: CustomFont) {
  return `'${font.family}', ${font.fallback}`
}
