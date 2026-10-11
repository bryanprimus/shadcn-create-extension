import { loadFont } from "@/lib/font-loader"
import { getFontStack, isCustomFont } from "@/lib/fonts"
import {
  isApplyFontsMessage,
  readOverrides,
  type FontOverrides,
} from "@/lib/state"

const STYLE_ID = "shadcn-create-extension-fonts"

// Runs inside the preview iframe (/preview/<base>/<item>). The site's
// DesignSystemProvider writes --font-sans and --font-heading as inline styles
// on <html>; an !important stylesheet rule outranks those without fighting
// React over the attribute.
export default defineContentScript({
  matches: ["https://ui.shadcn.com/preview/*"],
  allFrames: true,
  runAt: "document_start",
  main() {
    let overrides: FontOverrides = readOverrides()
    const root = document.documentElement

    // With heading set to "inherit" the site writes the body font into
    // --font-heading too, so equal inline values mean headings follow body.
    const headingInheritsBody = () =>
      root.style.getPropertyValue("--font-heading").trim() ===
      root.style.getPropertyValue("--font-sans").trim()

    const apply = () => {
      const body = overrides.font
      const heading =
        overrides.fontHeading ?? (headingInheritsBody() ? body : undefined)

      const rules: string[] = []
      if (body) {
        void loadFont(body)
        rules.push(`--font-sans: ${getFontStack(body)} !important;`)
      }
      if (heading) {
        void loadFont(heading)
        rules.push(`--font-heading: ${getFontStack(heading)} !important;`)
      }

      const css = rules.length ? `:root {\n  ${rules.join("\n  ")}\n}` : ""
      let style = document.getElementById(STYLE_ID)
      if (!css) {
        style?.remove()
        return
      }
      if (!style) {
        style = document.createElement("style")
        style.id = STYLE_ID
      }
      if (style.textContent !== css) {
        style.textContent = css
      }
      // Keep it last in <head> and reattach it if the page swaps <head>.
      const parent = document.head ?? root
      if (style.parentNode !== parent || style.nextElementSibling) {
        parent.append(style)
      }
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window.parent || !isApplyFontsMessage(event.data)) {
        return
      }
      const { font, fontHeading } = event.data.overrides
      overrides = {
        font: isCustomFont(font) ? font : undefined,
        fontHeading: isCustomFont(fontHeading) ? fontHeading : undefined,
      }
      apply()
    })

    // Re-evaluate heading inheritance whenever the site rewrites the vars.
    new MutationObserver(apply).observe(root, {
      attributes: true,
      attributeFilter: ["style"],
    })

    apply()
    document.addEventListener("DOMContentLoaded", apply, { once: true })
  },
})
