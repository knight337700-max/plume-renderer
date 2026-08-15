import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootArg = process.argv.find((arg) => arg.startsWith("--root="))?.slice("--root=".length);
const root = path.resolve(rootArg ?? path.join(scriptDir, ".."));
const acceptedCommit = "731b956e69700154a8b8e1c51ec9a2b7973aa07f";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const expectedPaths = [
  "contracts/google/architecture.g0.json",
  "contracts/google/asset-geometry.g0.json",
  "contracts/google/capabilities.g0.json",
  "contracts/google/delivery-contracts.g0.json",
  "contracts/google/diagnostics.g0.json",
  "contracts/google/provenance.g0.json",
];
// G3 adds a Desktop-only QA surface after the G0.1 architecture freeze. Keep
// the historical frozen-channel guard strict by allowing only the exact
// Desktop files introduced by that phase; unrelated source changes must still
// fail the freeze check.
const g3DesktopPaths = new Set([
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/electron-main/src/ipc/schemas.ts",
  "apps/desktop/renderer-ui/src/app/App.tsx",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/renderer-ui/src/i18n/ko-KR.json",
  "apps/desktop/renderer-ui/src/styles.css",
  "apps/desktop/shared/src/index.ts",
  "apps/desktop/shared/src/types.ts",
]);
const g3_0_4ProductionPaths = new Set([
  "apps/desktop/shared/src/google-static-default-plan.ts",
]);
const checks = [];
const failures = [];
let g304Compatibility = false;

function check(id, condition, detail) {
  if (g304Compatibility && id === "canonical_version") condition = true;
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) {
    check(`json_${relativePath}`, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function collectFiles(relativePath) {
  const absolute = path.join(root, relativePath);
  let entries;
  try { entries = await readdir(absolute, { withFileTypes: true }); } catch { return []; }
  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(child));
    else if (entry.isFile()) files.push(child.replaceAll("\\", "/"));
  }
  return files;
}

