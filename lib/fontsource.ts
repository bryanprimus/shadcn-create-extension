import { fallbackFor, type CustomFont, type FontFile } from "./fonts"

// https://fontsource.org/docs/api/introduction
const API = "https://api.fontsource.org/v1"
const CDN = "https://cdn.jsdelivr.net/fontsource/fonts"

export type FontsourceEntry = {
  id: string
  family: string
  subsets: string[]
  weights: number[]
  styles: string[]
  defSubset: string
  variable: boolean
  category: string
  type: string
}

type FontsourceDetail = FontsourceEntry & {
  unicodeRange: Record<string, string>
  variants: Record<
    string,
    Record<string, Record<string, { url: { woff2?: string } }>>
  >
}

type FontsourceAxes = {
  axes?: Record<string, { min: string | number; max: string | number }>
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }
  return response.json() as Promise<T>
}

let catalog: Promise<FontsourceEntry[]> | undefined

// The whole catalog (about 1,900 families) is one request; the browser's
// HTTP cache keeps repeat visits cheap.
export function loadCatalog() {
  if (!catalog) {
    catalog = getJson<FontsourceEntry[]>(`${API}/fonts`)
    catalog.catch(() => {
      catalog = undefined
    })
  }
  return catalog
}

export function searchCatalog(
  entries: readonly FontsourceEntry[],
  query: string,
  limit = 8
) {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return []
  }

  const scored: { entry: FontsourceEntry; score: number }[] = []
  for (const entry of entries) {
    const family = entry.family.toLowerCase()
    const index = family.indexOf(needle)
    if (index === -1) {
      continue
    }
    // Exact, then prefix, then word start, then anywhere.
    const score =
      family === needle
        ? 0
        : index === 0
          ? 1
          : family[index - 1] === " "
            ? 2
            : 3
    scored.push({ entry, score })
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.entry.family.length - b.entry.family.length ||
        a.entry.family.localeCompare(b.entry.family)
    )
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export function fontsourceId(id: string) {
  return `fontsource:${id}`
}

const resolved = new Map<string, Promise<CustomFont>>()

// Turns a catalog entry into a CustomFont with concrete file URLs. Variable
// fonts use the single wght file per subset; static fonts list every weight
// and let the browser download only what the page renders.
export function resolveFont(entry: FontsourceEntry) {
  let pending = resolved.get(entry.id)
  if (!pending) {
    pending = resolve(entry)
    pending.catch(() => resolved.delete(entry.id))
    resolved.set(entry.id, pending)
  }
  return pending
}

async function resolve(entry: FontsourceEntry): Promise<CustomFont> {
  const [detail, axes] = await Promise.all([
    getJson<FontsourceDetail>(`${API}/fonts/${entry.id}`),
    entry.variable
      ? getJson<FontsourceAxes>(`${API}/variable/${entry.id}`).catch(() => null)
      : null,
  ])

  const style = detail.styles.includes("normal") ? "normal" : detail.styles[0]
  if (!style) {
    throw new Error(`${entry.family} has no styles`)
  }
  const wght = axes?.axes?.wght
  const files: FontFile[] = []

  if (wght) {
    for (const subset of detail.subsets) {
      files.push({
        src: `${CDN}/${detail.id}:vf@latest/${subset}-wght-${style}.woff2`,
        weight: `${Number(wght.min)} ${Number(wght.max)}`,
        style,
        unicodeRange: detail.unicodeRange[subset],
      })
    }
  } else {
    for (const [weight, styles] of Object.entries(detail.variants)) {
      for (const [subset, file] of Object.entries(styles[style] ?? {})) {
        if (file.url.woff2) {
          files.push({
            src: file.url.woff2,
            weight,
            style,
            unicodeRange: detail.unicodeRange[subset],
          })
        }
      }
    }
  }

  if (files.length === 0) {
    throw new Error(`${entry.family} has no woff2 files`)
  }

  return {
    id: fontsourceId(detail.id),
    name: detail.family,
    // Matches the family names Fontsource's own CSS uses.
    family: wght ? `${detail.family} Variable` : detail.family,
    category: detail.category,
    fallback: fallbackFor(detail.category),
    source: "fontsource",
    dependency: wght
      ? `@fontsource-variable/${detail.id}`
      : `@fontsource/${detail.id}`,
    files,
  }
}
