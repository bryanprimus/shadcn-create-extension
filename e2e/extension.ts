import { resolve } from "node:path"
import { test as base, chromium, type BrowserContext } from "@playwright/test"

// Run `SCE_E2E=1 wxt build` first (`pnpm test:e2e` does) so the content
// scripts also match the localhost fixture.
const extensionPath = resolve(import.meta.dirname, "../.output/chrome-mv3")

export const test = base.extend<{ context: BrowserContext }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      // Lets a preinstalled Chromium be used instead of a downloaded one.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })
    await use(context)
    await context.close()
  },
})

export const expect = test.expect
