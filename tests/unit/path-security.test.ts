import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  resolveTrustedInputFile,
  resolveTrustedJobDirectory,
  resolveTrustedRoot,
} from "../../src/core/index.js";
import { createTempRoot, removeTempRoot } from "../helpers.js";

describe("trusted root path security", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map(removeTempRoot));
  });

  it("accepts descendants and leaves a missing safe input for asset validation", async () => {
    const root = await createTempRoot("path");
    roots.push(root);
    await writeFile(path.join(root, "present.png"), "fixture");
    const trusted = await resolveTrustedRoot(root);

    await expect(resolveTrustedInputFile(trusted, "present.png")).resolves.toBe(path.join(trusted, "present.png"));
    await expect(resolveTrustedInputFile(trusted, "missing.png")).resolves.toBe(path.join(trusted, "missing.png"));
  });

  it.each(["../escape.png", "folder/../../escape.png", "C:/escape.png", "\\\\server\\share\\asset.png"])(
    "rejects unsafe input reference %s",
    async (reference) => {
      const root = await createTempRoot("path-reject");
      roots.push(root);
      const trusted = await resolveTrustedRoot(root);
      await expect(resolveTrustedInputFile(trusted, reference)).rejects.toThrow();
    },
  );

  it("rejects output traversal before directory creation", async () => {
    const root = await createTempRoot("path-output");
    roots.push(root);
    const trusted = await resolveTrustedRoot(root);
    await expect(resolveTrustedJobDirectory(trusted, "../escape", "job")).rejects.toThrow();
  });
});
