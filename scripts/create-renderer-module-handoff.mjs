import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1)));
const root = path.resolve(scriptDir, "..");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length)
  ?? "C:/Users/Lenovo/Desktop/Renderer Module";
const target = path.resolve(targetArg);
const replaceTarget = process.argv.includes("--replace");

const rootFiles = [
  ".gitignore",
  "README.md",
  "eslint.config.mjs",
  "package.json",
  "playwright.config.ts",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.build.json",
  "tsconfig.json",
  "vitest.config.ts",
];
const directories = [
  "apps",
  "assets",
  "contracts",
  "docs",
  "fixtures",
  "local-runtime-resources",
  "packages",
  "reference",
  "scripts",
  "source-guides",
  "src",
  "tests",
];
const excludedDirectoryNames = new Set(["node_modules", ".git", "dist", "dist-desktop", "build", "release", "coverage", "test-results", ".cache", ".out-staging", ".tmp-n2-runtime-verification"]);

async function exists(filePath) {
  try { await stat(filePath); return true; } catch { return false; }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function copyPsdFiles(source, destination) {
  let count = 0;
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".psd") {
        const relative = path.relative(source, absolute);
        const destinationPath = path.join(destination, relative);
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await copyFile(absolute, destinationPath);
        count += 1;
      }
    }
  }
  if (await exists(source)) await visit(source);
  return count;
}

function fileRole(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.startsWith("contracts/") || normalized.endsWith(".schema.json")) return "CONTRACT";
  if (normalized.startsWith("source-guides/") || normalized.startsWith("reference/")) return "SOURCE";
  if (normalized.startsWith("src/") || normalized.startsWith("apps/") || normalized.startsWith("packages/")) return "IMPLEMENTATION";
  if (normalized.startsWith("tests/")) return "TEST";
  if (normalized.startsWith("fixtures/")) return "FIXTURE";
  if (normalized.startsWith("scripts/")) return "VERIFICATION";
  return "DOCUMENTATION";
}

async function collectFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.localeCompare(b));
}

if (await exists(target)) {
  if (!replaceTarget || path.basename(target) !== "Renderer Module") throw new Error(`handoff target already exists; refusing overwrite: ${target}`);
  await rm(target, { recursive: true, force: true });
}
await mkdir(target, { recursive: true });

for (const relativePath of rootFiles) {
  const sourcePath = path.join(root, relativePath);
  if (!(await exists(sourcePath))) throw new Error(`required repository file missing: ${relativePath}`);
  await mkdir(path.dirname(path.join(target, relativePath)), { recursive: true });
  await copyFile(sourcePath, path.join(target, relativePath));
}
for (const relativePath of directories) {
  const sourcePath = path.join(root, relativePath);
  if (await exists(sourcePath)) {
    await cp(sourcePath, path.join(target, relativePath), {
      recursive: true,
      filter: (entryPath) => !path.relative(sourcePath, entryPath).split(path.sep).some((part) => excludedDirectoryNames.has(part)),
    });
  }
}

const psdSourceRoot = "C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12";
const psdDestination = path.join(target, "source-guides/naver/smartchannel/psd");
const smartchannelPsdCount = await copyPsdFiles(psdSourceRoot, psdDestination);

const { stdout: sourceShaOutput } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
const sourceSha = sourceShaOutput.trim();
const canonicalPath = path.join(target, "docs/kakao-bizboard-renderer-spec-v1.md");
const canonicalDocument = JSON.parse(await readFile(path.join(root, "contracts/contract-versions.json"), "utf8"));
const canonicalTarget = path.join(target, "docs/kakao-bizboard-renderer-spec-v1.md");

const files = [];
for (const absolutePath of await collectFiles(target)) {
  const relativePath = path.relative(target, absolutePath).replaceAll("\\", "/");
  if (relativePath === "MANIFEST.json") continue;
  files.push({ path: relativePath, sha256: await sha256(absolutePath), role: fileRole(relativePath) });
}

