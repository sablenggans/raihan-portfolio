import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Set base to "/<repo-name>/" if deploying to GitHub Pages project sites.
export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        admin: fileURLToPath(new URL("./admin.html", import.meta.url)),
      },
    },
  },
});
