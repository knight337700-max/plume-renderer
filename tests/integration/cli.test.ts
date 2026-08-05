import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import type { RenderResponse } from "../../src/core/types.js";
import {
  createTempRoot,
  loadValidInput,
  projectRoot,
  removeTempRoot,
  withOutput,
} from "../helpers.js";

describe("CLI", () => {
  const roots: string[] = [];
  const cliPath = path.join(projectRoot, "dist", "cli", "index.js");

  afterEach(async () => {
    await Promise.all(roots.splice(0).map(removeTempRoot));
  });

  async function inputFixture(name: string, input: unknown): Promise<string> {
    const directory = await createTempRoot("cli-input");
    roots.push(directory);
    const productDirectory = path.join(directory, "fixtures", "valid");
    await mkdir(productDirectory, { recursive: true });
    await copyFile(
      path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png"),
      path.join(productDirectory, "object-right__product__basic__pass.png"),
    );
    const fixturePath = path.join(directory, name);
    await writeFile(fixturePath, JSON.stringify(input), "utf8");
    return directory;
  }

  it("renders with explicit trusted roots and emits a response envelope", async () => {
    const outputRoot = await createTempRoot("cli-output");
    roots.push(outputRoot);
    const inputRoot = await inputFixture("input.json", withOutput(await loadValidInput(), "cli-pass"));
    const run = spawnSync(
      process.execPath,
      [cliPath, "render", "--input", "input.json", "--input-root", inputRoot, "--output-root", outputRoot],
      { cwd: projectRoot, encoding: "utf8" },
    );

    expect(run.status, run.stderr).toBe(0);
    const response = JSON.parse(run.stdout) as RenderResponse;
    expect(response).toMatchObject({ status: "PASS", downloadAllowed: true, errors: [] });
    if (!response.pngPath || !response.manifestPath) return;
    await expect(access(response.pngPath)).resolves.toBeUndefined();
    await expect(access(response.manifestPath)).resolves.toBeUndefined();
  });

  it("uses exit code 2 for a deterministic validation failure", async () => {
    const outputRoot = await createTempRoot("cli-invalid-output");
    roots.push(outputRoot);
    const input = withOutput(await loadValidInput(), "cli-invalid");
    input.copy.subcopy = input.copy.headline;
    const inputRoot = await inputFixture("invalid.json", input);
    const run = spawnSync(
      process.execPath,
      [cliPath, "render", "--input", "invalid.json", "--input-root", inputRoot, "--output-root", outputRoot],
      { cwd: projectRoot, encoding: "utf8" },
    );

    expect(run.status, run.stderr).toBe(2);
    const response = JSON.parse(run.stdout) as RenderResponse;
    expect(response.status).toBe("FAIL");
    expect(response.downloadAllowed).toBe(false);
    expect(response.errors.map(({ code }) => code)).toContain("KBR-TEXT-003");
  });

  it("uses exit code 1 when the CLI input path escapes its trusted root", async () => {
    const outputRoot = await createTempRoot("cli-path-output");
    const inputRoot = await createTempRoot("cli-path-input");
    roots.push(outputRoot, inputRoot);
    const run = spawnSync(
      process.execPath,
      [cliPath, "render", "--input", "../escape.json", "--input-root", inputRoot, "--output-root", outputRoot],
      { cwd: projectRoot, encoding: "utf8" },
    );

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Parent traversal is prohibited");
    expect(run.stdout).toBe("");
  });
});
