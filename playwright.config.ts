import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "vite --config e2e/fixture/vite.config.ts",
    url: "http://localhost:4173/create/",
    reuseExistingServer: !process.env.CI,
  },
})
