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
  "artifacts",
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
  if (normalized.startsWith("artifacts/")) return "EVIDENCE";
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
const fontSourceMigrationAudit = JSON.parse(await readFile(path.join(root, "contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json"), "utf8"));
const typographyParityAudit = JSON.parse(await readFile(path.join(root, "contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json"), "utf8"));
const textInputUiParityAudit = JSON.parse(await readFile(path.join(root, "contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json"), "utf8"));
const finalBaselineAudit = JSON.parse(await readFile(path.join(root, "contracts/audits/naver-smartchannel-final-baseline-n7-8.json"), "utf8"));
const goldenRebaseManifest = JSON.parse(await readFile(path.join(root, "artifacts/n7-8/golden-rebase-manifest.json"), "utf8"));
const n8Inventory = JSON.parse(await readFile(path.join(root, "artifacts/n8/naver-capability-inventory.json"), "utf8"));
const n8DesktopMatrix = JSON.parse(await readFile(path.join(root, "artifacts/n8/naver-desktop-format-matrix.json"), "utf8"));
const n8ContractParity = JSON.parse(await readFile(path.join(root, "artifacts/n8/naver-format-contract-parity.json"), "utf8"));
const n8E2eSummary = JSON.parse(await readFile(path.join(root, "artifacts/n8/naver-e2e-summary.json"), "utf8"));
const n8SmartFreeze = JSON.parse(await readFile(path.join(root, "artifacts/n8/smartchannel-frozen-regression.json"), "utf8"));
const n8Regression = JSON.parse(await readFile(path.join(root, "artifacts/n8/non-smartchannel-regression.json"), "utf8"));
const m0OfficialSourceAudit = JSON.parse(await readFile(path.join(root, "artifacts/m0/meta-official-source-audit.json"), "utf8"));
const m0CapabilityMatrix = JSON.parse(await readFile(path.join(root, "artifacts/m0/meta-static-capability-matrix.json"), "utf8"));
const m0PlacementMatrix = JSON.parse(await readFile(path.join(root, "artifacts/m0/meta-placement-compatibility-matrix.json"), "utf8"));
const m0ReuseAudit = JSON.parse(await readFile(path.join(root, "artifacts/m0/freeform-reuse-audit.json"), "utf8"));
const m0SafeZoneAudit = JSON.parse(await readFile(path.join(root, "artifacts/m0/meta-safe-zone-audit.json"), "utf8"));
const m0Scope = JSON.parse(await readFile(path.join(root, "artifacts/m0/meta-scope-classification.json"), "utf8"));
const m1OfficialSourceRefresh = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-official-source-refresh.json"), "utf8"));
const m1PixelPresets = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-project-pixel-presets.json"), "utf8"));
const m1FontInventory = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-freeform-font-inventory.json"), "utf8"));
const m1DesktopParity = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-desktop-contract-parity.json"), "utf8"));
const m1ValidatorAudit = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-validator-audit.json"), "utf8"));
const m1Determinism = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-determinism.json"), "utf8"));
const m1PlacementSetAudit = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-placement-set-audit.json"), "utf8"));
const m1Regression = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-regression.json"), "utf8"));
const m1PackageSmoke = JSON.parse(await readFile(path.join(root, "artifacts/m1/meta-package-smoke.json"), "utf8"));
const m2ArtifactAudit = JSON.parse(await readFile(path.join(root, "artifacts/m2/meta-artifact-audit.json"), "utf8"));
const m2CandidateRegistry = JSON.parse(await readFile(path.join(root, "contracts/audits/meta-golden-candidates-m2.json"), "utf8"));
const m2Regression = JSON.parse(await readFile(path.join(root, "artifacts/m2/meta-regression.json"), "utf8"));
const m2_1OutputConstraintProvenance = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-output-constraint-provenance.json"), "utf8"));
const m2_1ByteAudit = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-300kb-rule-audit.json"), "utf8"));
const m2_1CropAudit = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-manual-crop-candidate-audit.json"), "utf8"));
const m2_1FormatAudit = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-output-format-audit.json"), "utf8"));
const m2_1SourceRefresh = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-official-source-refresh.json"), "utf8"));
const m2_1Determinism = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-determinism.json"), "utf8"));
const m2_1Regression = JSON.parse(await readFile(path.join(root, "artifacts/m2-1/meta-regression.json"), "utf8"));
const m2_1CandidateRegistry = JSON.parse(await readFile(path.join(root, "contracts/audits/meta-golden-candidates-m2-1.json"), "utf8"));
const m2_2Inventory = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-placement-context-contract-inventory.json"), "utf8"));
const m2_2Pipeline = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/freeform-plan-import-pipeline.json"), "utf8"));
const m2_2Roundtrip = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-plan-roundtrip-audit.json"), "utf8"));
const m2_2Square = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-square-import-reproduction.json"), "utf8"));
const m2_2Stories = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-stories-context-propagation.json"), "utf8"));
const m2_2Reels = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-reels-context-propagation.json"), "utf8"));
const m2_2SafeZone = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-safe-zone-target-audit.json"), "utf8"));
const m2_2ByteAudit = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-300kb-regression.json"), "utf8"));
const m2_2Determinism = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/meta-determinism.json"), "utf8"));
const m2_2Regression = JSON.parse(await readFile(path.join(root, "artifacts/m2-2/regression.json"), "utf8"));
const m2_2CandidateRegistry = JSON.parse(await readFile(path.join(root, "contracts/audits/meta-golden-candidates-m2-2.json"), "utf8"));
const m2_2VerificationStatus = m2_2CandidateRegistry.status === "CANDIDATE_NOT_APPROVED" && m2_2Inventory.status === "PASS" && m2_2Pipeline.status === "PASS" && m2_2Roundtrip.status === "PASS" && m2_2Square.status === "PASS" && m2_2Stories.status === "PASS" && m2_2Reels.status === "PASS" && m2_2SafeZone.status === "PASS" && m2_2ByteAudit.status === "PASS" && m2_2Determinism.status === "PASS" && m2_2Regression.status === "PASS" ? "PASS" : "FAIL";
const m2_2aEvidenceFiles = [
  "meta-desktop-request-state-audit.json",
  "meta-preview-request-builder.json",
  "meta-safe-zone-ui-matrix.json",
  "meta-preview-error-handling.json",
  "meta-plan-vs-manifest-viewer.json",
  "meta-desktop-state-switching.json",
  "regression.json",
];
const m2_2aEvidence = Object.fromEntries(await Promise.all(m2_2aEvidenceFiles.map(async (fileName) => [fileName, JSON.parse(await readFile(path.join(root, "artifacts/m2-2a", fileName), "utf8"))])));
const m2_2aVerificationStatus = m2_2aEvidenceFiles.every((fileName) => m2_2aEvidence[fileName].status === "PASS") && m2_2aEvidence["regression.json"].m2_2Core === "PASS" ? "PASS" : "FAIL";
const m2_3GoldenRegistry = JSON.parse(await readFile(path.join(root, "contracts/goldens/meta-static-goldens.json"), "utf8"));
const m2_3EvidenceFiles = [
  "meta-user-manual-acceptance.json",
  "meta-golden-freeze-registry-audit.json",
  "meta-golden-determinism.json",
  "meta-contextual-golden-audit.json",
  "meta-validator-expectation-audit.json",
  "meta-300kb-regression.json",
  "regression.json",
];
const m2_3Evidence = Object.fromEntries(await Promise.all(m2_3EvidenceFiles.map(async (fileName) => [fileName, JSON.parse(await readFile(path.join(root, "artifacts/m2-3", fileName), "utf8"))])));
const m2_3VerificationStatus = m2_3GoldenRegistry.status === "APPROVED_FROZEN" && m2_3GoldenRegistry.manualAcceptance?.status === "APPROVED" && m2_3GoldenRegistry.finalGoldenFrozen === true && m2_3GoldenRegistry.entries?.length === 4 && m2_3EvidenceFiles.every((fileName) => m2_3Evidence[fileName].status === "PASS") ? "PASS" : "FAIL";
const g0GoogleArchitecture = JSON.parse(await readFile(path.join(root, "contracts/google/architecture.g0.json"), "utf8"));
const g0GoogleCapabilities = JSON.parse(await readFile(path.join(root, "contracts/google/capabilities.g0.json"), "utf8"));
const g0GoogleAssetGeometry = JSON.parse(await readFile(path.join(root, "contracts/google/asset-geometry.g0.json"), "utf8"));
const g0GoogleDeliveryContracts = JSON.parse(await readFile(path.join(root, "contracts/google/delivery-contracts.g0.json"), "utf8"));
const g0GoogleProvenance = JSON.parse(await readFile(path.join(root, "contracts/google/provenance.g0.json"), "utf8"));
const g0GoogleDiagnostics = JSON.parse(await readFile(path.join(root, "contracts/google/diagnostics.g0.json"), "utf8"));
const g0GoogleVerification = JSON.parse(await readFile(path.join(root, "artifacts/g0/google-static-discovery-verification.json"), "utf8"));
const g0GoogleVerificationStatus = g0GoogleArchitecture.status === "FREEZE_CANDIDATE" && g0GoogleArchitecture.repositoryApplication === "APPLIED_ARCHITECTURE_ONLY" && g0GoogleVerification.status === "PASS" && g0GoogleCapabilities.runtimeEnabled === false && g0GoogleDiagnostics.activeRuntimeRegistration === false ? "PASS" : "FAIL";
const g0_1GoogleFreezeRegistry = JSON.parse(await readFile(path.join(root, "contracts/google/architecture-freeze.g0.1.json"), "utf8"));
const g0_1GoogleVerification = JSON.parse(await readFile(path.join(root, "artifacts/g0-1/google-static-architecture-freeze-verification.json"), "utf8"));
const g0_1GoogleVersion = canonicalDocument.canonicalPhaseG0_1Google;
const g0_1GoogleVerificationStatus = g0_1GoogleFreezeRegistry.status === "FROZEN" && g0_1GoogleVerification.status === "PASS" && g0_1GoogleVerification.architectureStatus === "FROZEN" && g0_1GoogleVersion.architectureStatus === "FROZEN" && g0_1GoogleVersion.googleArchitectureVersion === "1.0.0" && g0_1GoogleFreezeRegistry.counts.capabilities === 7 && g0_1GoogleFreezeRegistry.counts.demandGenUploadedPresets === 7 && g0_1GoogleFreezeRegistry.counts.legacyDisplayCanvases === 20 && g0_1GoogleFreezeRegistry.counts.unresolvedRules === 9 && g0_1GoogleFreezeRegistry.counts.diagnostics === 11 ? "PASS" : "FAIL";
const g1GoogleProfiles = JSON.parse(await readFile(path.join(root, "contracts/google/static-asset-profiles.g1.json"), "utf8"));
const g1GoogleMapping = JSON.parse(await readFile(path.join(root, "contracts/google/capability-asset-role-mapping.g1.json"), "utf8"));
const g1GoogleConstraints = JSON.parse(await readFile(path.join(root, "contracts/google/target-constraints.g1.json"), "utf8"));
const g1GoogleDiagnostics = JSON.parse(await readFile(path.join(root, "contracts/google/diagnostics.g1.json"), "utf8"));
const g1GoogleVersion = canonicalDocument.canonicalPhaseG1Google;
const g1GoogleEvidence = JSON.parse(await readFile(path.join(root, "artifacts/g1/google-static-contracts-profile-verification.json"), "utf8"));
const g1GoogleVerificationStatus = g1GoogleEvidence.status === "PASS" && g1GoogleProfiles.status === "IMPLEMENTED" && g1GoogleProfiles.profileCount === 14 && g1GoogleMapping.capabilityCount === 7 && g1GoogleMapping.compositionBoundary.legacyRuntimeProfiles === 0 ? "PASS" : "FAIL";
const canonicalTarget = path.join(target, "docs/kakao-bizboard-renderer-spec-v1.md");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packageArtifactPath = path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${packageJson.version}-x64.exe`);
const packageArtifact = await exists(packageArtifactPath)
  ? { sourcePath: `release/Kakao-Bizboard-Local-Renderer-${packageJson.version}-x64.exe`, includedInHandoff: false, sha256: await sha256(packageArtifactPath), bytes: (await stat(packageArtifactPath)).size }
  : null;

const files = [];
for (const absolutePath of await collectFiles(target)) {
  const relativePath = path.relative(target, absolutePath).replaceAll("\\", "/");
  if (relativePath === "MANIFEST.json") continue;
  files.push({ path: relativePath, sha256: await sha256(absolutePath), role: fileRole(relativePath) });
}

const readme = `# Renderer Module — G1 Google Ads static contracts and profiles handoff

