import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const failures = [];
let passed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}: ${detail}`);
  } else {
    failures.push(name);
    console.error(`FAIL ${name}: ${detail}`);
  }
}

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, ...relativePath.split("/")), "utf8"));
}

async function sha(relativePath) {
  const bytes = await readFile(path.join(root, ...relativePath.split("/")));
  return createHash("sha256").update(bytes).digest("hex");
}

const versions = await json("contracts/contract-versions.json");
const packageJson = await json("package.json");
const desktopRegistry = await json("contracts/desktop-capability-registry.json");
const profileRegistry = await json("contracts/google/static-asset-profiles.g1.json");
const diagnostics = await json("contracts/google/diagnostics.g1.json");
const goldenRegistry = await json("contracts/google/goldens.g2.1.json");
const desktopQa = await json("contracts/google/desktop-qa.g3.json");
const globalErrors = await json("contracts/error-registry.json");

check("baseline_lineage", (() => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", "bd702a0b8b7e265a607d45edc76b51f244b78d65", "HEAD"], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})(), "bd702a0 is an ancestor of the current G3 implementation");
check("canonical_phase", versions.documentVersion?.previous === "1.27.0" && versions.documentVersion?.current === "1.28.0" && versions.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT", `${versions.documentVersion?.previous}->${versions.documentVersion?.current}`);
check("template_contract_unchanged", versions.templateContractVersion === "1.9.0" && versions.canonicalPhaseG3Google?.templateCoordinatesChanged === false, versions.templateContractVersion);
check("desktop_package_version", packageJson.version === "0.11.0" && versions.desktopAppVersion === "0.11.0", packageJson.version);
check("google_architecture_unchanged", versions.canonicalPhaseG3Google?.googleArchitectureVersion === "1.0.0", versions.canonicalPhaseG3Google?.googleArchitectureVersion);
check("frozen_registry_hash", await sha("contracts/google/goldens.g2.1.json") === "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359", await sha("contracts/google/goldens.g2.1.json"));
check("frozen_registry_shape", goldenRegistry.status === "FROZEN" && goldenRegistry.visualAcceptance === "ACCEPTED" && goldenRegistry.artifactCount === 14 && goldenRegistry.entries?.length === 14, `entries=${goldenRegistry.entries?.length}`);
check("profile_group_counts", profileRegistry.profileCount === 14 && profileRegistry.geometryProfileCount === 7 && profileRegistry.uploadedDisplayStaticProfileCount === 7 && profileRegistry.legacyDisplayRuntimeProfiles?.length === 0, `profiles=${profileRegistry.profileCount}`);
check("desktop_qa_contract", desktopQa.frozenGoldenCount === 14 && desktopQa.fitToView === true && desktopQa.actualPixelView === true && desktopQa.passOnlyExport === true && desktopQa.profilePresentation?.platformFieldsAreMetadataOnly === true, "fit/actual/pass-only/metadata-only");

const googleChannel = desktopRegistry.channels?.find((entry) => entry.id === "GOOGLE");
const geometry = new Set(profileRegistry.geometryProfiles.map((entry) => entry.profileId));
const uploaded = new Set(profileRegistry.uploadedDisplayStaticProfiles.map((entry) => entry.profileId));
check("desktop_google_channel", Boolean(googleChannel) && googleChannel.placements?.length === 2, `placements=${googleChannel?.placements?.length ?? 0}`);
check("desktop_google_groups", googleChannel?.placements?.some((entry) => entry.id === "GOOGLE_STATIC_GEOMETRY" && entry.sourceProfileIds?.every((id) => geometry.has(id))) === true && googleChannel?.placements?.some((entry) => entry.id === "GOOGLE_STATIC_UPLOADED_DISPLAY" && entry.sourceProfileIds?.every((id) => uploaded.has(id))) === true, "7 geometry + 7 uploaded");
check("desktop_google_legacy_zero", profileRegistry.legacyDisplayRuntimeProfiles?.length === 0 && desktopQa.legacyDisplayRuntimeProfiles === 0, "legacy display runtime is absent");

const expectedCodes = new Map(diagnostics.codes.map((entry) => [entry.code, entry]));
const activeCodes = new Map(globalErrors.codes.map((entry) => [entry.code, entry]));
check("google_diagnostics_active", diagnostics.codes.length === 11 && diagnostics.codes.every((entry) => activeCodes.get(entry.code)?.severity === entry.severity && activeCodes.get(entry.code)?.messageKey === entry.messageKey), "11 frozen Google diagnostics active globally");
check("google_diagnostics_unique", new Set(diagnostics.codes.map((entry) => entry.code)).size === 11, "diagnostic codes unique");
const i18nText = readFileSync(path.join(root, "apps/desktop/renderer-ui/src/i18n/ko-KR.json"), "utf8");
check("google_i18n_keys", i18nText.includes("google.asset_profile_unknown") && diagnostics.codes.every((entry) => i18nText.includes(entry.messageKey)), "all message keys present");

const referenceHash = await sha("reference/kakao-tool/OBJECT_RIGHT.png");
check("object_right_reference", referenceHash === "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b", referenceHash);
check("desktop_google_ui", await stat(path.join(root, "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx")).then(() => true).catch(() => false), "GoogleStaticEditor.tsx exists");
const desktopE2e = readFileSync(path.join(root, "tests/e2e/desktop.spec.ts"), "utf8");
check("desktop_google_e2e", desktopE2e.includes("Google Static Desktop QA exposes the frozen profile groups") && desktopE2e.includes("google-profile-select") && desktopE2e.includes("google-actual-view"), "Google profile grouping and pixel-view E2E coverage exists");
check("runtime_scope", !["apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx", "apps/desktop/electron-main/src/desktop-controller.ts"].some((file) => /import[^\n]*(?:plume|googleapis)|\bfetch\s*\(/iu.test(readFileSync(path.join(root, file), "utf8"))), "no plume/upload/network call in Google desktop path");

let core;
try {
  core = await import("../dist/core/index.js");
} catch (error) {
  failures.push("core_build");
  console.error(`FAIL core_build: ${error instanceof Error ? error.message : String(error)}`);
}
if (core) {
  const contracts = await core.loadGoogleStaticContracts(root);
  let goldenPasses = 0;
  for (const entry of goldenRegistry.entries ?? []) {
    const sourceBytes = await readFile(path.join(root, ...entry.sourceFixtureRelativePath.split("/")));
    const plan = await json(entry.layoutPlanRelativePath);
    const rendered = await core.renderGoogleStaticCandidate(sourceBytes, plan, contracts);
    const actualDigest = createHash("sha256").update(rendered.bytes).digest("hex");
    const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
    const planDigest = await sha(entry.layoutPlanRelativePath);
    const ok = actualDigest === entry.artifactSha256 && rendered.renderFingerprint === entry.renderFingerprint && sourceDigest === entry.sourceFixtureSha256 && planDigest === entry.layoutPlanSha256;
    check(`golden_${entry.profileId}`, ok, `${actualDigest} / ${entry.artifactSha256}`);
    if (ok) goldenPasses += 1;
  }
  check("golden_all_14", goldenPasses === 14, `${goldenPasses}/14 byte-equal outputs`);
}

console.log(`G3 Google Static Desktop QA verification: ${passed} PASS, ${failures.length} FAIL`);
if (failures.length > 0) process.exitCode = 1;
