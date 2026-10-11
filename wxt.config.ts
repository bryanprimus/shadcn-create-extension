import { resolve } from "node:path"
import { defineConfig } from "wxt"

import { BUNDLED_FONTS } from "./lib/fonts"

// The e2e fixture serves a replica of the create page on localhost. Only
// builds made for tests get that host so the published extension stays
// scoped to ui.shadcn.com.
const isE2E = process.env.SCE_E2E === "1"

function withTestHost(matches: string[]) {
  return isE2E
    ? [
        ...matches,
        ...matches.map((match) =>
          match.replace("https://ui.shadcn.com", "http://localhost")
        ),
      ]
    : matches
}

export default defineConfig({
  manifest: {
    name: "shadcn/create Extension",
    description:
      "Adds more font families to the Heading and Font pickers on ui.shadcn.com/create.",
    web_accessible_resources: [
      {
        resources: ["fonts/*"],
        matches: ["https://ui.shadcn.com/*"],
      },
    ],
  },
  hooks: {
    "build:manifestGenerated": (_wxt, manifest) => {
      for (const script of manifest.content_scripts ?? []) {
        script.matches = withTestHost(script.matches ?? [])
      }
      for (const resource of manifest.web_accessible_resources ?? []) {
        if (typeof resource === "object") {
          resource.matches = withTestHost(resource.matches ?? [])
        }
      }
    },
    // Font files are copied from their npm packages at build time instead of
    // being committed, so bumping a dependency is enough to update a font.
    "build:publicAssets": (wxt, files) => {
      for (const font of BUNDLED_FONTS) {
        for (const file of font.files) {
          files.push({
            absoluteSrc: resolve(
              wxt.config.root,
              "node_modules",
              file.package,
              file.packagePath
            ),
            relativeDest: file.src,
          })
        }
      }
    },
  },
})