const readme = `# Renderer Module — N5 handoff

## Purpose

This folder is a copy of the standalone local Renderer repository for reproducible review,
build, test, and later phase development. The source repository remains unchanged.

- Source repository: C:/Users/Lenovo/Desktop/kakao-bizboard-renderer-spec-v1-package
- N5 completion commit: ${sourceSha}
- Canonical document: docs/kakao-bizboard-renderer-spec-v1.md v${canonicalDocument.documentVersion.current}
- Runtime network access: PROHIBITED

## Current status

- Kakao Template Locked: implemented
- Kakao/NAVER FREEFORM profiles: implemented according to current contracts
- NAVER SmartChannel 120: implemented
- NAVER Platform-Composed: source contract only; final native/feed UI is NAVER-owned
- NAVER Collection: not implemented (deferred to N6)
- NAVER video runtime: not implemented
- NAVER Desktop UI: not implemented
- Meta: not implemented
- Google: not implemented

## Directories

contracts/ is the machine-readable source of truth; src/ and packages/ contain the Core and
contract implementation; scripts/ contains contract, source, font, golden, and handoff
verifiers; tests/ and fixtures/ contain deterministic checks; source-guides/ contains pinned
official PDFs and SmartChannel PSD provenance; local-runtime-resources/ contains external
runtime-resource manifests; docs/ records the canonical contract and ADR decisions.

## Reproduce

PowerShell from this folder:

    pnpm install --frozen-lockfile
    pnpm check
    pnpm verify:naver-platform
    node scripts/verify-renderer-module-handoff.mjs

The full check includes TypeScript, ESLint, Vitest, Desktop build, and Playwright gates. No
runtime command may make a network request. Build dependency resolution is lockfile-based;
offline install is available only when the pnpm store is already prepared.

## External fonts

Apple SD Gothic Neo binaries are deliberately not bundled. See
local-runtime-resources/fonts/README.md and font-manifest.json. Supply the approved local
files from a trusted directory and set NAVER_SMARTCHANNEL_FONT_DIR; do not download fonts at
runtime and do not make a redistribution claim. Kakao Spoqa assets remain governed by their
OFL notice under assets/fonts/.

## Source of truth and next phase

The latest phase is N5 in docs/kakao-bizboard-renderer-spec-v1.md. N5 source contracts are
contracts/naver-platform-composed-source.schema.json,
contracts/naver-platform-composed-source-profiles.json, and
contracts/naver-platform-composed-source-revision.json. The next planned phase is
N6_NAVER_COLLECTION_MULTI_ARTIFACT_CONTRACT; it must not invent final NAVER UI geometry.
`;
await writeFile(path.join(target, "README.md"), readme, "utf8");
const readmeEntry = files.find((entry) => entry.path === "README.md");
if (readmeEntry) readmeEntry.sha256 = await sha256(path.join(target, "README.md"));

const manifest = {
  packageName: "Renderer Module",
  handoffPhase: "N5_NAVER_PLATFORM_COMPOSED_SOURCE_CONTRACT",
  sourceRepository: "C:/Users/Lenovo/Desktop/kakao-bizboard-renderer-spec-v1-package",
  sourceSha,
  createdAt: new Date().toISOString(),
  canonicalDocument: {
    path: "docs/kakao-bizboard-renderer-spec-v1.md",
    version: canonicalDocument.documentVersion.current,
    sha256: await sha256(canonicalTarget),
  },
  versions: {
    document: canonicalDocument.documentVersion.current,
    template: canonicalDocument.templateContractVersion,
    inputSchema: canonicalDocument.inputSchemaVersion.current,
    outputSchema: canonicalDocument.outputSchemaVersion.current,
    integration: canonicalDocument.integrationContract.current,
    rendererCore: canonicalDocument.canonicalPhaseN5.rendererCoreVersion,
    desktop: canonicalDocument.desktopAppVersion,
    smartChannelTemplate: canonicalDocument.smartChannelTemplateContractVersion,
    platformComposedSourceSchema: canonicalDocument.platformComposedSourceSchemaVersion,
    platformComposedSourceRegistry: canonicalDocument.platformComposedSourceRegistryVersion,
  },
  channels: {
    KAKAO_MOMENT: { templateLocked: "IMPLEMENTED", freeform: "IMPLEMENTED" },
    NAVER_GFA: { smartChannel120: "IMPLEMENTED", freeform: "IMPLEMENTED", platformComposedSource: "FROZEN_SOURCE_ONLY", finalNativeUi: "NOT_IMPLEMENTED" },
    META: "NOT_IMPLEMENTED",
    GOOGLE: "NOT_IMPLEMENTED",
  },
  files,
  sourceProvenance: {
    smartchannelPsdSource: psdSourceRoot,
    smartchannelPsdCount,
    officialNaverGuideDirectory: "source-guides/naver/platform-composed",
  },
  externalRuntimeDependencies: [
    { kind: "font", directoryEnv: "NAVER_SMARTCHANNEL_FONT_DIR", manifest: "local-runtime-resources/fonts/font-manifest.json", bundled: false, licenseStatus: "NOT_CONFIRMED" },
  ],
  excludedGeneratedDependencies: ["node_modules", "dist", "dist-desktop", "release", "coverage", "test-results", ".cache", ".out-staging", ".git", "Apple SD Gothic Neo binaries"],
  runtimeNetworkAccess: "PROHIBITED",
  smartchannelPsdCount,
  fontBinariesBundled: false,
};
await writeFile(path.join(target, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ target, sourceSha, smartchannelPsdCount, fileCount: files.length, canonicalSha256: manifest.canonicalDocument.sha256 }, null, 2));
