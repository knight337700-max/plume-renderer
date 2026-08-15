import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineCommit = "cd438f137c34e8028827b7d675c7440456ce079f";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const expectedGoldenRegistrySha256 = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const previousG3DesktopPaths = [
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/electron-main/src/ipc/schemas.ts",
  "apps/desktop/renderer-ui/src/app/App.tsx",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/renderer-ui/src/i18n/ko-KR.json",
  "apps/desktop/renderer-ui/src/styles.css",
  "apps/desktop/shared/src/index.ts",
  "apps/desktop/shared/src/types.ts",
];
const productionPaths = [
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/shared/src/google-static-request.ts",
  "apps/desktop/shared/src/index.ts",
];
const g3_0_3ProductionPaths = [
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/electron-main/src/ipc/schemas.ts",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/renderer-ui/src/i18n/ko-KR.json",
  "apps/desktop/renderer-ui/src/styles.css",
  "apps/desktop/shared/src/google-static-request.ts",
  "apps/desktop/shared/src/types.ts",
  "src/core/google-static-render.ts",
];
const checks = [];
const failures = [];

function check(id, condition, detail = "") {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(id + ": " + detail);
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) { check("json_" + relativePath, false, error instanceof Error ? error.message : String(error)); return null; }
}

async function text(relativePath) {
  try { return await readFile(path.join(root, relativePath), "utf8"); }
  catch (error) { check("read_" + relativePath, false, error instanceof Error ? error.message : String(error)); return ""; }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

function git(args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); } catch { return ""; }
}

function isAncestor(commit) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}

const versions = await readJson("contracts/contract-versions.json");
const packageJson = await readJson("package.json");
const g3_0_3Implemented = versions?.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY";
const canonical = await text("docs/kakao-bizboard-renderer-spec-v1.md");
const editor = await text("apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx");
const controller = await text("apps/desktop/electron-main/src/desktop-controller.ts");
const sharedBuilder = await text("apps/desktop/shared/src/google-static-request.ts");
const sharedIndex = await text("apps/desktop/shared/src/index.ts");
const integration = await text("tests/desktop/integration/google-static-session-controller.test.ts");
const e2e = await text("tests/e2e/desktop.spec.ts");
const g0_1Verifier = await text("scripts/verify-g0-1-google-architecture-freeze.mjs");
const g3_0_1Verifier = await text("scripts/verify-g3-0-1-google-static-desktop-qa.mjs");

