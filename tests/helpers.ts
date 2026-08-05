import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { KakaoBizboardInputV1 } from "../src/core/index.js";

export const projectRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

export async function loadValidInput(): Promise<KakaoBizboardInputV1> {
  const fixturePath = path.join(
    projectRoot,
    "fixtures",
    "valid",
    "object-right__input__cta-none-basic__pass.json",
  );
  return JSON.parse(await readFile(fixturePath, "utf8")) as KakaoBizboardInputV1;
}

export async function createTempRoot(label: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `kbr-c1-${label}-`));
}

export async function removeTempRoot(root: string): Promise<void> {
  const expectedPrefix = path.join(os.tmpdir(), "kbr-c1-");
  if (!path.resolve(root).startsWith(expectedPrefix)) {
    throw new Error(`Refusing to remove non-test directory: ${root}`);
  }
  await rm(root, { recursive: true, force: true });
}

export function withOutput(
  input: KakaoBizboardInputV1,
  baseName: string,
  overwrite = false,
): KakaoBizboardInputV1 {
  const copy = structuredClone(input);
  copy.output = { directory: "jobs", baseName, overwrite };
  return copy;
}
