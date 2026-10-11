// Mirrors apps/v4/app/(app)/(create)/lib/fonts.ts with a few entries.
const definitions = [
  ["geist", "Geist", "sans", "'Geist Variable', sans-serif"],
  ["inter", "Inter", "sans", "'Inter Variable', sans-serif"],
  ["figtree", "Figtree", "sans", "'Figtree Variable', sans-serif"],
  ["jetbrains-mono", "JetBrains Mono", "mono", "'JetBrains Mono Variable', monospace"],
  ["lora", "Lora", "serif", "'Lora Variable', serif"],
] as const

export const FONTS = definitions.map(([value, name, type, family]) => ({
  name,
  value,
  type,
  font: { style: { fontFamily: `var(--font-${value}), ${family}` } },
}))

export const FONT_HEADING_OPTIONS = [
  { name: "Inherit", value: "inherit", type: "default", font: null },
  ...FONTS,
]

export type Params = { font: string; fontHeading: string }