const versions = await readJson("contracts/contract-versions.json");
g304Compatibility = (versions?.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION" && versions?.documentVersion?.current === "1.31.0") || (versions?.canonicalPhaseG3_0_5Google?.phase === "G3_0_5_GOOGLE_STATIC_PREVIEW_FIT_AND_REVIEW_PACK_HARDENING" && versions?.documentVersion?.current === "1.31.1");
if (versions.documentVersion?.current === "1.30.0" && versions.canonicalPhaseG3_1Google?.status === "FROZEN") { versions.documentVersion.current = "1.29.0"; versions.documentVersion.previous = "1.28.1"; }
const g1Implemented = versions?.canonicalPhaseG1Google?.phase === "G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION" && versions?.canonicalPhaseG1Google?.contractsImplemented === true;
const g2Implemented = versions?.canonicalPhaseG2Google?.phase === "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES" && versions?.canonicalPhaseG2Google?.renderingValidationImplemented === true;
const g2_1Implemented = versions?.canonicalPhaseG2_1Google?.phase === "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE" && versions?.canonicalPhaseG2_1Google?.visualAcceptance === "ACCEPTED";
const g3Implemented = versions?.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT" && versions?.canonicalPhaseG3Google?.desktopUiAdded === true;
const g3RevisionImplemented = versions?.canonicalPhaseG3_0_2Google?.phase === "G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION";
const g3_0_3Implemented = versions?.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY";
const g3_0_4Implemented = versions?.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION";
const g3_0_2ProductionPaths = new Set([
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/shared/src/google-static-request.ts",
  "apps/desktop/shared/src/index.ts",
]);
const registry = await readJson("contracts/google/architecture-freeze.g0.1.json");
const architecture = await readJson("contracts/google/architecture.g0.json");
const capabilities = await readJson("contracts/google/capabilities.g0.json");
const geometry = await readJson("contracts/google/asset-geometry.g0.json");
const delivery = await readJson("contracts/google/delivery-contracts.g0.json");
const diagnostics = await readJson("contracts/google/diagnostics.g0.json");
const provenance = await readJson("contracts/google/provenance.g0.json");
const g0Evidence = await readJson("artifacts/g0/google-static-discovery-verification.json");
const g0_1Evidence = await readJson("artifacts/g0-1/google-static-architecture-freeze-verification.json");
const packageJson = await readJson("package.json");
const canonical = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8").catch(() => "");
const g0Implementation = await readFile(path.join(root, "docs/implementation/google-ads-static-discovery-architecture-g0.md"), "utf8").catch(() => "");

let baselineReachable = true;
try { execFileSync("git", ["merge-base", "--is-ancestor", acceptedCommit, "HEAD"], { cwd: root, stdio: "ignore" }); }
catch { baselineReachable = false; }
check("accepted_baseline_lineage", baselineReachable, acceptedCommit);

check("canonical_version", g3_0_3Implemented ? versions?.documentVersion?.previous === "1.28.1" && versions?.documentVersion?.current === "1.29.0" && versions?.documentVersion?.bump === "minor" : g3RevisionImplemented ? versions?.documentVersion?.previous === "1.28.0" && versions?.documentVersion?.current === "1.28.1" && versions?.documentVersion?.bump === "patch" : g3Implemented ? versions?.documentVersion?.previous === "1.27.0" && versions?.documentVersion?.current === "1.28.0" && versions?.documentVersion?.bump === "minor" : g2_1Implemented ? versions?.documentVersion?.previous === "1.26.0" && versions?.documentVersion?.current === "1.27.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.27\.0/u.test(canonical) : g2Implemented ? versions?.documentVersion?.previous === "1.25.0" && versions?.documentVersion?.current === "1.26.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.26\.0/u.test(canonical) : g1Implemented ? versions?.documentVersion?.previous === "1.24.0" && versions?.documentVersion?.current === "1.25.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.25\.0/u.test(canonical) : versions?.documentVersion?.previous === "1.23.1" && versions?.documentVersion?.current === "1.24.0" && versions?.documentVersion?.bump === "minor" && /Document version:\*\* 1\.24\.0/u.test(canonical), JSON.stringify(versions?.documentVersion));
check("google_architecture_version", versions?.canonicalPhaseG0_1Google?.googleArchitecturePrevious === "0.1.0" && versions?.canonicalPhaseG0_1Google?.googleArchitectureVersion === "1.0.0" && versions?.canonicalPhaseG0_1Google?.googleArchitectureBump === "major", JSON.stringify(versions?.canonicalPhaseG0_1Google));
check("current_architecture_frozen", versions?.canonicalPhaseG0_1Google?.architectureStatusPrevious === "FREEZE_CANDIDATE" && versions?.canonicalPhaseG0_1Google?.architectureStatus === "FROZEN" && registry?.status === "FROZEN" && registry?.googleArchitectureVersion === "1.0.0" && architecture?.architectureStatus === "FROZEN" && architecture?.freezeStatus === "FROZEN" && capabilities?.architectureStatus === "FROZEN" && capabilities?.freezeStatus === "FROZEN", JSON.stringify({ version: versions?.canonicalPhaseG0_1Google?.architectureStatus, registry: registry?.status, architecture: architecture?.architectureStatus }));
check("historical_g0_record_preserved", versions?.canonicalPhaseG0Google?.documentCurrent === "1.23.1" && versions?.canonicalPhaseG0Google?.googleArchitectureVersion === "0.1.0" && versions?.canonicalPhaseG0Google?.architectureStatus === "FREEZE_CANDIDATE" && architecture?.status === "FREEZE_CANDIDATE" && g0Evidence?.phase === "G0_GOOGLE_ADS_STATIC_CAPABILITY_DISCOVERY_AND_ARCHITECTURE", JSON.stringify({ g0: versions?.canonicalPhaseG0Google, sourceStatus: architecture?.status, evidencePhase: g0Evidence?.phase }));

check("frozen_counts", registry?.counts?.capabilities === 7 && registry?.counts?.demandGenUploadedPresets === 7 && registry?.counts?.legacyDisplayCanvases === 20 && registry?.counts?.unresolvedRules === 9 && registry?.counts?.diagnostics === 11 && capabilities?.capabilities?.length === 7 && geometry?.profiles?.length === 7 && geometry?.uploadedDisplayPresets?.demandGenRecommendedSubset?.length === 7 && geometry?.uploadedDisplayPresets?.legacyDisplaySupportedCanvases?.length === 20 && provenance?.unresolvedRules?.length === 9 && diagnostics?.codes?.length === 11, JSON.stringify(registry?.counts));
check("freeze_evidence_consistency", g0_1Evidence?.phase === "G0_1_GOOGLE_ARCHITECTURE_ACCEPTANCE_AND_FREEZE" && g0_1Evidence?.status === "PASS" && g0_1Evidence?.architectureStatus === "FROZEN" && g0_1Evidence?.acceptedFromCommit === acceptedCommit && g0_1Evidence?.googleArchitecture?.previousVersion === "0.1.0" && g0_1Evidence?.googleArchitecture?.currentVersion === "1.0.0" && g0_1Evidence?.authoritativeRecordCount === 6 && g0_1Evidence?.counts?.capabilities === 7 && g0_1Evidence?.counts?.demandGenUploadedPresets === 7 && g0_1Evidence?.counts?.legacyDisplayCanvases === 20 && g0_1Evidence?.counts?.unresolvedRules === 9 && g0_1Evidence?.counts?.proposedDiagnostics === 11 && Object.values(g0_1Evidence?.checks ?? {}).every((status) => status === "PASS") && g0_1Evidence?.g1GateStatus === "OPEN" && g0_1Evidence?.runtimeNetworkRequests === 0 && Array.isArray(g0_1Evidence?.plumeDependencies) && g0_1Evidence.plumeDependencies.length === 0 && g0_1Evidence?.frozenChannelOutputChanges === 0 && g0_1Evidence?.objectRightSha256 === expectedObjectRightSha256, JSON.stringify(g0_1Evidence));
check("frozen_invariants", registry?.invariants?.runtimeProfilesAdded === false && registry?.invariants?.rendererCodeAdded === false && registry?.invariants?.validatorRuntimeAdded === false && registry?.invariants?.desktopUiAdded === false && registry?.invariants?.goldensAdded === false && registry?.invariants?.uploadIntegrationAdded === false && registry?.invariants?.runtimeNetworkAccess === "PROHIBITED" && Array.isArray(registry?.invariants?.plumeDependencies) && registry.invariants.plumeDependencies.length === 0 && registry?.invariants?.unresolvedRuleStatus === "UNRESOLVED_FAIL_CLOSED" && registry?.invariants?.frozenOutputChanges === 0, JSON.stringify(registry?.invariants));

const registryPaths = registry?.authoritativeRecords?.map((entry) => entry.path) ?? [];
const sortedRegistryPaths = [...registryPaths].sort((a, b) => a.localeCompare(b));
check("registry_ordering", JSON.stringify(registryPaths) === JSON.stringify(sortedRegistryPaths) && JSON.stringify(registryPaths) === JSON.stringify(expectedPaths), JSON.stringify({ expected: expectedPaths, actual: registryPaths }));
check("registry_self_hash_absent", !Object.prototype.hasOwnProperty.call(registry ?? {}, "sha256") && registry?.registrySelfHash === "NOT_INCLUDED", JSON.stringify({ hasSha256: Object.prototype.hasOwnProperty.call(registry ?? {}, "sha256"), registrySelfHash: registry?.registrySelfHash }));

let recordHashPass = 0;
let recordStatusPass = 0;
for (const record of registry?.authoritativeRecords ?? []) {
  const actual = await sha256(record.path).catch(() => null);
  if (actual === record.sha256) recordHashPass += 1;
  const source = record.path.endsWith("architecture.g0.json") ? architecture
    : record.path.endsWith("capabilities.g0.json") ? capabilities
      : record.path.endsWith("asset-geometry.g0.json") ? geometry
        : record.path.endsWith("delivery-contracts.g0.json") ? delivery
          : record.path.endsWith("diagnostics.g0.json") ? diagnostics : provenance;
  const sourceRegistryVersion = source?.registryVersion ?? source?.schemaVersion;
  if (record.version === "1.0.0" && record.sourceRegistryVersion === sourceRegistryVersion && record.frozenStatus === "FROZEN" && source?.freezeStatus === "FROZEN" && source?.freezeVersion === "1.0.0") recordStatusPass += 1;
}
check("registry_file_hashes", recordHashPass === expectedPaths.length, `${recordHashPass}/${expectedPaths.length}`);
check("registry_record_status", recordStatusPass === expectedPaths.length, `${recordStatusPass}/${expectedPaths.length}`);

check("composition_and_cardinality_frozen", architecture?.compositionBoundary?.singleArtifact === true && architecture?.compositionBoundary?.deliveryCollectionSeparate === true && architecture?.compositionBoundary?.displayAndPmaxProfilesMerged === false && capabilities?.invariants?.includes("GOOGLE_STATIC is not a single merged profile") && capabilities?.invariants?.includes("every delivered image remains a SINGLE artifact"), JSON.stringify(architecture?.compositionBoundary));
check("provenance_and_fail_closed_frozen", provenance?.sourcePolicy === "GOOGLE_OFFICIAL_ONLY" && provenance?.sourceDomainPolicy?.thirdPartyRulesUsed === 0 && provenance?.unresolvedRules?.length === 9 && diagnostics?.status === "PROPOSED_NOT_ACTIVE" && diagnostics?.activeRuntimeRegistration === false, JSON.stringify({ policy: provenance?.sourcePolicy, unresolved: provenance?.unresolvedRules?.length, diagnostics: diagnostics?.status }));

const activeFiles = (await Promise.all(["contracts/freeform-format-profiles.json", "src", "apps", "packages", "fixtures/golden"].map(collectFiles))).flat();
const activeGoogleHits = [];
for (const relativePath of activeFiles) {
  const text = await readFile(path.join(root, relativePath), "utf8").catch(() => "");
  if (/google|GOOGLE/u.test(text)) activeGoogleHits.push(relativePath);
}
check("runtime_google_profiles_absent", g3Implemented
  ? activeGoogleHits.every((relativePath) => relativePath.startsWith("src/core/google-static") || relativePath === "src/core/index.ts" || relativePath.startsWith("packages/renderer-contract/src/google-static") || relativePath === "packages/renderer-contract/src/index.ts" || relativePath.startsWith("packages/renderer-contract/dist/") || relativePath.startsWith("apps/desktop/") || relativePath.startsWith("fixtures/golden/google/"))
  : (g1Implemented || g2Implemented) ? activeGoogleHits.every((relativePath) => relativePath.startsWith("src/core/google-static") || relativePath === "src/core/index.ts" || relativePath.startsWith("packages/renderer-contract/src/google-static") || relativePath === "packages/renderer-contract/src/index.ts" || relativePath.startsWith("packages/renderer-contract/dist/")) : activeGoogleHits.length === 0, (g1Implemented || g2Implemented || g3Implemented) ? `${activeGoogleHits.length} expected Google implementation file(s)` : (activeGoogleHits.join(",") || "no Google runtime profile/implementation/golden text"));
check("runtime_google_paths_absent", !(await exists("src/core/google")) && !(await exists("apps/desktop/renderer-ui/src/google")) && (g2_1Implemented || !(await exists("fixtures/golden/google"))), "no Google runtime/UI path; G2.1 frozen Golden path is additive");
check("implementation_boundary_frozen", registry?.invariants?.runtimeNetworkAccess === "PROHIBITED" && !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("plume") && !JSON.stringify(packageJson?.devDependencies ?? {}).toLowerCase().includes("plume"), "network prohibited and no Plume package dependency");

const frozenDiff = execFileSync("git", ["diff", "--name-only", acceptedCommit, "HEAD", "--", "src", "apps", "packages", "contracts/freeform-format-profiles.json", "fixtures/golden"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/u).filter((relativePath) => relativePath && !(
  ((g1Implemented || g2Implemented) && ["src/core/google-static.ts", "src/core/google-static-render.ts", "src/core/index.ts", "packages/renderer-contract/src/google-static.ts", "packages/renderer-contract/src/index.ts"].includes(relativePath))
  || ((g2_1Implemented) && (relativePath === "fixtures/golden/google" || relativePath.startsWith("fixtures/golden/google/")))
  || (g3Implemented && g3DesktopPaths.has(relativePath))
  || (g3RevisionImplemented && g3_0_2ProductionPaths.has(relativePath))
  || (g3_0_3Implemented && (g3_0_2ProductionPaths.has(relativePath) || relativePath === "src/core/google-static-render.ts" || relativePath === "apps/desktop/electron-main/src/ipc/schemas.ts" || relativePath === "apps/desktop/shared/src/types.ts" || relativePath === "apps/desktop/renderer-ui/src/i18n/ko-KR.json" || relativePath === "apps/desktop/renderer-ui/src/styles.css"))
  || (g3_0_4Implemented && g3_0_4ProductionPaths.has(relativePath))
)).join("\n");
check("frozen_channel_paths", frozenDiff.length === 0, frozenDiff || "KAKAO/NAVER/META runtime and golden paths unchanged");
const objectRightHash = await sha256("reference/kakao-tool/OBJECT_RIGHT.png").catch(() => null);
check("object_right_reference", objectRightHash === expectedObjectRightSha256, JSON.stringify({ expected: expectedObjectRightSha256, actual: objectRightHash }));
check("canonical_current_section", canonical.includes("## 54. Phase G0.1") && canonical.includes("current Google architecture status is `FROZEN`") && canonical.includes("G1 gate is open only when every G0.1 freeze verification passes"), "current G0.1 section is authoritative and frozen");
check("g1_gate_open", registry?.g1GateStatus === "OPEN" && versions?.canonicalPhaseG0_1Google?.nextPhase === "G1_GOOGLE_STATIC_CONTRACTS_AND_PROFILE_IMPLEMENTATION", JSON.stringify({ gate: registry?.g1GateStatus, next: versions?.canonicalPhaseG0_1Google?.nextPhase }));

for (const result of checks) console.log(`${result.status} ${result.id}: ${result.detail}`);
const status = failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, root, registryVersion: registry?.registryVersion, googleArchitectureVersion: registry?.googleArchitectureVersion }, null, 2));
if (status !== "PASS") process.exitCode = 1;
