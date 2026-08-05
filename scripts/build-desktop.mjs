import { rm } from "node:fs/promises";
import path from "node:path";

import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

const root = process.cwd();
const outputRoot = path.join(root, "dist-desktop");
await rm(outputRoot, { recursive: true, force: true });

await Promise.all([
  esbuild({
    entryPoints: [path.join(root, "apps/desktop/electron-main/src/main.ts")],
    outfile: path.join(outputRoot, "electron-main/main.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron", "@napi-rs/canvas", "sharp"],
    sourcemap: false,
    legalComments: "none",
  }),
  esbuild({
    entryPoints: [path.join(root, "apps/desktop/preload/src/index.ts")],
    outfile: path.join(outputRoot, "preload/index.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
    sourcemap: false,
    legalComments: "none",
  }),
  viteBuild({ configFile: path.join(root, "apps/desktop/renderer-ui/vite.config.ts") }),
]);

process.stdout.write("Built secure Electron Main, Preload, and local React UI.\n");
