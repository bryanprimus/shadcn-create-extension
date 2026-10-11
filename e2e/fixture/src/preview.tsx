import "./styles.css"

import * as React from "react"
import { createRoot } from "react-dom/client"

import { FONTS, type Params } from "./fonts"

// Mirrors design-system-provider.tsx: params arrive over postMessage and the
// selected families are written as inline vars on <html>.
function App() {
  // Like the real site, the iframe src carries the initial params and later
  // changes arrive over postMessage.
  const [params, setParams] = React.useState<Params | null>(() => {
    const search = new URLSearchParams(location.search)
    return {
      font: search.get("font") ?? "inter",
      fontHeading: search.get("fontHeading") ?? "inherit",
    }
  })

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "design-system-params") setParams(event.data.data)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  React.useLayoutEffect(() => {
    if (!params) return
    const body = FONTS.find((font) => font.value === params.font)
    const heading =
      params.fontHeading === "inherit"
        ? body
        : FONTS.find((font) => font.value === params.fontHeading)
    const root = document.documentElement
    if (body) root.style.setProperty("--font-sans", body.font.style.fontFamily)
    if (heading) root.style.setProperty("--font-heading", heading.font.style.fontFamily)
  }, [params])

  return (
    <main className="space-y-4 p-10">
      <h1 data-testid="heading" className="font-heading text-5xl font-bold">
        Contribution History
      </h1>
      <p data-testid="body" className="font-sans text-lg">
        Set the minimum balance required before a payout is triggered.
      </p>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
