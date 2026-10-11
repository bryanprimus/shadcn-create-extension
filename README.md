# shadcn/create Extension

A browser extension that adds more font families to the **Heading** and
**Font** pickers on [ui.shadcn.com/create](https://ui.shadcn.com/create), with
the live preview updating as you hover and pick.

Currently adds: **Gabarito**.

## Install (development)

```sh
pnpm install
pnpm build            # Chrome, output in .output/chrome-mv3
pnpm build:firefox    # Firefox, output in .output/firefox-mv2
```

Chrome: open `chrome://extensions`, enable Developer mode, click
**Load unpacked** and pick `.output/chrome-mv3`.

`pnpm dev` starts a browser with the extension loaded and hot reload.

## Releases

Every push to `main` runs the tests and publishes a GitHub Release
(`v0.1.<run number>`) with the Chrome and Firefox zips
([`.github/workflows/release.yml`](.github/workflows/release.yml)).

To try a release: download the `chrome.zip` asset, unzip it, and use
**Load unpacked** in `chrome://extensions` (or Arc's extensions page).

### Chrome Web Store (optional)

The same workflow uploads to the Chrome Web Store once these repository
secrets exist: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`,
`CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`.
The first upload has to be done by hand in the developer dashboard to get the
extension ID.

## How it works

The create page is a Next.js app whose pickers are Base UI menus, and the
preview is a same origin iframe at `/preview/<base>/<item>`.

* `entrypoints/create.content.ts` runs on the create page. It adds a
  **Custom** group to the Heading and Font menus, mirrors the site's
  behaviour (hover previews, menu stays open on desktop, closes on mobile),
  and shows the chosen font on the picker trigger. It never edits nodes React
  owns; it hides them and renders its own next to them.
* `entrypoints/preview.content.ts` runs inside the preview iframe. The site
  writes `--font-sans` / `--font-heading` as inline styles on `<html>`; the
  extension overrides them with an `!important` rule, and keeps "heading
  inherits body" working.
* Fonts are bundled from Fontsource packages and registered with the
  `FontFace` API from an `ArrayBuffer`, so the page's CSP does not matter.
* The selection lives in the tab's `sessionStorage`, shared by the page and
  its iframe, so it survives reloads. The extension needs no permissions.

## Adding a font

Add the `@fontsource-variable/<slug>` package and an entry in
[`lib/fonts.ts`](lib/fonts.ts). The build copies the font files from the
package.

## Tests

```sh
pnpm typecheck
pnpm test:e2e
```

The e2e tests run the built extension in Chromium against
`e2e/fixture`, a trimmed replica of the create page (same Base UI picker
markup and iframe protocol). Set `CHROMIUM_PATH` to use an existing Chromium
binary instead of the one Playwright downloads.

## Limitations

* Custom fonts are not part of the shadcn preset code, so **Get Code**,
  **Open in v0** and shared links still contain the site's own font.
* Custom menu items are reachable with the mouse and Tab, but not with the
  menu's arrow key navigation.
