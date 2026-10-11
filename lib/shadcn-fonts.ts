import type { CustomFont } from "./fonts"

// The create page's own fonts, in picker order. Mirrors FONTS in
// apps/v4/app/(app)/(create)/lib/fonts.ts and lib/font-definitions.ts.
// Picking one of these goes through the site's own picker, so Get Code and
// shared links keep working.
export type ShadcnFont = {
  name: string
  title: string
  type: "sans" | "mono" | "serif"
  family: string
  previewVariable: string
}

export const SHADCN_FONTS: readonly ShadcnFont[] = [
  { name: "geist", title: "Geist", type: "sans", family: "'Geist Variable', sans-serif", previewVariable: "--font-geist-sans" },
  { name: "inter", title: "Inter", type: "sans", family: "'Inter Variable', sans-serif", previewVariable: "--font-inter" },
  { name: "noto-sans", title: "Noto Sans", type: "sans", family: "'Noto Sans Variable', sans-serif", previewVariable: "--font-noto-sans" },
  { name: "nunito-sans", title: "Nunito Sans", type: "sans", family: "'Nunito Sans Variable', sans-serif", previewVariable: "--font-nunito-sans" },
  { name: "figtree", title: "Figtree", type: "sans", family: "'Figtree Variable', sans-serif", previewVariable: "--font-figtree" },
  { name: "roboto", title: "Roboto", type: "sans", family: "'Roboto Variable', sans-serif", previewVariable: "--font-roboto" },
  { name: "raleway", title: "Raleway", type: "sans", family: "'Raleway Variable', sans-serif", previewVariable: "--font-raleway" },
  { name: "dm-sans", title: "DM Sans", type: "sans", family: "'DM Sans Variable', sans-serif", previewVariable: "--font-dm-sans" },
  { name: "public-sans", title: "Public Sans", type: "sans", family: "'Public Sans Variable', sans-serif", previewVariable: "--font-public-sans" },
  { name: "outfit", title: "Outfit", type: "sans", family: "'Outfit Variable', sans-serif", previewVariable: "--font-outfit" },
  { name: "oxanium", title: "Oxanium", type: "sans", family: "'Oxanium Variable', sans-serif", previewVariable: "--font-oxanium" },
  { name: "manrope", title: "Manrope", type: "sans", family: "'Manrope Variable', sans-serif", previewVariable: "--font-manrope" },
  { name: "space-grotesk", title: "Space Grotesk", type: "sans", family: "'Space Grotesk Variable', sans-serif", previewVariable: "--font-space-grotesk" },
  { name: "montserrat", title: "Montserrat", type: "sans", family: "'Montserrat Variable', sans-serif", previewVariable: "--font-montserrat" },
  { name: "ibm-plex-sans", title: "IBM Plex Sans", type: "sans", family: "'IBM Plex Sans Variable', sans-serif", previewVariable: "--font-ibm-plex-sans" },
  { name: "source-sans-3", title: "Source Sans 3", type: "sans", family: "'Source Sans 3 Variable', sans-serif", previewVariable: "--font-source-sans-3" },
  { name: "instrument-sans", title: "Instrument Sans", type: "sans", family: "'Instrument Sans Variable', sans-serif", previewVariable: "--font-instrument-sans" },
  { name: "geist-mono", title: "Geist Mono", type: "mono", family: "'Geist Mono Variable', monospace", previewVariable: "--font-geist-mono" },
  { name: "jetbrains-mono", title: "JetBrains Mono", type: "mono", family: "'JetBrains Mono Variable', monospace", previewVariable: "--font-jetbrains-mono" },
  { name: "noto-serif", title: "Noto Serif", type: "serif", family: "'Noto Serif Variable', serif", previewVariable: "--font-noto-serif" },
  { name: "roboto-slab", title: "Roboto Slab", type: "serif", family: "'Roboto Slab Variable', serif", previewVariable: "--font-roboto-slab" },
  { name: "merriweather", title: "Merriweather", type: "serif", family: "'Merriweather Variable', serif", previewVariable: "--font-merriweather" },
  { name: "lora", title: "Lora", type: "serif", family: "'Lora Variable', serif", previewVariable: "--font-lora" },
  { name: "playfair-display", title: "Playfair Display", type: "serif", family: "'Playfair Display Variable', serif", previewVariable: "--font-playfair-display" },
  { name: "eb-garamond", title: "EB Garamond", type: "serif", family: "'EB Garamond Variable', serif", previewVariable: "--font-eb-garamond" },
  { name: "instrument-serif", title: "Instrument Serif", type: "serif", family: "'Instrument Serif', serif", previewVariable: "--font-instrument-serif" },
]

const FALLBACK = { sans: "sans-serif", mono: "monospace", serif: "serif" } as const

export function findShadcnFont(title: string | undefined) {
  return title ? SHADCN_FONTS.find((font) => font.title === title) : undefined
}

// A preview-only font: the site already loads these families (next/font
// variables), so no files are needed, just the same stack the site uses.
export function toPreviewFont(font: ShadcnFont): CustomFont {
  return {
    id: `shadcn:${font.name}`,
    name: font.title,
    family: font.title,
    category: font.type,
    fallback: FALLBACK[font.type],
    source: "shadcn",
    dependency: `@fontsource-variable/${font.name}`,
    files: [],
    stack: `var(${font.previewVariable}), ${font.family}`,
  }
}
