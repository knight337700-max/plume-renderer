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

const psdSourceCandidates = [
  "C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12",
  "C:/Users/Lenovo/Desktop/Renderer Guidelines/official/SMARTCHANNEL_GUIDE 12",
];
const psdSourceRoot = (await (async () => {
  for (const candidate of psdSourceCandidates) if (await exists(candidate)) return candidate;
  return psdSourceCandidates[0];
})());
const psdDestination = path.join(target, "source-guides/naver/smartchannel/psd");
const smartchannelPsdCount = await copyPsdFiles(psdSourceRoot, psdDestination);

const { stdout: sourceShaOutput } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
const sourceSha = sourceShaOutput.trim();
const canonicalPath = path.join(target, "docs/kakao-bizboard-renderer-spec-v1.md");
const canonicalDocument = JSON.parse(await readFile(path.join(root, "contracts/contract-versions.json"), "utf8"));
const typographyAudit = JSON.parse(await readFile(path.join(root, "contracts/audits/naver-smartchannel-typography-audit.json"), "utf8"));
const fontCorrectionAudit = JSON.parse(await readFile(path.join(root, "contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json"), "utf8"));
const canonicalTarget = path.join(target, "docs/kakao-bizboard-renderer-spec-v1.md");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packageArtifactPath = path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${packageJson.version}-x64.exe`);
const packageArtifact = await exists(packageArtifactPath)
  ? { path: `release/Kakao-Bizboard-Local-Renderer-${packageJson.version}-x64.exe`, sha256: await sha256(packageArtifactPath), bytes: (await stat(packageArtifactPath)).size }
  : null;

const files = [];
for (const absolutePath of await collectFiles(target)) {
  const relativePath = path.relative(target, absolutePath).replaceAll("\\", "/");
  if (relativePath === "MANIFEST.json") continue;
  files.push({ path: relativePath, sha256: await sha256(absolutePath), role: fileRole(relativePath) });
}

const readme = `# Renderer Module — N7.7 PSD-exact runtime font correction handoff

## Purpose

This folder is a copy of the standalone local Renderer repository for reproducible review,
build, test, and later phase development. The source repository remains unchanged.

- Source repository: C:/Users/Lenovo/Desktop/kakao-bizboard-renderer-spec-v1-package
- N7.7 correction source commit: ${sourceSha}
- Canonical document: docs/kakao-bizboard-renderer-spec-v1.md v${canonicalDocument.documentVersion.current}
- Desktop package: ${packageArtifact?.path ?? "not built"}${packageArtifact ? ` (${packageArtifact.bytes} bytes, ${packageArtifact.sha256})` : ""}
- Runtime network access: PROHIBITED

## Current status

- Kakao Template Locked: implemented
- Kakao/NAVER FREEFORM profiles: implemented according to current contracts
- NAVER SmartChannel 120: implemented
- NAVER Platform-Composed: source contract only; final native/feed UI is NAVER-owned
- NAVER Feed Collection: implemented source artifacts, ordered fingerprints, and atomic manifest publish; final Feed UI is not implemented
- NAVER video runtime: not implemented
- NAVER Desktop UI: implemented (capability-driven Channel → Placement → Editor)
- NAVER Desktop N7.1/N7.2/N7.3 resilience: local diagnostics, Error Boundary, explicit registry errors, SmartChannel selection reconciliation, editor-owned copy state, empty-string preservation, packaged click/input matrix
- NAVER SmartChannel N7.4: actual-user sofa/logo acceptance evidence, final-alpha validation, Preview/Export/Packaged parity
- NAVER SmartChannel N7.5: frozen fixed-component runtime inventory (26 resources), packaged asset inclusion, structured digest/decode/placement diagnostics, 29 landing-template and 11-option CTA coverage
- NAVER SmartChannel N7.6: audit-only global typography re-analysis of all 120 source PSDs, 25 frozen typography tokens, source/runtime mapping, and local raster metrics; result: ${typographyAudit.phase.status}
- NAVER SmartChannel N7.7: renderer-owned SHA-256-pinned Apple SD Gothic Neo runtime mapping, trusted provider parity, explicit binary registration, and 120-template deterministic acceptance; result: ${fontCorrectionAudit.phase.status}
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
    pnpm smoke:desktop
    node scripts/verify-renderer-module-handoff.mjs

The full check includes TypeScript, ESLint, Vitest, Desktop build, and Playwright gates. No
runtime command may make a network request. Build dependency resolution is lockfile-based;
offline install is available only when the pnpm store is already prepared.

## Fonts and actual-user evidence

