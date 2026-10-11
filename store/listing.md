# Chrome Web Store listing

Copy these into the developer dashboard when creating the item.

## Package

Upload `shadcn-create-extension-<version>-chrome.zip` from the latest
GitHub Release.

## Store listing tab

**Name:** shadcn/create Extension

**Summary (132 chars max):**
Adds more font families to the Heading and Font pickers on ui.shadcn.com/create, with live preview.

**Description:**
Extends the shadcn/ui create page (ui.shadcn.com/create) with extra font
families in the Heading and Font pickers.

Fonts show up in a "Custom" group inside the existing menus. Hovering
previews the font in the live preview, and picking it applies it to the
preview just like the built in fonts.

Currently adds: Gabarito.

Not affiliated with shadcn/ui.

**Category:** Developer Tools

**Language:** English

**Icon:** `public/icon/128.png`

**Screenshot (1280x800 or 640x400):** take one on ui.shadcn.com/create with
a custom font picked.

## Privacy practices tab

**Single purpose:**
Adds extra font families to the font pickers on ui.shadcn.com/create and
applies them to the page's live preview.

**Host permission justification (content scripts on ui.shadcn.com):**
The extension only runs on ui.shadcn.com to add font options to the create
page pickers and apply the chosen font to its preview iframe.

**Remote code:** No, I am not using remote code. Fonts are bundled in the
package.

**Data usage:** Collects no user data. Tick nothing, then certify the three
disclosures.

## Distribution tab

**Visibility:** Unlisted (installable by link, not searchable). Switch to
Public whenever you want.
