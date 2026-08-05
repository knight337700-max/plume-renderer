#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createKakaoBizboardRenderer,
  resolveTrustedInputFile,
  resolveTrustedRoot,
  type RenderResponse,
} from "../core/index.js";

type CliOptions = {
  input: string;
  inputRoot: string;
  outputRoot: string;
};

function usage(): string {
  return [
    "Usage:",
    "  kakao-bizboard-renderer render --input <relative-json> --input-root <absolute-dir> --output-root <absolute-dir>",
    "",
    "Runtime network access is prohibited. Input and output roots must be local, non-UNC directories.",
  ].join("\n");
}

function parseArgs(argv: readonly string[]): CliOptions {
  const args = [...argv];
  if (args[0] === "render") args.shift();
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Invalid CLI argument near ${flag ?? "<end>"}`);
    }
    if (!new Set(["--input", "--input-root", "--output-root"]).has(flag)) {
      throw new Error(`Unknown CLI option: ${flag}`);
    }
    values.set(flag, value);
  }
  const input = values.get("--input");
  const inputRoot = values.get("--input-root");
  const outputRoot = values.get("--output-root");
  if (!input || !inputRoot || !outputRoot) throw new Error("--input, --input-root, and --output-root are required");
  return { input, inputRoot, outputRoot };
}

function printResponse(response: RenderResponse): void {
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(moduleDirectory, "../..");
  const inputRoot = await resolveTrustedRoot(options.inputRoot);
  const outputRoot = await resolveTrustedRoot(options.outputRoot);
  const inputPath = await resolveTrustedInputFile(inputRoot, options.input.replaceAll("\\", "/"));
  const renderer = await createKakaoBizboardRenderer({ projectRoot, inputRoot, outputRoot });
  const response = await renderer.renderJson(await readFile(inputPath, "utf8"));
  printResponse(response);
  process.exitCode = response.downloadAllowed ? 0 : 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage()}\n`);
  process.exitCode = 1;
});
