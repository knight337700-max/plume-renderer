import { readFile } from "node:fs/promises";

import { afterAll, describe, expect, it } from "vitest";

import { createKakaoBizboardRenderer } from "../../src/core/index.js";
import {
  createTempRoot,
  loadValidInput,
  projectRoot,
  removeTempRoot,
  withOutput,
} from "../helpers.js";

const EXPECTED_WINDOWS_X64_PNG_SHA256 = "b67c95b239884e21270190cb2ba8019fcc68016af8ef22cf1c904315f1f2b4b9";

describe.runIf(process.platform === "win32" && process.arch === "x64")(
  "Windows 10/11 x64 golden determinism",
  () => {
    const roots: string[] = [];

    afterAll(async () => {
      await Promise.all(roots.map(removeTempRoot));
    });

    it("produces one byte-equal PNG SHA-256 across three identical runs", async () => {
      const pngDigests: string[] = [];
      const pngBytes: Buffer[] = [];

      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        const outputRoot = await createTempRoot(`golden-${runIndex}`);
        roots.push(outputRoot);
        const renderer = await createKakaoBizboardRenderer({
          projectRoot,
          inputRoot: projectRoot,
          outputRoot,
        });
        const response = await renderer.render(withOutput(await loadValidInput(), "golden"));
        expect(response.status).toBe("PASS");
        expect(response.pngDigest).not.toBeNull();
        expect(response.pngPath).not.toBeNull();
        if (!response.pngDigest || !response.pngPath) return;
        pngDigests.push(response.pngDigest);
        pngBytes.push(await readFile(response.pngPath));
      }

      expect(new Set(pngDigests)).toEqual(new Set([EXPECTED_WINDOWS_X64_PNG_SHA256]));
      expect(pngBytes[1]?.equals(pngBytes[0] ?? Buffer.alloc(0))).toBe(true);
      expect(pngBytes[2]?.equals(pngBytes[0] ?? Buffer.alloc(0))).toBe(true);
    });
  },
);
