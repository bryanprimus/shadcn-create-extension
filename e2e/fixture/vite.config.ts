import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// A trimmed replica of ui.shadcn.com/create used by the e2e tests: the same
// Base UI picker markup, the same preview iframe protocol, served on the same
// paths (/create, /preview/<base>/<item>).
export default defineConfig({
  root: import.meta.dirname,
  appType: "mpa",
  plugins: [react(), tailwindcss()],
  server: { port: 4173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        create: resolve(import.meta.dirname, "create/index.html"),
        preview: resolve(import.meta.dirname, "preview/base/preview-02/index.html"),
      },
    },
  },
})
