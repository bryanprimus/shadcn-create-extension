import type { Page } from "@playwright/test"

import { expect, test } from "./extension"
import { mockFontsource } from "./fontsource-mock"

const picker = (page: Page, slot: "font" | "fontHeading") =>
  page.locator(`[data-sce-picker="${slot}"] button`)
const popup = (page: Page) => page.locator('[data-slot="combobox-content"]')
const search = (page: Page) => popup(page).getByRole("combobox")
const option = (page: Page, name: string) =>
  popup(page).getByRole("option", { name, exact: true })
const siteParams = async (page: Page) =>
  JSON.parse((await page.getByTestId("params").textContent()) ?? "{}")

async function fontFamily(page: Page, testId: "heading" | "body") {
  return page
    .frameLocator('iframe[title="Preview"]')
    .getByTestId(testId)
    .evaluate((element) => getComputedStyle(element).fontFamily.replaceAll(/["']/g, ""))
}

test.beforeEach(async ({ context }) => {
  await mockFontsource(context)
})

test("replaces the site's font pickers with shadcn comboboxes", async ({
  context,
}) => {
  const page = await context.newPage()
  await page.goto("/create/")

  // The site's own pickers are hidden; ours show the same values.
  await expect(
    page.locator('[data-slot="dropdown-menu-trigger"]', { hasText: "Heading" })
  ).toBeHidden()
  await expect(picker(page, "fontHeading")).toContainText("Heading")
  await expect(picker(page, "fontHeading")).toContainText("Inter")
  await expect(picker(page, "font")).toContainText("Inter")

  // Defaults: the site's fonts, grouped like the site, plus Gabarito.
  await picker(page, "font").click()
  await expect(search(page)).toBeFocused()
  for (const label of ["Sans", "Mono", "Serif"]) {
    await expect(popup(page).getByText(label, { exact: true })).toBeVisible()
  }
  await expect(option(page, "Geist")).toBeVisible()
  await expect(option(page, "Gabarito")).toBeVisible()
  await expect(option(page, "Inter")).toHaveAttribute("aria-selected", "true")

  // Hover previews a built-in font without committing it.
  await option(page, "Figtree").hover()
  await expect.poll(() => fontFamily(page, "body")).toContain("Figtree")

  // Picking a built-in font goes through the site's own state.
  await option(page, "Figtree").click()
  await expect(popup(page)).toBeHidden()
  await expect.poll(() => siteParams(page)).toMatchObject({ font: "figtree" })
  await expect(picker(page, "font")).toContainText("Figtree")
  await expect.poll(() => fontFamily(page, "body")).toContain("Figtree")
  // Heading follows the body font (inherit).
  await expect(picker(page, "fontHeading")).toContainText("Figtree")

  // Heading picker: first entry is "same as body", then the groups.
  await picker(page, "fontHeading").click()
  await expect(popup(page).getByRole("option").first()).toHaveText("Figtree")
  await option(page, "Lora").click()
  await expect.poll(() => siteParams(page)).toMatchObject({ fontHeading: "lora" })
  await expect.poll(() => fontFamily(page, "heading")).toContain("Lora")
})

test("searches beyond the site's fonts without duplicates", async ({ context }) => {
  const page = await context.newPage()
  await page.goto("/create/")

  await picker(page, "font").click()
  await search(page).pressSequentially("int")
  // Typing never reaches the site's single key shortcuts.
  expect(await page.evaluate(() => window.siteShortcuts)).toEqual([])
  // "Inter" exists on the site and in Fontsource; it is listed once.
  await expect(option(page, "Inter")).toHaveCount(1)
  await expect(popup(page).getByText("Fontsource")).toHaveCount(0)

  await search(page).fill("brico")
  const bricolage = option(page, "Bricolage Grotesque")
  await expect(bricolage).toBeVisible()
  // Fontsource results join the site's categories.
  await expect(popup(page).getByText("Sans", { exact: true })).toBeVisible()

  await bricolage.hover()
  await expect
    .poll(() => fontFamily(page, "body"))
    .toBe("Bricolage Grotesque Variable, sans-serif")

  await bricolage.click()
  await expect(picker(page, "font")).toContainText("Bricolage Grotesque")
  await expect(picker(page, "fontHeading")).toContainText("Bricolage Grotesque")
  await expect
    .poll(() => fontFamily(page, "heading"))
    .toBe("Bricolage Grotesque Variable, sans-serif")
  // The site's own value is untouched; the custom font is an overlay.
  await expect.poll(() => siteParams(page)).toMatchObject({ font: "inter" })

  // Picked fonts become defaults, without duplicates when searched again.
  await picker(page, "font").click()
  await expect(option(page, "Bricolage Grotesque")).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await search(page).fill("brico")
  await expect(option(page, "Bricolage Grotesque")).toHaveCount(1)

  // Keyboard: Enter picks the highlighted result.
  await search(page).fill("abel")
  await expect(option(page, "Abel")).toBeVisible()
  await search(page).press("ArrowDown")
  await search(page).press("Enter")
  await expect(picker(page, "font")).toContainText("Abel")
  await expect.poll(() => fontFamily(page, "body")).toBe("Abel, sans-serif")

  await picker(page, "font").click()
  await search(page).fill("zzzz")
  await expect(popup(page).getByText("No fonts found.")).toBeVisible()

  await search(page).fill("slab")
  await option(page, "Roboto Slab").hover()
  await page.screenshot({ path: "test-results/pickers.png" })
  await page.keyboard.press("Escape")

  // Survives a reload.
  await page.reload()
  await expect(picker(page, "font")).toContainText("Abel")
  await expect.poll(() => fontFamily(page, "body")).toBe("Abel, sans-serif")

  // Going back to a built-in font clears the custom one.
  await picker(page, "font").click()
  await option(page, "Geist").click()
  await expect.poll(() => siteParams(page)).toMatchObject({ font: "geist" })
  await expect.poll(() => fontFamily(page, "body")).toContain("Geist")
})

test("works offline with the site's fonts and Gabarito", async ({ context }) => {
  await context.unroute("https://api.fontsource.org/**")
  await context.route("https://api.fontsource.org/**", (route) =>
    route.fulfill({ status: 503, body: "down" })
  )
  const page = await context.newPage()
  await page.goto("/create/")

  await picker(page, "font").click()
  await search(page).fill("gab")
  await expect(popup(page).getByText("Couldn't load more fonts.")).toBeVisible()
  await option(page, "Gabarito").click()
  await expect
    .poll(() => fontFamily(page, "body"))
    .toBe("Gabarito Variable, sans-serif")
})

test("opens next to the trigger without disturbing the customizer", async ({
  context,
}) => {
  const page = await context.newPage()
  // Short enough that the customizer scrolls, like a laptop screen.
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto("/create/")

  const panel = page.getByTestId("customizer")
  await picker(page, "fontHeading").click()
  await expect(option(page, "Geist")).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: "test-results/open-in-panel.png" })

  // Rendered at page level, to the right of the panel like the site's menu,
  // and the customizer neither scrolls nor clips it.
  const panelBox = (await panel.boundingBox())!
  const triggerBox = (await picker(page, "fontHeading").boundingBox())!
  const popupBox = (await popup(page).boundingBox())!
  expect(popupBox.x).toBeGreaterThan(panelBox.x + panelBox.width)
  expect(Math.abs(popupBox.y - triggerBox.y)).toBeLessThan(12)
  expect(popupBox.height).toBeGreaterThan(200)
  expect(
    await page.getByTestId("customizer-content").evaluate((element) => element.scrollTop)
  ).toBe(0)

  // Keeps the customizer's dark colours outside the .dark panel.
  const background = await popup(page).evaluate(
    (element) => getComputedStyle(element).backgroundColor
  )
  expect(background).toMatch(/oklch\(0\.2/)
})
