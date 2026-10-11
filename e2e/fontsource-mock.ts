import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { BrowserContext } from "@playwright/test"

// Offline stand-in for api.fontsource.org and the jsDelivr font CDN, shaped
// like the documented responses (fontsource.org/docs/api).
const FONT_BYTES = readFileSync(
  resolve(
    import.meta.dirname,
    "../node_modules/@fontsource-variable/gabarito/files/gabarito-latin-wght-normal.woff2"
  )
)

const CATALOG = [
  {
    id: "inter",
    family: "Inter",
    subsets: ["latin"],
    weights: [400, 700],
    styles: ["normal"],
    defSubset: "latin",
    variable: true,
    category: "sans-serif",
    type: "google",
  },
  {
    id: "bricolage-grotesque",
    family: "Bricolage Grotesque",
    subsets: ["latin", "latin-ext"],
    weights: [200, 300, 400, 500, 600, 700, 800],
    styles: ["normal"],
    defSubset: "latin",
    variable: true,
    category: "sans-serif",
    type: "google",
  },
  {
    id: "abel",
    family: "Abel",
    subsets: ["latin"],
    weights: [400],
    styles: ["normal"],
    defSubset: "latin",
    variable: false,
    category: "sans-serif",
    type: "google",
  },
  {
    id: "roboto-slab",
    family: "Roboto Slab",
    subsets: ["latin"],
    weights: [400, 700],
    styles: ["normal"],
    defSubset: "latin",
    variable: false,
    category: "serif",
    type: "google",
  },
]

const RANGE = "U+0000-00FF"

function detail(entry: (typeof CATALOG)[number]) {
  const variants: Record<string, unknown> = {}
  for (const weight of entry.weights) {
    variants[weight] = {
      normal: Object.fromEntries(
        entry.subsets.map((subset) => [
          subset,
          {
            url: {
              woff2: `https://cdn.jsdelivr.net/fontsource/fonts/${entry.id}@latest/${subset}-${weight}-normal.woff2`,
            },
          },
        ])
      ),
    }
  }
  return {
    ...entry,
    unicodeRange: Object.fromEntries(entry.subsets.map((s) => [s, RANGE])),
    variants,
  }
}

export async function mockFontsource(
  context: BrowserContext,
  options: { failCatalog?: boolean } = {}
) {
  const requests: string[] = []
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  })

  await context.route("https://api.fontsource.org/**", (route) => {
    const url = new URL(route.request().url())
    requests.push(url.href)
    const [, , kind, id] = url.pathname.split("/")
    if (kind === "fonts" && !id) {
      return route.fulfill(
        options.failCatalog ? json({ error: "down" }, 503) : json(CATALOG)
      )
    }
    const entry = CATALOG.find((font) => font.id === id)
    if (!entry) {
      return route.fulfill(json({ error: "not found" }, 404))
    }
    if (kind === "fonts") {
      return route.fulfill(json(detail(entry)))
    }
    return route.fulfill(
      json({
        family: entry.family,
        axes: { wght: { default: "400", min: "200", max: "800", step: "1" } },
      })
    )
  })

  await context.route("https://cdn.jsdelivr.net/**", (route) => {
    requests.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: "font/woff2",
      headers: { "access-control-allow-origin": "*" },
      body: FONT_BYTES,
    })
  })

  return requests
}