check("baseline_lineage", isAncestor(baselineCommit), baselineCommit);
check("phase_record", versions?.canonicalPhaseG3_0_2Google?.phase === "G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION" && (!g3_0_3Implemented || versions?.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY"), JSON.stringify(versions?.canonicalPhaseG3_0_3Google ?? versions?.canonicalPhaseG3_0_2Google));
check("canonical_patch_version", g3_0_3Implemented
  ? versions?.documentVersion?.previous === "1.28.1" && versions?.documentVersion?.current === "1.29.0" && versions?.documentVersion?.bump === "minor" && versions?.canonicalPhaseG3_0_3Google?.documentCurrent === "1.29.0"
  : versions?.documentVersion?.previous === "1.28.0" && versions?.documentVersion?.current === "1.28.1" && versions?.documentVersion?.bump === "patch" && versions?.canonicalPhaseG3_0_2Google?.documentCurrent === "1.28.1", JSON.stringify(versions?.documentVersion));
check("desktop_patch_version", g3_0_3Implemented
  ? packageJson?.version === "0.12.0" && versions?.desktopAppVersion === "0.12.0" && versions?.canonicalPhaseG3_0_3Google?.desktopCurrent === "0.12.0" && versions?.canonicalPhaseG3_0_3Google?.packageCurrent === "0.12.0"
  : packageJson?.version === "0.11.1" && versions?.desktopAppVersion === "0.11.1" && versions?.canonicalPhaseG3_0_2Google?.desktopCurrent === "0.11.1" && versions?.canonicalPhaseG3_0_2Google?.packageCurrent === "0.11.1", JSON.stringify({ package: packageJson?.version, desktop: versions?.desktopAppVersion }));
check("frozen_runtime_versions", versions?.templateContractVersion === "1.9.0" && versions?.inputSchemaVersion?.current === "1.2.0" && versions?.outputSchemaVersion?.current === "2.0.0" && versions?.canonicalPhaseG3_0_2Google?.rendererCoreVersion === "0.11.0" && versions?.canonicalPhaseG3_0_2Google?.validatorCurrent === "1.11.0", "template/input/output/core/validator unchanged");
check("template_coordinates_unchanged", versions?.canonicalPhaseG3_0_2Google?.templateCoordinatesChanged === false && /x=666, y=0, w=315, h=258/u.test(canonical) && /1029×258/u.test(canonical), "OBJECT_RIGHT slot and 1029×258 canvas remain frozen");
check("shared_builder_exported", sharedBuilder.includes("export function buildCanonicalGoogleStaticRequest") && sharedIndex.includes("buildCanonicalGoogleStaticRequest"), "shared canonical builder is exported");
check("preview_uses_builder", editor.includes("googleStatic: canonicalGoogleStaticRequest") && editor.includes("buildCanonicalGoogleStaticRequest(plan, deliveryMetadata)"), "Preview sends the canonical request");
check("export_uses_builder", editor.includes("googleStatic: buildCanonicalGoogleStaticRequest(plan, JSON.parse(deliveryMetadataText))"), "Export sends the same canonical request shape");
check("trusted_boundary_uses_builder", controller.includes("const request = buildCanonicalGoogleStaticRequest(requestInput)"), "Main/Core canonicalizes before fingerprint and rasterization");
check("metadata_not_rasterized", controller.includes("deliveryMetadata: request.deliveryMetadata ?? null") && !/renderGoogleStaticCandidate\([^\n]*deliveryMetadata/isu.test(controller), "delivery metadata remains identity-only");
check("stale_guard_preserved", controller.includes('"DESKTOP-EXPORT-003"') && controller.includes("built.requestFingerprint !== previewRecord.inputDigest"), "stale guard remains active");
check("regression_integration", integration.includes('code: "DESKTOP-EXPORT-003"') && integration.includes('deliveryMetadata: { targetName: "B" }'), "metadata-change stale integration coverage exists");
check("regression_e2e", e2e.includes("Google Static Preview with delivery metadata exports without a false stale block") && e2e.includes("google-export-result"), "actual Electron UI regression coverage exists");
check("g3_0_1_allowlist_exact", previousG3DesktopPaths.every((entry) => g0_1Verifier.includes("\"" + entry + "\"")) && /g3Implemented\s*&&\s*g3DesktopPaths\.has\(relativePath\)/u.test(g0_1Verifier), JSON.stringify(previousG3DesktopPaths));
check("g3_0_2_production_paths_exact", JSON.stringify(versions?.canonicalPhaseG3_0_2Google?.productionPaths) === JSON.stringify(productionPaths) && productionPaths.every((entry) => g3_0_1Verifier.includes("\"" + entry + "\"")), JSON.stringify(versions?.canonicalPhaseG3_0_2Google?.productionPaths));
const revisionDiff = [git(["diff", "--name-only", baselineCommit, "HEAD"]), git(["diff", "--name-only"]), git(["diff", "--name-only", "--cached"])].join("\n");
const changedSinceRevision = new Set(revisionDiff.split(/\r?\n/u).map((entry) => entry.replaceAll("\\", "/")).filter(Boolean));
const changedProductionPaths = [...changedSinceRevision].filter((entry) => entry.startsWith("apps/desktop/") || entry.startsWith("src/") || entry.startsWith("packages/") || entry.startsWith("fixtures/golden/"));
const expectedProductionPaths = new Set([...previousG3DesktopPaths, ...productionPaths, ...g3_0_3ProductionPaths, "src/core/google-static.ts", "src/core/google-static-render.ts", "src/core/index.ts", "packages/renderer-contract/src/google-static.ts", "packages/renderer-contract/src/index.ts"]);
check("production_scope_exact", changedProductionPaths.every((entry) => expectedProductionPaths.has(entry) || entry.startsWith("fixtures/golden/google/")), changedProductionPaths.filter((entry) => !expectedProductionPaths.has(entry) && !entry.startsWith("fixtures/golden/google/")).join(",") || "no unexpected production path");
check("frozen_golden_hash", await sha256("contracts/google/goldens.g2.1.json") === expectedGoldenRegistrySha256, expectedGoldenRegistrySha256);
check("object_right_hash", await sha256("reference/kakao-tool/OBJECT_RIGHT.png") === expectedObjectRightSha256, expectedObjectRightSha256);
check("runtime_scope", !/\b(?:fetch|axios|googleapis)\s*\(/iu.test(editor + controller + sharedBuilder) && !/plume/iu.test(editor + controller + sharedBuilder), "no runtime network or Plume dependency");
check("g3_1_artifacts_absent", !(await exists("artifacts/g3-1")) && ![...changedSinceRevision].some((entry) => entry.startsWith("artifacts/g3-1/")), "G3.1 review artifacts are absent");
check("next_phase_fixed", versions?.canonicalPhaseG3_0_2Google?.nextPhase === "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE" && versions?.canonicalPhaseG3_0_2Google?.g3_1ArtifactsCreated === false, versions?.canonicalPhaseG3_0_2Google?.nextPhase);

const canonicalSha = await sha256("docs/kakao-bizboard-renderer-spec-v1.md");
check("canonical_hash_recorded", (g3_0_3Implemented ? versions?.canonicalPhaseG3_0_3Google?.canonicalDocumentSha256 === canonicalSha : versions?.canonicalPhaseG3_0_2Google?.canonicalDocumentSha256 === canonicalSha), JSON.stringify({ expected: g3_0_3Implemented ? versions?.canonicalPhaseG3_0_3Google?.canonicalDocumentSha256 : versions?.canonicalPhaseG3_0_2Google?.canonicalDocumentSha256, actual: canonicalSha }));

for (const result of checks) console.log(result.status + " " + result.id + ": " + result.detail);
const status = failures.length === 0 ? "PASS" : "FAIL";
console.log("G3.0.2 Google Static Preview/Export verification: " + checks.filter((entry) => entry.status === "PASS").length + " PASS, " + failures.length + " FAIL");
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, canonicalSha256: canonicalSha }, null, 2));
if (status !== "PASS") process.exitCode = 1;
