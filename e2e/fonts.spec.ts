import type { Page } from "@playwright/test"

import { expect, test } from "./extension"

const GABARITO = "\"Gabarito Variable\", sans-serif"

function trigger(page: Page, label: "Heading" | "Font") {
  return page.locator('[data-slot="dropdown-menu-trigger"]', {
    has: page.locator(".text-xs", { hasText: new RegExp(`^${label}$`) }),
  })
}

function preview(page: Page) {
  return page.frameLocator('iframe[title="Preview"]')
}

async function fontFamily(page: Page, testId: "heading" | "body") {
  return preview(page)
    .getByTestId(testId)
    .evaluate((element) => getComputedStyle(element).fontFamily.replaceAll("'", '"'))
}

test("adds Gabarito to the Heading picker and previews it live", async ({
  context,
}) => {
  const page = await context.newPage()
  await page.goto("/create/")
  await expect.poll(() => fontFamily(page, "heading")).toContain("Inter Variable")

  await trigger(page, "Heading").click()
  const menu = page.locator('[data-slot="dropdown-menu-content"]')
  await expect(menu.getByText("Custom", { exact: true })).toBeVisible()
  const item = menu.locator('[data-sce-item="gabarito"]')
  await expect(item).toHaveText("Gabarito")

  // Hover previews without committing.
  await item.hover()
  await expect.poll(() => fontFamily(page, "heading")).toBe(GABARITO)
  await menu.getByRole("menuitemradio", { name: "Figtree" }).hover()
  await expect.poll(() => fontFamily(page, "heading")).toContain("Figtree")

  // Like the site's own items on desktop, picking keeps the menu open.
  await item.click()
  await expect(item).toHaveAttribute("aria-checked", "true")
  await expect(item.locator("svg")).toBeVisible()
  await expect(
    menu.locator('[data-slot="dropdown-menu-radio-item"]:not([data-sce-item]) svg')
  ).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(menu).toBeHidden()
  await expect(trigger(page, "Heading")).toContainText("Gabarito")
  await expect(trigger(page, "Heading").locator('[data-sce-font="gabarito"]')).toHaveText(
    "Aa"
  )
  await expect.poll(() => fontFamily(page, "heading")).toBe(GABARITO)
  await expect.poll(() => fontFamily(page, "body")).toContain("Inter Variable")

  // The font file is really loaded in the preview, not just named.
  await expect
    .poll(() =>
      preview(page)
        .locator("html")
        .evaluate(async () => {
          await document.fonts.ready
          return document.fonts.check("16px 'Gabarito Variable'")
        })
    )
    .toBe(true)

  // Reopening still shows Gabarito as the selection.
  await trigger(page, "Heading").click()
  await expect(item).toHaveAttribute("aria-checked", "true")
  await page.keyboard.press("Escape")

  // Survives a reload of the page.
  await page.reload()
  await expect(trigger(page, "Heading")).toContainText("Gabarito")
  await expect.poll(() => fontFamily(page, "heading")).toBe(GABARITO)

  // Picking a site font hands the slot back to the site.
  await trigger(page, "Heading").click()
  await menu.getByRole("menuitemradio", { name: "Lora" }).click()
  await expect(item).toHaveAttribute("aria-checked", "false")
  await expect(
    menu.getByRole("menuitemradio", { name: "Lora" }).locator("svg")
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger(page, "Heading")).toContainText("Lora")
  await expect.poll(() => fontFamily(page, "heading")).toContain("Lora")

  await page.screenshot({ path: "test-results/heading-lora.png" })
})

test("Gabarito as body font also drives inherited headings", async ({
  context,
}) => {
  const page = await context.newPage()
  await page.goto("/create/")

  await trigger(page, "Font").click()
  await page.locator('[data-sce-item="gabarito"]').click()
  await page.keyboard.press("Escape")

  await expect(trigger(page, "Font")).toContainText("Gabarito")
  await expect(trigger(page, "Heading")).toContainText("Gabarito")
  await expect.poll(() => fontFamily(page, "body")).toBe(GABARITO)
  await expect.poll(() => fontFamily(page, "heading")).toBe(GABARITO)

  // An explicit heading font wins over the inherited custom body font.
  await trigger(page, "Heading").click()
  await page.getByRole("menuitemradio", { name: "Figtree" }).click()
  await page.keyboard.press("Escape")
  await expect.poll(() => fontFamily(page, "heading")).toContain("Figtree")
  await expect.poll(() => fontFamily(page, "body")).toBe(GABARITO)

  // Mobile closes the menu on pick, like the site.
  await page.setViewportSize({ width: 600, height: 800 })
  await trigger(page, "Heading").click()
  await page.locator('[data-sce-item="gabarito"]').click()
  await expect(page.locator('[data-slot="dropdown-menu-content"]')).toBeHidden()
  await expect.poll(() => fontFamily(page, "heading")).toBe(GABARITO)
})
