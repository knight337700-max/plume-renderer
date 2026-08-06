import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { createKakaoBizboardRenderer } from "../../src/core/index.js";
import {
  createTempRoot,
  loadValidInput,
  projectRoot,
  removeTempRoot,
  withOutput,
} from "../helpers.js";

const EXPECTED_WINDOWS_X64_PNG_SHA256 = "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1";

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

    it("keeps the product and right-side region byte-equal to the pre-C2a Golden", async () => {
      const outputRoot = await createTempRoot("golden-region");
      roots.push(outputRoot);
      const renderer = await createKakaoBizboardRenderer({
        projectRoot,
        inputRoot: projectRoot,
        outputRoot,
      });
      const response = await renderer.render(withOutput(await loadValidInput(), "golden-region"));
      expect(response.status).toBe("PASS");
      if (!response.pngPath) return;

      const previousPath = path.join(projectRoot, "fixtures", "golden", "object-right__c2-before-baseline__golden.png");
      const [previousRaw, currentRaw] = await Promise.all([
        sharp(previousPath).raw().toBuffer(),
        sharp(response.pngPath).raw().toBuffer(),
      ]);
      for (let y = 0; y < 258; y += 1) {
        for (let x = 633; x < 1029; x += 1) {
          const offset = (y * 1029 + x) * 4;
          expect(currentRaw.subarray(offset, offset + 4)).toEqual(previousRaw.subarray(offset, offset + 4));
        }
      }
    });
  },
);
