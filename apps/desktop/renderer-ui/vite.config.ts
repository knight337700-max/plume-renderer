import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rendererRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rendererRoot,
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve(rendererRoot, "../../../dist-desktop/renderer-ui"),
    emptyOutDir: true,
    target: "chrome140",
    sourcemap: false,
  },
});