SmartChannel required runtime fonts are bundled exact Apple SD Gothic Neo Bold/Regular/SemiBold
assets under assets/fonts/naver-smartchannel/. Medium and optional San Francisco remain source-only
metadata; historical Nanum assets are not SmartChannel runtime requirements. No system fallback or
network download is permitted. The actual-user acceptance registry
is contracts/naver-smartchannel-actual-asset-acceptance.json. It records the externally supplied
sofa/logo digests and runtime evidence; the creative binaries are not copied into this handoff.
Kakao Spoqa assets remain governed by their OFL notice under assets/fonts/.

## Source of truth and next phase

The latest implementation phase is N7.7 in docs/kakao-bizboard-renderer-spec-v1.md. N7.6 remains
an immutable audit baseline; N7.7 changes only the SmartChannel runtime token mapping and records
an expected SmartChannel text-golden migration without blanket overwrite. N7.5
SmartChannel fixed component runtime acceptance uses source/runtime/package digest evidence and
final placement validation.
N7.4 SmartChannel runtime acceptance uses actual-user binary evidence and final render-space validation. N7.3 SmartChannel copy
stability uses one-time default hydration, editor-owned content, nullish reads, and existing Core
paths. N6 source contracts are
contracts/naver-platform-composed-source.schema.json,
contracts/naver-platform-composed-source-profiles.json, and
contracts/naver-platform-composed-source-revision.json, plus the generic
multi-artifact manifest schema. N7 additions are
contracts/desktop-capability-registry.json, contracts/desktop-error-registry.json,
tests/e2e/naver-desktop.spec.ts, and scripts/smoke-naver-desktop.mjs. N7.2 adds
source-backed SmartChannel filter reconciliation and event-value snapshot tests; N7.3 adds
custom/empty/Korean copy persistence, preview-read, compatible-template, and all-text-field tests.
N7.6 audit artifacts are contracts/audits/naver-smartchannel-typography-audit.json,
docs/implementation/naver-smartchannel-global-typography-audit-n7-6.md, and
scripts/verify-n7-6-smartchannel-typography-audit.mjs. N7.7 correction artifacts are
contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json,
docs/implementation/naver-smartchannel-psd-exact-runtime-font-correction-n7-7.md, and
scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs. The next recommended phase is
N7.8_SMARTCHANNEL_GOLDEN_REBASE_AND_PACKAGED_QA.
`;
await writeFile(path.join(target, "README.md"), readme, "utf8");
const readmeEntry = files.find((entry) => entry.path === "README.md");
if (readmeEntry) readmeEntry.sha256 = await sha256(path.join(target, "README.md"));

const manifest = {
  packageName: "Renderer Module",
  handoffPhase: "N7_7_SMARTCHANNEL_PSD_EXACT_RUNTIME_FONT_CORRECTION",
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
    rendererCore: canonicalDocument.canonicalPhaseN7_7.rendererCoreVersion,
    desktop: canonicalDocument.canonicalPhaseN7_7.desktopCurrent,
    smartChannelTemplate: canonicalDocument.smartChannelTemplateContractVersion,
    platformComposedSourceSchema: canonicalDocument.platformComposedSourceSchemaVersion,
    platformComposedSourceRegistry: canonicalDocument.platformComposedSourceRegistryVersion,
    capabilityRegistry: canonicalDocument.canonicalPhaseN7.capabilityRegistryVersion,
    desktopErrorRegistry: canonicalDocument.desktopErrorRegistryVersion,
  },
  packageArtifact,
  audit: {
    phase: typographyAudit.phase.id,
    status: typographyAudit.phase.status,
    json: "contracts/audits/naver-smartchannel-typography-audit.json",
    report: "docs/implementation/naver-smartchannel-global-typography-audit-n7-6.md",
    verifier: "scripts/verify-n7-6-smartchannel-typography-audit.mjs",
    psdCount: typographyAudit.source.psdCount.total,
    templateCount: typographyAudit.summary.templates.audited,
    tokenCount: typographyAudit.summary.tokenAudit.total,
    runtimeBehaviorChanged: false,
  },
  correction: {
    phase: fontCorrectionAudit.phase.id,
    status: fontCorrectionAudit.phase.status,
    json: "contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json",
    report: "docs/implementation/naver-smartchannel-psd-exact-runtime-font-correction-n7-7.md",
    verifier: "scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs",
    templatesRendered: fontCorrectionAudit.acceptanceEvidence.templatesRendered,
    templatesPassed: fontCorrectionAudit.acceptanceEvidence.templatesPassed,
    providerParity: fontCorrectionAudit.acceptanceEvidence.providerParity.status,
    geometryChanged: fontCorrectionAudit.representative.geometryChanged,
  },
  channels: {
    KAKAO_MOMENT: { templateLocked: "IMPLEMENTED", freeform: "IMPLEMENTED" },
    NAVER_GFA: { smartChannel120: "IMPLEMENTED", freeform: "IMPLEMENTED", platformComposedSource: "FROZEN_SOURCE_ONLY", feedCollectionSourceArtifacts: "IMPLEMENTED", desktopIntegration: "IMPLEMENTED", finalNativeUi: "NOT_IMPLEMENTED", video: "DISABLED_OUT_OF_STATIC_SCOPE" },
    META: "NOT_IMPLEMENTED",
    GOOGLE: "NOT_IMPLEMENTED",
  },
  files,
  sourceProvenance: {
    smartchannelPsdSource: psdSourceRoot,
    smartchannelPsdCount,
    officialNaverGuideDirectory: "source-guides/naver/platform-composed",
    collectionContract: "contracts/multi-artifact-manifest.schema.json",
    desktopCapabilityRegistry: "contracts/desktop-capability-registry.json",
    desktopErrorRegistry: "contracts/desktop-error-registry.json",
    n7ImplementationRecord: "docs/implementation/naver-desktop-integration-n7.md",
    n7_1ImplementationRecord: "docs/implementation/naver-desktop-white-screen-runtime-hotfix-n7-1.md",
    n7_1PackageSmoke: "scripts/smoke-naver-desktop.mjs",
    n7_2ImplementationRecord: "docs/implementation/naver-smartchannel-null-value-selection-hotfix-n7-2.md",
    n7_2ContractClarification: "docs/contract-clarifications/naver-smartchannel-null-value-selection-hotfix-n7-2.md",
    n7_3ImplementationRecord: "docs/implementation/naver-smartchannel-headline-input-reset-hotfix-n7-3.md",
    n7_3ContractClarification: "docs/contract-clarifications/naver-smartchannel-headline-input-reset-hotfix-n7-3.md",
    n7_4ContractClarification: "docs/contract-clarifications/naver-smartchannel-n7-4-asset-font-hotfix.md",
    n7_4ImplementationRecord: "docs/implementation/naver-smartchannel-n7-4-final-actual-user-asset-acceptance.md",
    n7_4ActualAssetAcceptance: "contracts/naver-smartchannel-actual-asset-acceptance.json",
    n7_4FontAssetManifest: "contracts/naver-smartchannel-font-asset-manifest.json",
    n7_5ContractClarification: "docs/contract-clarifications/naver-smartchannel-n7-5-fixed-component-runtime-hotfix.md",
    n7_5ImplementationRecord: "docs/implementation/naver-smartchannel-n7-5-fixed-component-runtime-hotfix.md",
    n7_5FixedComponentRuntimeRegistry: "contracts/naver-smartchannel-fixed-component-runtime.json",
    n7_5FixedComponentGenerator: "scripts/generate-naver-smartchannel-fixed-component-runtime.mjs",
    n7_5FixedComponentVerifier: "scripts/verify-naver-smartchannel-fixed-components.mjs",
    n7_5FixedComponentSmoke: "scripts/smoke-naver-smartchannel-fixed-components.mjs",
    n7_5PackagedSmoke: "apps/desktop/electron-main/src/main.ts --smoke-n7-5-fixed",
    n7_6TypographyAuditJson: "contracts/audits/naver-smartchannel-typography-audit.json",
    n7_6TypographyAuditReport: "docs/implementation/naver-smartchannel-global-typography-audit-n7-6.md",
    n7_6TypographyAuditVerifier: "scripts/verify-n7-6-smartchannel-typography-audit.mjs",
    n7_6PsdSourceRoot: typographyAudit.source.root,
    n7_7RuntimeFontCorrectionJson: "contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json",
    n7_7RuntimeFontCorrectionReport: "docs/implementation/naver-smartchannel-psd-exact-runtime-font-correction-n7-7.md",
    n7_7RuntimeFontCorrectionVerifier: "scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs",
    n7_7FontAssetManifest: "contracts/naver-smartchannel-font-asset-manifest.json",
  },
  externalRuntimeDependencies: [],
  excludedGeneratedDependencies: ["node_modules", "dist", "dist-desktop", "release", "coverage", "test-results", ".cache", ".out-staging", ".git"],
  runtimeNetworkAccess: "PROHIBITED",
  smartchannelPsdCount,
  fontBinariesBundled: true,
};
await writeFile(path.join(target, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ target, sourceSha, smartchannelPsdCount, fileCount: files.length, canonicalSha256: manifest.canonicalDocument.sha256 }, null, 2));
