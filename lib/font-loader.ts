import type { CustomFont, FontFile } from "./fonts"

const loaded = new WeakMap<Document, Map<string, Promise<void>>>()

async function createFace(font: CustomFont, file: FontFile) {
  const descriptors: FontFaceDescriptors = {
    weight: file.weight,
    style: file.style,
    unicodeRange: file.unicodeRange,
    display: "swap",
  }

  if (file.bundled) {
    // Bundled bytes are fetched from the extension and handed over as an
    // ArrayBuffer, so the page's CSP font-src never comes into play.
    // Paths come from the font registry, not WXT's generated public file list.
    const url = browser.runtime.getURL(`/${file.src}` as "/")
    const response = await fetch(url)
    const face = new FontFace(font.family, await response.arrayBuffer(), descriptors)
    await face.load()
    return face
  }

  // Remote files are only downloaded once the page renders text in that
  // weight and unicode range.
  return new FontFace(font.family, `url("${file.src}") format("woff2")`, descriptors)
}

// Registers the font's faces with the document. Safe to call repeatedly.
export function loadFont(font: CustomFont, doc: Document = document) {
  let fonts = loaded.get(doc)
  if (!fonts) {
    fonts = new Map()
    loaded.set(doc, fonts)
  }

  const key = `${font.id}|${font.family}`
  let pending = fonts.get(key)
  if (!pending) {
    pending = Promise.all(
      font.files.map(async (file) => {
        doc.fonts.add(await createFace(font, file))
      })
    ).then(() => undefined)
    pending.catch((error) => {
      fonts.delete(key)
      console.error(`[shadcn-create-extension] Failed to load ${font.name}`, error)
    })
    fonts.set(key, pending)
  }

  return pending
}
