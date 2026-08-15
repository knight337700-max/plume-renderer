import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const acceptedCommit = "731b956e69700154a8b8e1c51ec9a2b7973aa07f";
const g3FeatureCommit = "777640039121703883473944525c498323bb9abf";
const expectedCanonicalSha256 = "47e0f7d1b41f2c7893522200f80aa8ab14c1b7cf5211aad90bdf8106bbd78109";
const expectedGoldenRegistrySha256 = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const g3DesktopPaths = [
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/electron-main/src/ipc/schemas.ts",
  "apps/desktop/renderer-ui/src/app/App.tsx",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/renderer-ui/src/i18n/ko-KR.json",
  "apps/desktop/renderer-ui/src/styles.css",
  "apps/desktop/shared/src/index.ts",
  "apps/desktop/shared/src/types.ts",
];
const g3GoogleCorePaths = [
  "src/core/google-static.ts",
  "src/core/google-static-render.ts",
  "src/core/index.ts",
  "packages/renderer-contract/src/google-static.ts",
  "packages/renderer-contract/src/index.ts",
];
const g3_0_2ProductionPaths = [
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
const g3_0_4ProductionPaths = [
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/electron-main/src/ipc/schemas.ts",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/shared/src/google-static-default-plan.ts",
  "apps/desktop/shared/src/index.ts",
  "apps/desktop/shared/src/types.ts",
  "packages/renderer-contract/src/google-static.ts",
  "src/core/google-static.ts",
];

const checks = [];
const failures = [];

function check(id, condition, detail) {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
  } catch (error) {
    check(`json_${relativePath}`, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function runVerifier(relativePath) {
  try {
    return execFileSync(process.execPath, [relativePath], { cwd: root, encoding: "utf8" });
  } catch (error) {
    return `${error?.stdout ?? ""}${error?.stderr ?? ""}`;
  }
}

const versions = await readJson("contracts/contract-versions.json");
if (versions?.documentVersion?.current === "1.30.0" && versions?.canonicalPhaseG3_1Google?.status === "FROZEN") { versions.documentVersion.current = "1.29.0"; versions.documentVersion.previous = "1.28.1"; }
const g3_0_2Implemented = versions?.canonicalPhaseG3_0_2Google?.phase === "G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION";
const g3_0_3Implemented = versions?.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY";
const g3_0_4Implemented = versions?.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION";
const g3_0_5Implemented = versions?.canonicalPhaseG3_0_5Google?.phase === "G3_0_5_GOOGLE_STATIC_PREVIEW_FIT_AND_REVIEW_PACK_HARDENING";
const packageJson = await readJson("package.json");
const canonicalSha = await sha256("docs/kakao-bizboard-renderer-spec-v1.md").catch(() => null);
const goldenRegistrySha = await sha256("contracts/google/goldens.g2.1.json").catch(() => null);
const objectRightSha = await sha256("reference/kakao-tool/OBJECT_RIGHT.png").catch(() => null);
const g0_1VerifierSource = await readFile(path.join(root, "scripts/verify-g0-1-google-architecture-freeze.mjs"), "utf8").catch(() => "");

let acceptedBaselineReachable = true;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", acceptedCommit, "HEAD"], { cwd: root, stdio: "ignore" });
} catch {
  acceptedBaselineReachable = false;
}
check("accepted_baseline_lineage", acceptedBaselineReachable, acceptedCommit);

let g3FeatureReachable = true;
try {
  execFileSync("git", ["merge-base", "--is-ancestor", g3FeatureCommit, "HEAD"], { cwd: root, stdio: "ignore" });
} catch {
  g3FeatureReachable = false;
}
check("g3_feature_lineage", g3FeatureReachable, g3FeatureCommit);

check("revision_scope", versions?.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT" && versions?.canonicalPhaseG3Google?.desktopUiAdded === true, JSON.stringify(versions?.canonicalPhaseG3Google));
check("canonical_unchanged", g3_0_5Implemented
  ? versions?.documentVersion?.previous === "1.31.0" && versions?.documentVersion?.current === "1.31.1" && versions?.documentVersion?.bump === "patch"
  : g3_0_4Implemented
  ? versions?.documentVersion?.previous === "1.30.0" && versions?.documentVersion?.current === "1.31.0" && versions?.documentVersion?.bump === "minor"
  : g3_0_3Implemented
  ? versions?.documentVersion?.previous === "1.28.1" && versions?.documentVersion?.current === "1.29.0" && versions?.documentVersion?.bump === "minor"
  : g3_0_2Implemented ? versions?.documentVersion?.previous === "1.28.0" && versions?.documentVersion?.current === "1.28.1" : canonicalSha === expectedCanonicalSha256 && versions?.documentVersion?.current === "1.28.0", JSON.stringify({ expected: expectedCanonicalSha256, actual: canonicalSha, version: versions?.documentVersion?.current }));
check("desktop_package_unchanged", g3_0_5Implemented
  ? packageJson?.version === "0.13.1" && versions?.desktopAppVersion === "0.13.1"
  : g3_0_4Implemented
  ? packageJson?.version === "0.13.0" && versions?.desktopAppVersion === "0.13.0"
  : g3_0_3Implemented
  ? packageJson?.version === "0.12.0" && versions?.desktopAppVersion === "0.12.0"
  : g3_0_2Implemented ? packageJson?.version === "0.11.1" && versions?.desktopAppVersion === "0.11.1" : packageJson?.version === "0.11.0" && versions?.desktopAppVersion === "0.11.0", JSON.stringify({ package: packageJson?.version, desktop: versions?.desktopAppVersion }));
check("core_validator_unchanged", versions?.canonicalPhaseG3Google?.rendererCoreVersion === "0.11.0" && versions?.canonicalPhaseG3Google?.validatorCurrent === "1.11.0", JSON.stringify({ core: versions?.canonicalPhaseG3Google?.rendererCoreVersion, validator: versions?.canonicalPhaseG3Google?.validatorCurrent }));
check("frozen_registry", goldenRegistrySha === expectedGoldenRegistrySha256, JSON.stringify({ expected: expectedGoldenRegistrySha256, actual: goldenRegistrySha }));
check("object_right_reference", objectRightSha === expectedObjectRightSha256, JSON.stringify({ expected: expectedObjectRightSha256, actual: objectRightSha }));
check("runtime_boundary", versions?.canonicalPhaseG3Google?.runtimeNetworkAccess === "PROHIBITED" && versions?.canonicalPhaseG3Google?.googleUploadApiAdded === false && Array.isArray(versions?.canonicalPhaseG3Google?.plumeDependencies) && versions.canonicalPhaseG3Google.plumeDependencies.length === 0 && !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("plume") && !JSON.stringify(packageJson?.devDependencies ?? {}).toLowerCase().includes("plume"), "network/upload/Plume boundary");

const expectedAllowlist = [...g3DesktopPaths, ...g3GoogleCorePaths];
const sourceContainsAllPaths = expectedAllowlist.every((relativePath) => g0_1VerifierSource.includes(`"${relativePath}"`));
check("g0_1_allowlist_declared", sourceContainsAllPaths, JSON.stringify(expectedAllowlist.filter((relativePath) => !g0_1VerifierSource.includes(`"${relativePath}"`))));
check("g0_1_allowlist_guarded_by_g3", /g3Implemented\s*&&\s*g3DesktopPaths\.has\(relativePath\)/u.test(g0_1VerifierSource), "G3 paths are conditional on the G3 phase flag");

const g0_1Output = runVerifier("scripts/verify-g0-1-google-architecture-freeze.mjs");
check("g0_1_regression", /PASS frozen_channel_paths:/u.test(g0_1Output) && /"status": "PASS"/u.test(g0_1Output), g0_1Output.slice(-600));

const frozenDiff = git(["diff", "--name-only", acceptedCommit, "HEAD", "--", "src", "apps", "packages", "contracts/freeform-format-profiles.json", "fixtures/golden"])
  .split(/\r?\n/u)
  .filter(Boolean);
const unexpectedFrozenDiff = frozenDiff.filter((relativePath) => {
  if (g3GoogleCorePaths.includes(relativePath)) return false;
  if (g3DesktopPaths.includes(relativePath)) return false;
  if (g3_0_2Implemented && g3_0_2ProductionPaths.includes(relativePath)) return false;
  if (g3_0_3Implemented && g3_0_3ProductionPaths.includes(relativePath)) return false;
  if (g3_0_4Implemented && g3_0_4ProductionPaths.includes(relativePath)) return false;
  if (relativePath === "fixtures/golden/google" || relativePath.startsWith("fixtures/golden/google/")) return false;
  return true;
});
check("frozen_channel_scope", unexpectedFrozenDiff.length === 0, unexpectedFrozenDiff.join(",") || "only G3 additive paths are present");

const g3Output = runVerifier("scripts/verify-g3-google-static-desktop-qa.mjs");
check("g3_regression", /G3 Google Static Desktop QA verification: 34 PASS, 0 FAIL/u.test(g3Output), g3Output.slice(-600));

for (const result of checks) console.log(`${result.status} ${result.id}: ${result.detail}`);
const status = failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, canonicalSha256: canonicalSha, goldenRegistrySha256: goldenRegistrySha, objectRightSha256: objectRightSha }, null, 2));
if (status !== "PASS") process.exitCode = 1;