## Purpose

This folder is a copy of the standalone local Renderer repository for reproducible review,
build, test, and later phase development. The source repository remains unchanged.

- Source repository: C:/Users/Lenovo/Desktop/kakao-bizboard-renderer-spec-v1-package
- Renderer source commit at handoff generation: ${sourceSha}
- Canonical document: docs/kakao-bizboard-renderer-spec-v1.md v${canonicalDocument.documentVersion.current}
- Desktop/package QA bridge version: ${packageJson.version}
- Source verification package: ${packageArtifact?.sourcePath ?? "not built"}${packageArtifact ? ` (${packageArtifact.bytes} bytes, ${packageArtifact.sha256}; generated release intentionally excluded from source handoff)` : ""}
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
- NAVER SmartChannel N7.7.4: pinned macOS original Apple SD Gothic Neo TTC, deterministic face identity selection, verified standalone-face derivation for the collection-limited raster backend, provider parity, three-run determinism, and 120-template smoke; result: ${fontSourceMigrationAudit.phase.status}
- NAVER SmartChannel N7.7.5: actual-alpha-raster overflow boundary, source-proven 14/17 copy acceptance, token-scoped headline vertical parity, Korean overflow localization, and 120-template deterministic smoke; result: ${typographyParityAudit.phase.status}
- NAVER SmartChannel N7.7.6: PSD text-layer metadata-driven Desktop input descriptors, 56-template 280 UI parity, mode-state preservation, and distinct render-role mapping; result: ${textInputUiParityAudit.phase.status}
- NAVER SmartChannel N7.8: six representative Goldens rebased from the corrected production runtime, 120-template three-run validation, intentional text-only diff scope, non-SmartChannel freeze, and final package QA; result: ${finalBaselineAudit.phase.status}
- NAVER N8: eight placements inventoried and contract-driven in Desktop; representative preview/validator/export evidence covers renderer-composed, platform-composed, and ordered collection outputs. SmartChannel remains frozen; matrix: ${n8DesktopMatrix.status}, parity: ${n8ContractParity.status}, E2E: ${n8E2eSummary.status}
- META M1: renderer-composed 1080x1080, 1080x1350, and 1080x1920 project presets using the existing FREEFORM Core, platform-copy metadata separation, Stories warning guide, Reels source-required INFO, and deterministic placement-set collection output. Official refresh: ${m1OfficialSourceRefresh.status}, presets: ${m1PixelPresets.status}, Desktop parity: ${m1DesktopParity.status}, placement set: ${m1PlacementSetAudit.status}
- META M2: artifact audit, independent 1:1/4:5/9:16 candidate outputs, Stories guide separation, Reels SOURCE_REQUIRED INFO, Placement Set determinism, and manual-review evidence. Audit: ${m2ArtifactAudit.status}, candidates: ${m2CandidateRegistry.status}, regression: ${m2Regression.status}, manual acceptance: ${m2CandidateRegistry.manualAcceptanceStatus}
- META M2.1: full-bleed independent MANUAL_CROP candidates, old 300000-byte rule reproduction/correction, official-source provenance refresh, JPEG/MIME audit, Stories guide separation, Reels SOURCE_REQUIRED, and deterministic manual-review package. Audit: ${m2_1CropAudit.status}, output constraint: ${m2_1OutputConstraintProvenance.status}, source refresh: ${m2_1SourceRefresh.status}, regression: ${m2_1Regression.status}, candidates: ${m2_1CandidateRegistry.status}, manual acceptance: ${m2_1CandidateRegistry.manualAcceptanceStatus}
- META M2.2: request-level placement context propagation, neutral generic vertical default, explicit Stories/Reels routing, imported MANUAL_CROP plan fidelity, four corrected candidates, and deterministic evidence. Inventory: ${m2_2Inventory.status}, round-trip: ${m2_2Roundtrip.status}, square: ${m2_2Square.status}, Stories: ${m2_2Stories.status}, Reels: ${m2_2Reels.status}, regression: ${m2_2Regression.status}, candidates: ${m2_2CandidateRegistry.status}, manual acceptance: ${m2_2CandidateRegistry.manualAcceptanceStatus}
- META M2.2a: Desktop QA request-level profile/context bridge, Feed Safe Zone capability gating, visible Preview outcomes/error boundary, imported Plan versus manifest separation, and state-switching regression. Evidence: ${m2_2aVerificationStatus}, Preview silent no-op count: ${m2_2aEvidence["meta-preview-error-handling.json"].silentNoOpCount}, manual acceptance: ${canonicalDocument.canonicalPhaseM2_2a.manualAcceptanceStatus}
- META M2.3: user visual acceptance and final Golden freeze for the current META static image scope. Registry: ${m2_3VerificationStatus}, approved entries: ${m2_3GoldenRegistry.entries.length}, manual acceptance: ${m2_3GoldenRegistry.manualAcceptance.status}, finalGoldenFrozen: ${m2_3GoldenRegistry.finalGoldenFrozen}, Stories safe-zone guide and Reels SOURCE_REQUIRED semantics preserved.
- META M0: official-source-only discovery and composition boundary remain preserved as the prior audit baseline (${m0OfficialSourceAudit.status}).
- Meta unsupported scope: carousel, catalog, dynamic, and video remain out of M1 static runtime scope.
- Google G0 (historical): architecture-only capability boundary; official-source provenance: ${g0GoogleProvenance.status}, architecture: ${g0GoogleArchitecture.status}, verification: ${g0GoogleVerificationStatus}. Runtime profiles: ${g0GoogleArchitecture.implementation.runtimeProfilesAdded}, renderer code: ${g0GoogleArchitecture.implementation.rendererCodeAdded}, Validator runtime: ${g0GoogleArchitecture.implementation.validatorRuntimeAdded}, Goldens: ${g0GoogleArchitecture.implementation.goldensAdded}, Desktop UI: ${g0GoogleArchitecture.implementation.desktopUiAdded}, upload integration: ${g0GoogleArchitecture.implementation.uploadIntegrationAdded}.
- Google G0.1 (historical freeze): architecture acceptance and freeze: ${g0_1GoogleVerificationStatus}, architecture version ${g0_1GoogleVersion.googleArchitectureVersion}, registry status ${g0_1GoogleFreezeRegistry.status}. Counts are fixed at capabilities ${g0_1GoogleFreezeRegistry.counts.capabilities}, Demand Gen uploaded presets ${g0_1GoogleFreezeRegistry.counts.demandGenUploadedPresets}, legacy Display canvases ${g0_1GoogleFreezeRegistry.counts.legacyDisplayCanvases}, unresolved rules ${g0_1GoogleFreezeRegistry.counts.unresolvedRules}, and proposed diagnostics ${g0_1GoogleFreezeRegistry.counts.proposedDiagnostics}.
- Google G1 (current): static contracts/profile implementation: ${g1GoogleVerificationStatus}, architecture version ${g1GoogleVersion.googleArchitectureVersion}, profile registry ${g1GoogleProfiles.profileCount} (${g1GoogleProfiles.geometryProfileCount} geometry + ${g1GoogleProfiles.uploadedDisplayStaticProfileCount} uploaded static), capability mapping ${g1GoogleMapping.capabilityCount}, legacy runtime profiles ${g1GoogleMapping.compositionBoundary.legacyRuntimeProfiles}, diagnostics ${g1GoogleDiagnostics.count}, and target constraints ${g1GoogleConstraints.byteUnit}. RDA/PMax/Demand Gen single-image remain PLATFORM_COMPOSED; Demand Gen uploaded static is RENDERER_COMPOSED; every artifact is SINGLE and delivery sets are COLLECTION manifests. No Google upload/API, Desktop UI, Golden, carousel, Search image, or runtime network integration was added.

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

