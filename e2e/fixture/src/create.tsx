import "./styles.css"

import * as React from "react"
import { createRoot } from "react-dom/client"

import { FONT_HEADING_OPTIONS, FONTS, type Params } from "./fonts"
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerLabel,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "./picker"

type FontOption = (typeof FONT_HEADING_OPTIONS)[number]

// Same normalisation as search-params.ts: heading equal to body is "inherit".
const normalize = (params: Params): Params => ({
  ...params,
  fontHeading: params.fontHeading === params.font ? "inherit" : params.fontHeading,
})

const OverrideContext = React.createContext<{
  setOverride: (value: Partial<Params> | null) => void
}>({ setOverride: () => {} })

function FontPicker({
  label,
  param,
  fonts,
  params,
  setParams,
}: {
  label: string
  param: keyof Params
  fonts: readonly FontOption[]
  params: Params
  setParams: (update: Partial<Params>) => void
}) {
  const { setOverride } = React.useContext(OverrideContext)
  const currentValue = params[param]
  const currentFont = fonts.find((font) => font.value === currentValue)
  const currentBodyFont = FONTS.find((font) => font.value === params.font)
  const inherits = param === "fontHeading" && currentValue === "inherit"
  const displayFontName = inherits ? currentBodyFont?.name : currentFont?.name
  const groups = Object.entries(
    Object.groupBy(
      fonts.filter((font) => font.value !== "inherit"),
      (font) => font.type
    )
  )

  return (
    <div className="group/picker relative">
      <Picker onOpenChange={(open) => !open && setOverride(null)}>
        <PickerTrigger>
          <div className="flex flex-col justify-start text-left">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="line-clamp-1 max-w-[80%] truncate text-sm font-medium text-foreground">
              {displayFontName}
            </div>
          </div>
          <div
            className="pointer-events-none absolute top-1/2 right-4 flex size-4 -translate-y-1/2 items-center justify-center text-base text-foreground select-none md:right-2.5"
            style={{
              fontFamily:
                currentFont?.font?.style.fontFamily ??
                currentBodyFont?.font.style.fontFamily,
            }}
          >
            Aa
          </div>
        </PickerTrigger>
        <PickerContent className="max-h-96" onMouseLeave={() => setOverride(null)}>
          <PickerRadioGroup
            value={currentValue}
            onValueChange={(value: string) => setParams({ [param]: value })}
            onItemPreview={(value) => setOverride({ [param]: value })}
          >
            {param === "fontHeading" ? (
              <>
                <PickerGroup>
                  <PickerRadioItem value="inherit">
                    {currentBodyFont?.name ?? "Body font"}
                  </PickerRadioItem>
                </PickerGroup>
                <PickerSeparator />
              </>
            ) : null}
            {groups.map(([type, items]) => (
              <PickerGroup key={type}>
                <PickerLabel>{type.charAt(0).toUpperCase() + type.slice(1)}</PickerLabel>
                {items?.map((font) => (
                  <PickerRadioItem key={font.value} value={font.value}>
                    {font.name}
                  </PickerRadioItem>
                ))}
              </PickerGroup>
            ))}
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
    </div>
  )
}

// Stand-in for the site's single key shortcuts (R shuffles, D toggles dark
// mode), which ignore keys typed into inputs.
declare global {
  interface Window {
    siteShortcuts: string[]
  }
}
window.siteShortcuts = []
document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement
  if (target.closest("input, textarea, [contenteditable]")) return
  window.siteShortcuts.push(event.key)
})

function App() {
  const [params, setParamsState] = React.useState<Params>({
    font: "inter",
    fontHeading: "inherit",
  })
  const [override, setOverride] = React.useState<Partial<Params> | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const setParams = (update: Partial<Params>) =>
    setParamsState((old) => normalize({ ...old, ...update }))
  const [iframeSrc] = React.useState(
    () => `/preview/base/preview-02/?${new URLSearchParams(params)}`
  )
  const merged = React.useMemo(
    () => normalize({ ...params, ...override }),
    [params, override]
  )

  React.useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const send = () =>
      iframe.contentWindow?.postMessage({ type: "design-system-params", data: merged }, "*")
    send()
    iframe.addEventListener("load", send)
    return () => iframe.removeEventListener("load", send)
  }, [merged])

  return (
    <OverrideContext.Provider value={{ setOverride }}>
      <div className="flex h-screen gap-6 p-6">
        <div className="flex w-56 flex-col gap-3 rounded-2xl bg-neutral-900 p-3 text-neutral-100 dark">
          <FontPicker
            label="Heading"
            param="fontHeading"
            fonts={FONT_HEADING_OPTIONS}
            params={params}
            setParams={setParams}
          />
          <FontPicker
            label="Font"
            param="font"
            fonts={FONTS}
            params={params}
            setParams={setParams}
          />
          <output data-testid="params" className="text-xs">
            {JSON.stringify(params)}
          </output>
        </div>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Preview"
          className="flex-1 rounded-2xl ring-1 ring-black/10"
        />
      </div>
    </OverrideContext.Provider>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
