import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { projectRoot } from "../helpers.js";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(target) : Promise.resolve(entry.name.endsWith(".ts") ? [target] : []);
    }),
  );
  return nested.flat();
}

describe("standalone offline runtime boundary", () => {
  it("has no plume or out-of-scope direct dependency", async () => {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})];
    const prohibited = /plume|railway|postgres|^pg$|telemetry|analytics/iu;
    expect(names.filter((name) => prohibited.test(name))).toEqual([]);
  });

  it("contains no runtime network primitive or out-of-scope service import", async () => {
    const files = await sourceFiles(path.join(projectRoot, "src"));
    const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
    const prohibited = [
      /from\s+["']node:(?:http|https|http2|net|tls|dns|dgram)["']/u,
      /\bfetch\s*\(/u,
      /\bWebSocket\b/u,
      /\bXMLHttpRequest\b/u,
      /\bplume\b/iu,
      /\bRailway\b/iu,
      /\bElectron\b/u,
      /from\s+["']react(?:\/[^"']*)?["']/u,
    ];
    expect(prohibited.filter((pattern) => pattern.test(source))).toEqual([]);
  });
});