SmartChannel required font source is the SHA-256-pinned macOS original AppleSDGothicNeo.ttc under
assets/fonts/naver-smartchannel/. The current raster backend cannot select a TTC face index, so the
runtime registers three byte-equivalent standalone OTF faces derived deterministically from face
indices 0, 4, and 6. Medium and optional San Francisco remain source-only
metadata; historical Nanum assets are not SmartChannel runtime requirements. No system fallback or
network download is permitted. Redistribution license review remains required. The actual-user acceptance registry
is contracts/naver-smartchannel-actual-asset-acceptance.json. It records the externally supplied
sofa/logo digests and runtime evidence; the creative binaries are not copied into this handoff.
Kakao Spoqa assets remain governed by their OFL notice under assets/fonts/.

## Source of truth and next phase

The latest phase is G1 Google Ads static contracts and profile implementation and the canonical document is v1.25.0. G0 remains the historical architecture-only discovery record; G0.1 freezes the same six authoritative machine-readable Google records under contracts/google/ through contracts/google/architecture-freeze.g0.1.json, with verification evidence under artifacts/g0-1/. G1 adds the dedicated fourteen-profile registry, CreativeAssetSetManifest schema, and deterministic RDA/PMax/Demand Gen delivery validators without changing the frozen composition boundary. G2 is the next phase for rendering validation and Golden candidates. M1 implements the three project output presets,
FREEFORM-backed static media rendering, metadata-only platform copy, and the renderer-composed placement set.
The official Meta pixel-size and file-size claims remain separate from project output presets; M2 audits real META artifacts and creates
historical non-approved candidates; M2.1 corrects visual candidate geometry to independent full-bleed MANUAL_CROP, removes the unpinned META 300000-byte hard error, and records current-source uncertainty without inventing a replacement. M2.2 moves context ownership to the Render Request, removes the vertical FACEBOOK_FEED hidden default, and preserves imported placement/crop semantics. M2.3 records the four user-approved META static Goldens as APPROVED_FROZEN, keeps Stories/Reels contextual identity distinct even when artifacts are byte-identical, and retains Reels SOURCE_REQUIRED INFO without guessed geometry. N8 remains the
frozen NAVER channel completion baseline and N7.8 remains
the immutable SmartChannel freeze baseline. N8 reuses existing capabilities, completes format-level Desktop acceptance,
and records its inventory, matrix, E2E outputs, regressions, package, and handoff under artifacts/n8/. N7.6 remains
an immutable audit baseline; N7.7 changed the SmartChannel runtime token mapping and N7.7.4 replaces
its font source with the verified macOS original TTC without changing geometry. N7.7.5 corrects
source-known text overflow and the source-evidenced Bold headline raster offset without changing
font binaries, source baseline values, font size, tracking, colors, or template coordinates. N7.7.6 changes only
Desktop field derivation: exact PSD text-layer role/order descriptors now drive both visible fields and render
request keys. These phases record
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
scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs.
N7.7.4 source-migration artifacts are
contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json,
docs/implementation/naver-smartchannel-macos-original-ttc-integration-n7-7-4.md,
scripts/verify-n7-7-4-macos-ttc-integration.mjs, and artifacts/n7-7-4/.
N7.7.5 parity artifacts are contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json,
docs/implementation/naver-smartchannel-typography-parity-correction-n7-7-5.md,
scripts/verify-n7-7-5-typography-parity.mjs, and artifacts/n7-7-5/. N7.7.6 UI parity artifacts are
contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json,
docs/implementation/naver-smartchannel-280-text-input-ui-field-mapping-n7-7-6.md,
scripts/verify-n7-7-6-smartchannel-text-input-fields.mjs, and artifacts/n7-7-6/. N7.8 final baseline artifacts are
contracts/audits/naver-smartchannel-final-baseline-n7-8.json,
docs/implementation/naver-smartchannel-final-baseline-n7-8.md,
scripts/verify-n7-8-smartchannel-final-baseline.mjs, and artifacts/n7-8/. The corrected SmartChannel
runtime is frozen and ready as the baseline for the next channel work. G1 is the next Google phase and must preserve the composition boundary, source provenance, unresolved-rule fail-closed behavior, zero runtime network access, and KAKAO/NAVER/META frozen outputs.
`;
await writeFile(path.join(target, "README.md"), readme, "utf8");
const readmeEntry = files.find((entry) => entry.path === "README.md");
if (readmeEntry) readmeEntry.sha256 = await sha256(path.join(target, "README.md"));

const manifest = {
  packageName: "Renderer Module",
  handoffPhase: "G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION",
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
    rendererCore: canonicalDocument.canonicalPhaseG1Google.rendererCoreVersion,
    validator: canonicalDocument.canonicalPhaseG1Google.validatorCurrent,
    desktop: canonicalDocument.canonicalPhaseG1Google.desktopCurrent,
    package: canonicalDocument.canonicalPhaseG1Google.packageCurrent,
    googleStatic: {
      architectureVersion: g0_1GoogleVersion.googleArchitectureVersion,
      architectureVersionPrevious: g0_1GoogleVersion.googleArchitecturePrevious,
      capabilityRegistry: g0_1GoogleVersion.googleCapabilityRegistry,
      assetGeometry: g0_1GoogleVersion.googleAssetGeometryRegistry,
      deliveryContracts: g0_1GoogleVersion.googleDeliveryContracts,
      provenance: g0_1GoogleVersion.googleProvenance,
      diagnostics: g0_1GoogleVersion.googleDiagnostics,
      freezeRegistry: g0_1GoogleVersion.googleFreezeRegistry,
      runtimeProfilesAdded: g0_1GoogleVersion.runtimeProfilesAdded,
      rendererCodeAdded: g0_1GoogleVersion.rendererCodeAdded,
      validatorRuntimeAdded: g0_1GoogleVersion.validatorRuntimeAdded,
      goldensAdded: g0_1GoogleVersion.goldensAdded,
      desktopUiAdded: g0_1GoogleVersion.desktopUiAdded,
      uploadIntegrationAdded: g0_1GoogleVersion.uploadIntegrationAdded,
      status: g0_1GoogleVerificationStatus,
      architectureStatus: g0_1GoogleVersion.architectureStatus,
      repositoryApplication: g0GoogleArchitecture.repositoryApplication,
      counts: g0_1GoogleFreezeRegistry.counts,
      evidence: "artifacts/g0-1/google-static-architecture-freeze-verification.json",
      g1ContractVersion: g1GoogleVersion.googleStaticContractVersion,
      g1ProfileRegistryVersion: g1GoogleVersion.googleStaticProfileRegistryVersion,
      g1ProfileRegistry: g1GoogleVersion.googleStaticProfileRegistry,
      g1CapabilityRoleMapping: g1GoogleVersion.googleCapabilityRoleMapping,
      g1TargetConstraints: g1GoogleVersion.googleTargetConstraints,
      g1ManifestSchema: g1GoogleVersion.googleCreativeAssetSetManifestSchema,
      g1DeliverySetValidator: g1GoogleVersion.googleDeliverySetValidator,
      g1Diagnostics: g1GoogleVersion.googleDiagnostics,
      g1Status: g1GoogleVerificationStatus,
      g1GeometryProfileCount: g1GoogleProfiles.geometryProfileCount,
      g1UploadedDisplayStaticProfileCount: g1GoogleProfiles.uploadedDisplayStaticProfileCount,
      g1RuntimeProfileCount: g1GoogleProfiles.profileCount,
      g1LegacyDisplayRuntimeProfiles: g1GoogleProfiles.legacyDisplayRuntimeProfiles.length,
      g1Evidence: "artifacts/g1/google-static-contracts-profile-verification.json",
    },
    platformComposedRuntime: canonicalDocument.canonicalPhaseN8.platformComposedRuntimeCurrent,
    smartChannelTemplate: canonicalDocument.smartChannelTemplateContractVersion,
    platformComposedSourceSchema: canonicalDocument.platformComposedSourceSchemaVersion,
    platformComposedSourceRegistry: canonicalDocument.platformComposedSourceRegistryVersion,
    capabilityRegistry: canonicalDocument.canonicalPhaseN7.capabilityRegistryVersion,
    desktopErrorRegistry: canonicalDocument.desktopErrorRegistryVersion,
    freeformFormatProfileRegistry: canonicalDocument.freeformFormatProfileRegistryVersion,
    metaStatic: {
      projectPixelPresetStatus: canonicalDocument.canonicalPhaseM1.projectPixelPresetStatus,
      profiles: canonicalDocument.canonicalPhaseM1.placementSetOrder,
      placementSetContract: canonicalDocument.canonicalPhaseM1.placementSetContract,
      platformCopyPixels: canonicalDocument.canonicalPhaseM1.platformCopyPixels,
      storiesSafeZone: canonicalDocument.canonicalPhaseM1.storiesSafeZone,
      reelsSafeZone: canonicalDocument.canonicalPhaseM1.reelsSafeZone,
      manualAcceptanceStatus: canonicalDocument.canonicalPhaseM2_3.manualAcceptanceStatus,
      m2ArtifactAuditStatus: canonicalDocument.canonicalPhaseM2.artifactAuditStatus,
      m2_1VisualAuditStatus: canonicalDocument.canonicalPhaseM2_1.artifactAuditStatus,
      m2_2PlacementContextPlanImportStatus: m2_2VerificationStatus,
      goldenCandidateStatus: canonicalDocument.canonicalPhaseM2_3.goldenCandidateStatus,
      finalGoldenFrozen: canonicalDocument.canonicalPhaseM2_3.finalGoldenFrozen,
      goldenRegistryVersion: canonicalDocument.canonicalPhaseM2_3.goldenRegistryVersion,
      goldenRegistry: canonicalDocument.canonicalPhaseM2_3.goldenRegistry,
      m2_3VerificationStatus,
      freezeScope: canonicalDocument.canonicalPhaseM2_3.freezeScope,
      evidence: {
        fontInventory: m1FontInventory.status,
        validatorAudit: m1ValidatorAudit.status,
        determinism: m1Determinism.status,
        regression: m1Regression.status,
        packageSmoke: m1PackageSmoke.status,
        m2ArtifactAudit: m2ArtifactAudit.status,
        m2Regression: m2Regression.status,
        m2_1OutputConstraintProvenance: m2_1OutputConstraintProvenance.status,
        m2_1ByteAudit: m2_1ByteAudit.status,
        m2_1CropAudit: m2_1CropAudit.status,
        m2_1FormatAudit: m2_1FormatAudit.status,
        m2_1SourceRefresh: m2_1SourceRefresh.status,
        m2_1Determinism: m2_1Determinism.status,
        m2_1Regression: m2_1Regression.status,
        m2_2Inventory: m2_2Inventory.status,
        m2_2Pipeline: m2_2Pipeline.status,
        m2_2Roundtrip: m2_2Roundtrip.status,
        m2_2Square: m2_2Square.status,
        m2_2Stories: m2_2Stories.status,
        m2_2Reels: m2_2Reels.status,
        m2_2SafeZone: m2_2SafeZone.status,
        m2_2ByteAudit: m2_2ByteAudit.status,
        m2_2Determinism: m2_2Determinism.status,
        m2_2Regression: m2_2Regression.status,
        m2_2aRequestState: m2_2aEvidence["meta-desktop-request-state-audit.json"].status,
        m2_2aPreviewBuilder: m2_2aEvidence["meta-preview-request-builder.json"].status,
        m2_2aSafeZoneUi: m2_2aEvidence["meta-safe-zone-ui-matrix.json"].status,
        m2_2aPreviewErrors: m2_2aEvidence["meta-preview-error-handling.json"].status,
        m2_2aPlanManifestViewer: m2_2aEvidence["meta-plan-vs-manifest-viewer.json"].status,
        m2_2aStateSwitching: m2_2aEvidence["meta-desktop-state-switching.json"].status,
        m2_2aRegression: m2_2aEvidence["regression.json"].status,
        m2_3ManualAcceptance: m2_3Evidence["meta-user-manual-acceptance.json"].status,
        m2_3RegistryAudit: m2_3Evidence["meta-golden-freeze-registry-audit.json"].status,
        m2_3Determinism: m2_3Evidence["meta-golden-determinism.json"].status,
        m2_3ContextualGoldenAudit: m2_3Evidence["meta-contextual-golden-audit.json"].status,
        m2_3ValidatorExpectationAudit: m2_3Evidence["meta-validator-expectation-audit.json"].status,
        m2_3ByteRegression: m2_3Evidence["meta-300kb-regression.json"].status,
        m2_3Regression: m2_3Evidence["regression.json"].status,
      },
    },
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
  fontSourceMigration: {
    phase: fontSourceMigrationAudit.phase.id,
    status: fontSourceMigrationAudit.phase.status,
    json: "contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json",
    report: "docs/implementation/naver-smartchannel-macos-original-ttc-integration-n7-7-4.md",
    verifier: "scripts/verify-n7-7-4-macos-ttc-integration.mjs",
    sourceTtc: fontSourceMigrationAudit.sourceFont.file,
    sourceTtcSha256: fontSourceMigrationAudit.sourceFont.sha256,
    integrationMode: fontSourceMigrationAudit.fontBackend.integrationMode,
    templatesRendered: fontSourceMigrationAudit.smartChannel120.rendered,
    providerParity: fontSourceMigrationAudit.providerParity.status,
    deterministicRuns: fontSourceMigrationAudit.determinism.runs,
    goldenRebasePerformed: fontSourceMigrationAudit.goldenRebasePerformed,
  },
  typographyParity: {
    phase: typographyParityAudit.phase.id,
    status: typographyParityAudit.phase.status,
    json: "contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json",
    report: "docs/implementation/naver-smartchannel-typography-parity-correction-n7-7-5.md",
    verifier: "scripts/verify-n7-7-5-typography-parity.mjs",
    evidenceDirectory: "artifacts/n7-7-5",
    decisionBasis: typographyParityAudit.overflow.after.decisionBasis,
    auditedHeadlineLayers: typographyParityAudit.verticalParity.auditedVisibleNonGuideLayers,
    templatesRendered: typographyParityAudit.acceptance.smartChannelRendered,
    goldenRebasePerformed: typographyParityAudit.acceptance.goldenRebasePerformed,
  },
  textInputUiParity: {
    phase: textInputUiParityAudit.phase.id,
    status: textInputUiParityAudit.phase.status,
    json: "contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json",
    report: "docs/implementation/naver-smartchannel-280-text-input-ui-field-mapping-n7-7-6.md",
    verifier: "scripts/verify-n7-7-6-smartchannel-text-input-fields.mjs",
    evidenceDirectory: "artifacts/n7-7-6",
    derivationSource: textInputUiParityAudit.correction.desktopFieldDerivationSourceAfter,
    templates280Checked: textInputUiParityAudit.parity.templatesChecked,
    missingFields: textInputUiParityAudit.parity.missingFields,
    extraFields: textInputUiParityAudit.parity.extraFields,
    orderingErrors: textInputUiParityAudit.parity.orderingErrors,
    goldenRebasePerformed: textInputUiParityAudit.goldenRebase.performed,
  },
  goldenBaseline: {
    phase: finalBaselineAudit.phase.id,
    status: finalBaselineAudit.phase.status,
    report: "docs/implementation/naver-smartchannel-final-baseline-n7-8.md",
    verifier: "scripts/verify-n7-8-smartchannel-final-baseline.mjs",
    evidenceDirectory: "artifacts/n7-8",
    registry: "fixtures/golden/naver-smartchannel/registry.json",
    registryVersion: finalBaselineAudit.goldenTopology.registryVersion,
    representativeGoldens: goldenRebaseManifest.representativeGoldenCount,
    exhaustiveTemplates: goldenRebaseManifest.exhaustiveTemplateCount,
    intentionalChangesOnly: goldenRebaseManifest.intentionalChangesOnly,
    deterministic: goldenRebaseManifest.deterministic,
  },
  channelCompletion: {
    phase: n8Inventory.phase,
    status: n8DesktopMatrix.status === "PASS" && n8ContractParity.status === "PASS" && n8E2eSummary.status === "PASS" && n8SmartFreeze.status === "PASS" && n8Regression.status === "PASS" ? "PASS" : "FAIL",
    inventoryFormats: n8Inventory.formats.length,
    desktopFormats: n8DesktopMatrix.formats.length,
    contractParity: n8ContractParity.status,
    e2e: n8E2eSummary.status,
    outputEvidenceDirectories: n8E2eSummary.outputEvidenceDirectories.length,
    smartChannelFrozenRegression: n8SmartFreeze.status,
    nonSmartChannelRegression: n8Regression.status,
    feedVideo: n8DesktopMatrix.feedSubtypes.VIDEO,
  },
  metaArchitectureDiscovery: {
    phase: m0OfficialSourceAudit.phase,
    status: m0OfficialSourceAudit.status === "PASS" && m0CapabilityMatrix.status === "PASS" && m0PlacementMatrix.status === "PASS" && m0ReuseAudit.status === "PASS" && m0SafeZoneAudit.status === "PASS" && m0Scope.status === "PASS" ? "PASS" : "FAIL",
    officialMetaOnly: m0OfficialSourceAudit.officialMetaOnly,
    officialRules: m0OfficialSourceAudit.officialRules,
    unresolvedRules: m0OfficialSourceAudit.unresolvedCount,
    assetProfiles: m0CapabilityMatrix.assetProfiles.map((entry) => ({ id: entry.assetProfileId, ratio: entry.aspectRatio, status: entry.officialStatus, pixelSizeStatus: entry.pixelSizeStatus })),
    freeformReuse: m0ReuseAudit.overallReuse,
    storiesSafeZone: m0SafeZoneAudit.policies.find((entry) => entry.id === "META_STORIES_KEY_CONTENT_SAFE_ZONE")?.enforcement,
    reelsSafeZone: m0SafeZoneAudit.policies.find((entry) => entry.id === "META_REELS_KEY_CONTENT_SAFE_ZONE")?.status,
    runtimeImplemented: m0CapabilityMatrix.runtimeImplemented,
    desktopExposed: m0CapabilityMatrix.desktopExposed,
  },
  channels: {
    KAKAO_MOMENT: { templateLocked: "IMPLEMENTED", freeform: "IMPLEMENTED" },
    NAVER_GFA: { smartChannel120: "IMPLEMENTED", freeform: "IMPLEMENTED", platformComposedSource: "FROZEN_SOURCE_ONLY", feedCollectionSourceArtifacts: "IMPLEMENTED", desktopIntegration: "IMPLEMENTED", finalNativeUi: "NOT_IMPLEMENTED", video: "DISABLED_OUT_OF_STATIC_SCOPE" },
    META: { staticProfiles: "IMPLEMENTED", placementSet: "IMPLEMENTED", platformCopy: "METADATA_ONLY", unsupported: canonicalDocument.canonicalPhaseM1.unsupportedRuntime },
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
    n7_7_4FontSourceMigrationJson: "contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json",
    n7_7_4FontSourceMigrationReport: "docs/implementation/naver-smartchannel-macos-original-ttc-integration-n7-7-4.md",
    n7_7_4FontSourceMigrationVerifier: "scripts/verify-n7-7-4-macos-ttc-integration.mjs",
    n7_7_4EvidenceDirectory: "artifacts/n7-7-4",
    n7_7_5TypographyParityJson: "contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json",
    n7_7_5TypographyParityReport: "docs/implementation/naver-smartchannel-typography-parity-correction-n7-7-5.md",
    n7_7_5TypographyParityVerifier: "scripts/verify-n7-7-5-typography-parity.mjs",
    n7_7_5EvidenceDirectory: "artifacts/n7-7-5",
    n7_7_6TextInputUiParityJson: "contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json",
    n7_7_6TextInputUiParityReport: "docs/implementation/naver-smartchannel-280-text-input-ui-field-mapping-n7-7-6.md",
    n7_7_6TextInputUiParityVerifier: "scripts/verify-n7-7-6-smartchannel-text-input-fields.mjs",
    n7_7_6EvidenceDirectory: "artifacts/n7-7-6",
    n7_8FinalBaselineAudit: "contracts/audits/naver-smartchannel-final-baseline-n7-8.json",
    n7_8FinalBaselineReport: "docs/implementation/naver-smartchannel-final-baseline-n7-8.md",
    n7_8FinalBaselineVerifier: "scripts/verify-n7-8-smartchannel-final-baseline.mjs",
    n7_8EvidenceDirectory: "artifacts/n7-8",
    n7_8GoldenRegistry: "fixtures/golden/naver-smartchannel/registry.json",
    n8Inventory: "artifacts/n8/naver-capability-inventory.json",
    n8DesktopMatrix: "artifacts/n8/naver-desktop-format-matrix.json",
    n8ContractParity: "artifacts/n8/naver-format-contract-parity.json",
    n8E2eSummary: "artifacts/n8/naver-e2e-summary.json",
    n8EvidenceDirectory: "artifacts/n8",
    n8ImplementationRecord: "docs/implementation/naver-channel-completion-n8.md",
    n8Verifier: "scripts/verify-n8-channel-completion.mjs",
    m0OfficialSourceRegistry: "contracts/audits/meta-official-source-registry.json",
    m0EvidenceDirectory: "artifacts/m0",
    m0ImplementationRecord: "docs/implementation/meta-static-renderer-architecture-m0.md",
    m0ArchitectureAdr: "docs/adr/ADR-0057-meta-static-creative-composition-boundary.md",
    m0SourceGuideIndex: "source-guides/meta/m0/official-source-index.md",
    m0Verifier: "scripts/verify-m0-meta-architecture.mjs",
    m1OfficialSourceRefresh: "artifacts/m1/meta-official-source-refresh.json",
    m1PixelPresets: "artifacts/m1/meta-project-pixel-presets.json",
    m1FontInventory: "artifacts/m1/meta-freeform-font-inventory.json",
    m1DesktopParity: "artifacts/m1/meta-desktop-contract-parity.json",
    m1ValidatorAudit: "artifacts/m1/meta-validator-audit.json",
    m1Determinism: "artifacts/m1/meta-determinism.json",
    m1PlacementSetAudit: "artifacts/m1/meta-placement-set-audit.json",
    m1Regression: "artifacts/m1/meta-regression.json",
    m1PackageSmoke: "artifacts/m1/meta-package-smoke.json",
    m1ImplementationRecord: "docs/implementation/meta-static-asset-profiles-placement-set-renderer-m1.md",
    m1Verifier: "scripts/verify-m1-meta-static.mjs",
    m2ArtifactAudit: "artifacts/m2/meta-artifact-audit.json",
    m2ArtifactInventory: "artifacts/m2/meta-m1-artifact-inventory.json",
    m2CandidateRegistry: "contracts/audits/meta-golden-candidates-m2.json",
    m2ManualReviewPackage: "artifacts/m2/manual-review",
    m2GoldenCandidates: "artifacts/m2/golden-candidates",
    m2ImplementationRecord: "docs/implementation/meta-artifact-audit-golden-candidates-m2.md",
    m2Verifier: "scripts/verify-m2-meta-static.mjs",
    m2_1OutputConstraintProvenance: "artifacts/m2-1/meta-output-constraint-provenance.json",
    m2_1ByteAudit: "artifacts/m2-1/meta-300kb-rule-audit.json",
    m2_1CropAudit: "artifacts/m2-1/meta-manual-crop-candidate-audit.json",
    m2_1FormatAudit: "artifacts/m2-1/meta-output-format-audit.json",
    m2_1ValidatorIsolation: "artifacts/m2-1/meta-validator-isolation.json",
    m2_1OfficialSourceRefresh: "artifacts/m2-1/meta-official-source-refresh.json",
    m2_1Determinism: "artifacts/m2-1/meta-determinism.json",
    m2_1Regression: "artifacts/m2-1/meta-regression.json",
    m2_1ManualReviewPackage: "artifacts/m2-1/manual-review",
    m2_1CandidateRegistry: "contracts/audits/meta-golden-candidates-m2-1.json",
    m2_1ImplementationRecord: "docs/implementation/meta-visual-candidate-correction-output-compliance-m2-1.md",
    m2_1Verifier: "scripts/verify-m2-1-meta.mjs",
    m2_1SourceOriginal: "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source-original.jpg",
    m2_1SourceDerived: "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg",
    m2_2ContextInventory: "artifacts/m2-2/meta-placement-context-contract-inventory.json",
    m2_2ImportPipeline: "artifacts/m2-2/freeform-plan-import-pipeline.json",
    m2_2RoundtripAudit: "artifacts/m2-2/meta-plan-roundtrip-audit.json",
    m2_2SquareReproduction: "artifacts/m2-2/meta-square-import-reproduction.json",
    m2_2StoriesPropagation: "artifacts/m2-2/meta-stories-context-propagation.json",
    m2_2ReelsPropagation: "artifacts/m2-2/meta-reels-context-propagation.json",
    m2_2SafeZoneAudit: "artifacts/m2-2/meta-safe-zone-target-audit.json",
    m2_2ByteRegression: "artifacts/m2-2/meta-300kb-regression.json",
    m2_2Determinism: "artifacts/m2-2/meta-determinism.json",
    m2_2Regression: "artifacts/m2-2/regression.json",
    m2_2ManualReviewPackage: "artifacts/m2-2/manual-review",
    m2_2CandidateRegistry: "contracts/audits/meta-golden-candidates-m2-2.json",
    m2_2ImplementationRecord: "docs/implementation/meta-placement-context-plan-import-consistency-m2-2.md",
    m2_2Generator: "scripts/generate-m2-2-meta-candidates.mjs",
    m2_2Verifier: "scripts/verify-m2-2-meta.mjs",
    m2_2aEvidenceDirectory: "artifacts/m2-2a",
    m2_2aRequestStateAudit: "artifacts/m2-2a/meta-desktop-request-state-audit.json",
    m2_2aPreviewRequestBuilder: "artifacts/m2-2a/meta-preview-request-builder.json",
    m2_2aSafeZoneUiMatrix: "artifacts/m2-2a/meta-safe-zone-ui-matrix.json",
    m2_2aPreviewErrorHandling: "artifacts/m2-2a/meta-preview-error-handling.json",
    m2_2aPlanManifestViewer: "artifacts/m2-2a/meta-plan-vs-manifest-viewer.json",
    m2_2aStateSwitching: "artifacts/m2-2a/meta-desktop-state-switching.json",
    m2_2aRegression: "artifacts/m2-2a/regression.json",
    m2_2aImplementationRecord: "docs/implementation/meta-desktop-qa-request-context-preview-bridge-m2-2a.md",
    m2_2aVerifier: "scripts/verify-m2-2a-meta.mjs",
    m2_2aGenerator: "scripts/generate-m2-2a-meta-evidence.mjs",
    m2_3GoldenRegistry: "contracts/goldens/meta-static-goldens.json",
    m2_3EvidenceDirectory: "artifacts/m2-3",
    m2_3ManualAcceptance: "artifacts/m2-3/meta-user-manual-acceptance.json",
    m2_3RegistryAudit: "artifacts/m2-3/meta-golden-freeze-registry-audit.json",
    m2_3Determinism: "artifacts/m2-3/meta-golden-determinism.json",
    m2_3ContextualGoldenAudit: "artifacts/m2-3/meta-contextual-golden-audit.json",
    m2_3ValidatorExpectationAudit: "artifacts/m2-3/meta-validator-expectation-audit.json",
    m2_3ByteRegression: "artifacts/m2-3/meta-300kb-regression.json",
    m2_3Regression: "artifacts/m2-3/regression.json",
    m2_3ImplementationRecord: "docs/implementation/meta-user-visual-acceptance-golden-freeze-m2-3.md",
    m2_3Verifier: "scripts/verify-m2-3-meta-goldens.mjs",
    m2_3Generator: "scripts/generate-m2-3-meta-goldens.mjs",
    g0GoogleArchitecture: "contracts/google/architecture.g0.json",
    g0GoogleCapabilities: "contracts/google/capabilities.g0.json",
    g0GoogleAssetGeometry: "contracts/google/asset-geometry.g0.json",
    g0GoogleDeliveryContracts: "contracts/google/delivery-contracts.g0.json",
    g0GoogleProvenance: "contracts/google/provenance.g0.json",
    g0GoogleDiagnostics: "contracts/google/diagnostics.g0.json",
    g0GoogleEvidenceDirectory: "artifacts/g0",
    g0GoogleVerification: "artifacts/g0/google-static-discovery-verification.json",
    g0GoogleImplementationRecord: "docs/implementation/google-ads-static-discovery-architecture-g0.md",
    g0GoogleAdr: "docs/adr/ADR-0058-google-static-capability-boundary-g0.md",
    g0GoogleVerifier: "scripts/verify-g0-google-static.mjs",
    g0_1GoogleFreezeRegistry: "contracts/google/architecture-freeze.g0.1.json",
    g0_1GoogleEvidenceDirectory: "artifacts/g0-1",
    g0_1GoogleVerification: "artifacts/g0-1/google-static-architecture-freeze-verification.json",
    g0_1GoogleImplementationRecord: "docs/implementation/google-ads-static-architecture-freeze-g0-1.md",
    g0_1GoogleAdr: "docs/adr/ADR-0059-google-static-architecture-freeze-g0-1.md",
    g0_1GoogleVerifier: "scripts/verify-g0-1-google-architecture-freeze.mjs",
    g1GoogleProfileRegistry: "contracts/google/static-asset-profiles.g1.json",
    g1GoogleCapabilityRoleMapping: "contracts/google/capability-asset-role-mapping.g1.json",
    g1GoogleTargetConstraints: "contracts/google/target-constraints.g1.json",
    g1GoogleManifestSchema: "contracts/google/creative-asset-set-manifest.schema.json",
    g1GoogleDeliveryValidator: "contracts/google/delivery-set-validator.g1.json",
    g1GoogleDiagnostics: "contracts/google/diagnostics.g1.json",
    g1GoogleEvidenceDirectory: "artifacts/g1",
    g1GoogleVerification: "artifacts/g1/google-static-contracts-profile-verification.json",
    g1GoogleImplementationRecord: "docs/implementation/google-ads-static-contracts-profile-implementation-g1.md",
    g1GoogleAdr: "docs/adr/ADR-0060-google-static-contracts-and-profiles-g1.md",
    g1GoogleVerifier: "scripts/verify-g1-google-static.mjs",
  },
  m2MetaArtifactAudit: {
    status: m2ArtifactAudit.status,
    manualAcceptanceStatus: m2CandidateRegistry.manualAcceptanceStatus,
    goldenCandidateStatus: m2CandidateRegistry.status,
    finalGoldenFrozen: m2CandidateRegistry.finalGoldenFrozen,
    candidateCount: m2CandidateRegistry.candidates.length,
    artifactAudit: "artifacts/m2/meta-artifact-audit.json",
    candidateRegistry: "contracts/audits/meta-golden-candidates-m2.json",
    reviewPackage: "artifacts/m2/manual-review",
    regression: m2Regression.status,
  },
  m2_1MetaVisualAudit: {
    status: m2_1CropAudit.status,
    outputConstraintProvenance: m2_1OutputConstraintProvenance.status,
    old300KbRuleReproduction: m2_1ByteAudit.oldRuleReproduction?.reproducedCode ?? null,
    correctedMetaFileSizeError: m2_1ByteAudit.correctedRule?.fileSizeExceededError ?? null,
    outputFormatAudit: m2_1FormatAudit.status,
    officialSourceRefresh: m2_1SourceRefresh.status,
    exactMaximumBytes: m2_1SourceRefresh.exactMaximumBytes,
    determinism: m2_1Determinism.status,
    regression: m2_1Regression.status,
    candidateCount: m2_1CandidateRegistry.candidates.length,
    candidateStatus: m2_1CandidateRegistry.status,
    manualAcceptanceStatus: m2_1CandidateRegistry.manualAcceptanceStatus,
    finalGoldenFrozen: m2_1CandidateRegistry.finalGoldenFrozen,
    reviewPackage: "artifacts/m2-1/manual-review",
    candidateRegistry: "contracts/audits/meta-golden-candidates-m2-1.json",
  },
  m2_2MetaPlacementContextPlanImport: {
    status: m2_2VerificationStatus,
    contextOwner: "RENDER_REQUEST",
    planContextAllowed: false,
    verticalNoContext: "DEFAULT_NONE",
    squarePolicy: m2_2Square.renderedPolicy,
    squareFitMode: m2_2Square.renderedFitMode,
    squareFullBleed: m2_2Square.fullBleed,
    storiesContext: m2_2Stories.resolvedContext,
    reelsContext: m2_2Reels.resolvedContext,
    reelsSourceRequiredInfo: m2_2Reels.sourceRequiredInfo,
    stale300000RulePresent: m2_2ByteAudit.stale300000RulePresent,
    determinism: m2_2Determinism.status,
    regression: m2_2Regression.status,
    manualAcceptanceStatus: m2_2CandidateRegistry.manualAcceptanceStatus,
    goldenCandidateStatus: m2_2CandidateRegistry.status,
    finalGoldenFrozen: m2_2CandidateRegistry.finalGoldenFrozen,
    candidateCount: m2_2CandidateRegistry.candidates.length,
    reviewPackage: "artifacts/m2-2/manual-review",
    candidateRegistry: "contracts/audits/meta-golden-candidates-m2-2.json",
    implementationRecord: "docs/implementation/meta-placement-context-plan-import-consistency-m2-2.md",
    verifier: "scripts/verify-m2-2-meta.mjs",
  },
  m2_2aMetaDesktopQa: {
    status: m2_2aVerificationStatus,
    requestState: m2_2aEvidence["meta-desktop-request-state-audit.json"].status,
    previewRequestBuilder: m2_2aEvidence["meta-preview-request-builder.json"].status,
    safeZoneUiMatrix: m2_2aEvidence["meta-safe-zone-ui-matrix.json"].status,
    previewErrorHandling: m2_2aEvidence["meta-preview-error-handling.json"].status,
    planManifestViewer: m2_2aEvidence["meta-plan-vs-manifest-viewer.json"].status,
    stateSwitching: m2_2aEvidence["meta-desktop-state-switching.json"].status,
    regression: m2_2aEvidence["regression.json"].status,
    silentNoOpCount: m2_2aEvidence["meta-preview-error-handling.json"].silentNoOpCount,
    manualAcceptanceStatus: canonicalDocument.canonicalPhaseM2_2a.manualAcceptanceStatus,
    goldenCandidateStatus: canonicalDocument.canonicalPhaseM2_2a.goldenCandidateStatus,
    finalGoldenFrozen: canonicalDocument.canonicalPhaseM2_2a.finalGoldenFrozen,
    evidenceDirectory: "artifacts/m2-2a",
    implementationRecord: "docs/implementation/meta-desktop-qa-request-context-preview-bridge-m2-2a.md",
    verifier: "scripts/verify-m2-2a-meta.mjs",
  },
  m2_3MetaGoldenFreeze: {
    status: m2_3VerificationStatus,
    manualAcceptanceStatus: m2_3GoldenRegistry.manualAcceptance.status,
    goldenCandidateStatus: m2_3GoldenRegistry.status,
    finalGoldenFrozen: m2_3GoldenRegistry.finalGoldenFrozen,
    goldenRegistryVersion: m2_3GoldenRegistry.registryVersion,
    goldenRegistry: "contracts/goldens/meta-static-goldens.json",
    approvedGoldenCount: m2_3GoldenRegistry.entries.length,
    storiesSafeZone: m2_3GoldenRegistry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.stories ?? null,
    reelsSafeZone: m2_3GoldenRegistry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.reels ?? null,
    stale300000RulePresent: false,
    exactMaxBytesStatus: "NO_EXACT_MAX_PINNED",
    evidenceDirectory: "artifacts/m2-3",
    implementationRecord: "docs/implementation/meta-user-visual-acceptance-golden-freeze-m2-3.md",
    verifier: "scripts/verify-m2-3-meta-goldens.mjs",
  },
  g0GoogleStaticDiscovery: {
    phase: g0GoogleArchitecture.phase,
    status: g0GoogleVerificationStatus,
    architectureStatus: g0GoogleArchitecture.status,
    repositoryApplication: g0GoogleArchitecture.repositoryApplication,
    baselineCommit: g0GoogleArchitecture.baseline.sourceCommitSha,
    sourcePolicy: g0GoogleProvenance.sourcePolicy,
    sourceCount: g0GoogleProvenance.sources.length,
    unresolvedRuleCount: g0GoogleProvenance.unresolvedRules.length,
    capabilityCount: g0GoogleCapabilities.capabilities.length,
    artifactCardinality: "SINGLE",
    deliveryCardinality: "COLLECTION",
    demandGenUploadedPresetCount: g0GoogleAssetGeometry.uploadedDisplayPresets.demandGenRecommendedSubset.length,
    legacyDisplayCanvasCount: g0GoogleAssetGeometry.uploadedDisplayPresets.legacyDisplaySupportedCanvases.length,
    diagnosticsStatus: g0GoogleDiagnostics.status,
    diagnosticsActive: g0GoogleDiagnostics.activeRuntimeRegistration,
    runtimeProfilesAdded: g0GoogleArchitecture.implementation.runtimeProfilesAdded,
    rendererCodeAdded: g0GoogleArchitecture.implementation.rendererCodeAdded,
    validatorRuntimeAdded: g0GoogleArchitecture.implementation.validatorRuntimeAdded,
    goldensAdded: g0GoogleArchitecture.implementation.goldensAdded,
    desktopUiAdded: g0GoogleArchitecture.implementation.desktopUiAdded,
    uploadIntegrationAdded: g0GoogleArchitecture.implementation.uploadIntegrationAdded,
    runtimeNetworkAccess: g0GoogleArchitecture.implementation.runtimeNetworkAccess,
    plumeDependencies: g0GoogleArchitecture.implementation.plumeDependencies,
    architectureRecord: "contracts/google/architecture.g0.json",
    capabilityRegistry: "contracts/google/capabilities.g0.json",
    assetGeometryRegistry: "contracts/google/asset-geometry.g0.json",
    deliveryContracts: "contracts/google/delivery-contracts.g0.json",
    provenance: "contracts/google/provenance.g0.json",
    diagnostics: "contracts/google/diagnostics.g0.json",
    evidence: "artifacts/g0/google-static-discovery-verification.json",
    implementationRecord: "docs/implementation/google-ads-static-discovery-architecture-g0.md",
    adr: "docs/adr/ADR-0058-google-static-capability-boundary-g0.md",
    nextPhase: "G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION",
  },
  g0_1GoogleArchitectureFreeze: {
    phase: g0_1GoogleFreezeRegistry.phase,
    status: g0_1GoogleVerificationStatus,
    architectureStatus: g0_1GoogleFreezeRegistry.status,
    architectureVersion: g0_1GoogleFreezeRegistry.googleArchitectureVersion,
    previousArchitectureVersion: g0_1GoogleFreezeRegistry.sourceArchitectureVersion,
    acceptedFromCommit: g0_1GoogleFreezeRegistry.acceptedFromCommit,
    counts: g0_1GoogleFreezeRegistry.counts,
    authoritativeRecordCount: g0_1GoogleFreezeRegistry.authoritativeRecords.length,
    registry: "contracts/google/architecture-freeze.g0.1.json",
    evidence: "artifacts/g0-1/google-static-architecture-freeze-verification.json",
    implementationRecord: "docs/implementation/google-ads-static-architecture-freeze-g0-1.md",
    adr: "docs/adr/ADR-0059-google-static-architecture-freeze-g0-1.md",
    verifier: "scripts/verify-g0-1-google-architecture-freeze.mjs",
    runtimeProfilesAdded: false,
    rendererCodeAdded: false,
    validatorRuntimeAdded: false,
    goldensAdded: false,
    desktopUiAdded: false,
    uploadIntegrationAdded: false,
    runtimeNetworkAccess: "PROHIBITED",
    plumeDependencies: [],
    frozenChannelOutputChanges: 0,
    g1GateStatus: g0_1GoogleFreezeRegistry.g1GateStatus,
  },
  g1GoogleStaticContracts: {
    phase: g1GoogleVersion.phase,
    status: g1GoogleVerificationStatus,
    architectureVersion: g1GoogleVersion.googleArchitectureVersion,
    contractVersion: g1GoogleVersion.googleStaticContractVersion,
    profileRegistryVersion: g1GoogleVersion.googleStaticProfileRegistryVersion,
    profileCount: g1GoogleProfiles.profileCount,
    geometryProfileCount: g1GoogleProfiles.geometryProfileCount,
    uploadedDisplayStaticProfileCount: g1GoogleProfiles.uploadedDisplayStaticProfileCount,
    legacyDisplayRuntimeProfiles: g1GoogleProfiles.legacyDisplayRuntimeProfiles.length,
    capabilityCount: g1GoogleMapping.capabilityCount,
    validators: g1GoogleVersion.googleDeliverySetValidator,
    diagnostics: g1GoogleDiagnostics.count,
    byteUnit: g1GoogleConstraints.byteUnit,
    runtimeNetworkAccess: "PROHIBITED",
    plumeDependencies: [],
    desktopUiAdded: false,
    goldensAdded: false,
    uploadIntegrationAdded: false,
    registry: g1GoogleVersion.googleStaticProfileRegistry,
    capabilityRoleMapping: g1GoogleVersion.googleCapabilityRoleMapping,
    targetConstraints: g1GoogleVersion.googleTargetConstraints,
    manifestSchema: g1GoogleVersion.googleCreativeAssetSetManifestSchema,
    deliveryValidator: g1GoogleVersion.googleDeliverySetValidator,
    diagnosticsRegistry: g1GoogleVersion.googleDiagnostics,
    evidence: "artifacts/g1/google-static-contracts-profile-verification.json",
    implementationRecord: "docs/implementation/google-ads-static-contracts-profile-implementation-g1.md",
    adr: "docs/adr/ADR-0060-google-static-contracts-and-profiles-g1.md",
    verifier: "scripts/verify-g1-google-static.mjs",
    nextPhase: g1GoogleVersion.nextPhase,
  },
  externalRuntimeDependencies: [],
  excludedGeneratedDependencies: ["node_modules", "dist", "dist-desktop", "release", "coverage", "test-results", ".cache", ".out-staging", ".git"],
  runtimeNetworkAccess: "PROHIBITED",
  smartchannelPsdCount,
  fontBinariesBundled: true,
};
await writeFile(path.join(target, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ target, sourceSha, smartchannelPsdCount, fileCount: files.length, canonicalSha256: manifest.canonicalDocument.sha256 }, null, 2));
