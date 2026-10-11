import type { CustomFont } from "./fonts"

const loaded = new WeakMap<Document, Map<string, Promise<void>>>()

// Registers the font with the document through the FontFace API. The bytes
// are fetched from the extension and handed over as an ArrayBuffer, so the
// page's CSP font-src never comes into play.
export function loadFont(font: CustomFont, doc: Document = document) {
  let fonts = loaded.get(doc)
  if (!fonts) {
    fonts = new Map()
    loaded.set(doc, fonts)
  }

  let pending = fonts.get(font.id)
  if (!pending) {
    pending = Promise.all(
      font.files.map(async (file) => {
        // Paths come from the font registry, not WXT's generated public file list.
        const url = browser.runtime.getURL(`/${file.path}` as "/")
        const response = await fetch(url)
        const face = new FontFace(font.family, await response.arrayBuffer(), {
          weight: file.weight,
          style: file.style,
          unicodeRange: file.unicodeRange,
          display: "swap",
        })
        await face.load()
        doc.fonts.add(face)
      })
    ).then(() => undefined)
    pending.catch((error) => {
      fonts.delete(font.id)
      console.error(`[shadcn-create-extension] Failed to load ${font.name}`, error)
    })
    fonts.set(font.id, pending)
  }

  return pending
}
