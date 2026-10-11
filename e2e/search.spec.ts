import type { Page } from "@playwright/test"

import { expect, test } from "./extension"
import { mockFontsource } from "./fontsource-mock"

function trigger(page: Page, label: "Heading" | "Font") {
  return page.locator('[data-slot="dropdown-menu-trigger"]', {
    has: page.locator(".text-xs", { hasText: new RegExp(`^${label}$`) }),
  })
}

async function fontFamily(page: Page, testId: "heading" | "body") {
  return page
    .frameLocator('iframe[title="Preview"]')
    .getByTestId(testId)
    .evaluate((element) => getComputedStyle(element).fontFamily.replaceAll(/["']/g, ""))
}

const menu = (page: Page) => page.locator('[data-slot="dropdown-menu-content"]')
const search = (page: Page) => menu(page).getByRole("searchbox")

test("searches Fontsource, previews on hover and applies on click", async ({
  context,
}) => {
  const requests = await mockFontsource(context)
  const page = await context.newPage()
  await page.goto("/create/")

  await trigger(page, "Font").click()
  await search(page).fill("brico")
  // Typing stays in the box instead of driving the menu's typeahead.
  await expect(search(page)).toBeFocused()
  await expect(menu(page).getByText("Fontsource", { exact: true })).toBeVisible()
  const result = menu(page)
    .locator("[data-sce-results]")
    .locator('[data-sce-item="fontsource:bricolage-grotesque"]')
  await expect(result).toHaveText("Bricolage Grotesque")

  await result.hover()
  await expect
    .poll(() => fontFamily(page, "body"))
    .toBe("Bricolage Grotesque Variable, sans-serif")

  await result.click()
  await expect(result).toHaveAttribute("aria-checked", "true")
  await page.keyboard.press("Escape")
  await expect(trigger(page, "Font")).toContainText("Bricolage Grotesque")
  // Heading inherits the body font.
  await expect(trigger(page, "Heading")).toContainText("Bricolage Grotesque")
  await expect
    .poll(() => fontFamily(page, "heading"))
    .toBe("Bricolage Grotesque Variable, sans-serif")

  // The variable file was requested and actually loads in the preview.
  await expect
    .poll(() =>
      page
        .frameLocator('iframe[title="Preview"]')
        .locator("html")
        .evaluate(
          async () =>
            (await document.fonts.load("16px 'Bricolage Grotesque Variable'")).length
        )
    )
    .toBeGreaterThan(0)
  expect(requests).toContain(
    "https://cdn.jsdelivr.net/fontsource/fonts/bricolage-grotesque:vf@latest/latin-wght-normal.woff2"
  )

  // Picked fonts are remembered in the Custom group.
  await trigger(page, "Heading").click()
  const custom = menu(page).locator("[data-sce-group]")
  await expect(custom.locator("[data-sce-item]")).toHaveText([
    "Gabarito",
    "Bricolage Grotesque",
  ])

  // Static fonts work too, and Enter picks the first hit.
  await search(page).fill("abel")
  await expect(menu(page).locator('[data-sce-item="fontsource:abel"]')).toBeVisible()
  await search(page).press("Enter")
  await expect
    .poll(() => fontFamily(page, "heading"))
    .toBe("Abel, sans-serif")
  await expect.poll(() => fontFamily(page, "body")).toBe(
    "Bricolage Grotesque Variable, sans-serif"
  )

  await search(page).fill("zzzz")
  await expect(menu(page).getByText("No fonts found")).toBeVisible()

  // Arrow keys move from the box into the results.
  await search(page).fill("slab")
  const slab = menu(page)
    .locator("[data-sce-results]")
    .locator('[data-sce-item="fontsource:roboto-slab"]')
  await expect(slab).toBeVisible()
  await search(page).press("ArrowDown")
  await expect(slab).toBeFocused()
  await expect.poll(() => fontFamily(page, "heading")).toBe("Roboto Slab, serif")
  await slab.press("ArrowUp")
  await expect(search(page)).toBeFocused()
  await slab.hover()
  await page.screenshot({ path: "test-results/search.png" })

  // Survives a reload.
  await page.keyboard.press("Escape")
  await page.reload()
  await expect(trigger(page, "Heading")).toContainText("Abel")
  await expect.poll(() => fontFamily(page, "heading")).toBe("Abel, sans-serif")
})

test("shows an error when Fontsource is unreachable", async ({ context }) => {
  await mockFontsource(context, { failCatalog: true })
  const page = await context.newPage()
  await page.goto("/create/")

  await trigger(page, "Font").click()
  await search(page).fill("inter")
  await expect(menu(page).getByText("Couldn't reach Fontsource")).toBeVisible()
  // The bundled font still works.
  await menu(page).locator('[data-sce-item="gabarito"]').click()
  await expect.poll(() => fontFamily(page, "body")).toBe(
    "Gabarito Variable, sans-serif"
  )
})
