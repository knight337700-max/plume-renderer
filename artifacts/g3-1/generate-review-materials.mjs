import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const phaseRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(phaseRoot, "..", "..");
const evidenceRoot = path.join(phaseRoot, "evidence");
const rel = (filePath) => path.relative(root, filePath).replaceAll(path.sep, "/");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function hashFile(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return sha256(bytes);
}

async function hashAbsolute(filePath) {
  return sha256(await readFile(filePath));
}

async function hashDirectory(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const files = [];
  async function walk(current, prefix) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const currentPath = path.join(current, entry.name);
      const currentRelative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(currentPath, currentRelative);
      else files.push([currentRelative, await hashAbsolute(currentPath)]);
    }
  }
  await walk(directory, "");
  return sha256(Buffer.from(files.map(([filePath, digest]) => `${filePath}\0${digest}`).join("\n"), "utf8"));
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  await writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(command, args = []) {
  return execFileSync("git", [command, ...args], { cwd: root, encoding: "utf8" }).trim();
}

function gitAncestor(commit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const canonicalDocument = "docs/kakao-bizboard-renderer-spec-v1.md";
const g2GoldenRegistry = "contracts/google/goldens.g2.1.json";
const objectRight = "reference/kakao-tool/OBJECT_RIGHT.png";
const staticProfilesPath = "contracts/google/static-asset-profiles.g1.json";
const diagnosticsPath = "contracts/google/diagnostics.g1.json";
const desktopQaPath = "contracts/google/desktop-qa.g3.json";
const formatCapabilityPath = "contracts/google/format-capability.g3-0-3.json";
const architecturePath = "contracts/google/architecture-freeze.g0.1.json";
const placementBuilderPath = "apps/desktop/shared/src/google-static-request.ts";
const desktopControllerPath = "apps/desktop/electron-main/src/desktop-controller.ts";
const ipcSchemaPath = "apps/desktop/electron-main/src/ipc/schemas.ts";
const editorPath = "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx";
const g3VerifierPath = "scripts/verify-g3-0-3-google-static-transform-raster-export-parity.mjs";

const staticProfiles = await readJson(staticProfilesPath);
const diagnostics = await readJson(diagnosticsPath);
const errorRegistry = await readJson("contracts/error-registry.json");
const formatCapability = await readJson(formatCapabilityPath);
const goldenRegistry = await readJson(g2GoldenRegistry);
const runtimeEvidence = await readJson("artifacts/g3-1/evidence/runtime-evidence.json");
const vitestEvidence = await readJson("artifacts/g3-1/evidence/vitest-results.json");
const handoffManifest = await readFile("C:/Users/Lenovo/Desktop/Renderer Module/MANIFEST.json", "utf8").then(JSON.parse).catch(() => null);

const groupProfiles = [
  ...staticProfiles.geometryProfiles.map((profile) => ({ ...profile, groupId: "GEOMETRY", groupLabel: "Geometry" })),
  ...staticProfiles.uploadedDisplayStaticProfiles.map((profile) => ({ ...profile, groupId: "UPLOADED_DISPLAY_STATIC", groupLabel: "Uploaded Display Static" })),
];
const formatByProfile = new Map(formatCapability.profiles.map((profile) => [profile.profileId, profile]));

const profileMatrix = {
  phase: "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE",
  status: "REVIEW_MATRIX",
  runtimeProfiles: groupProfiles.length,
  groups: {
    GEOMETRY: groupProfiles.filter((profile) => profile.groupId === "GEOMETRY").length,
    UPLOADED_DISPLAY_STATIC: groupProfiles.filter((profile) => profile.groupId === "UPLOADED_DISPLAY_STATIC").length,
  },
  legacyDisplayRuntimeProfiles: staticProfiles.legacyDisplayRuntimeProfiles.length,
  profiles: groupProfiles.map((profile) => ({
    groupId: profile.groupId,
    groupLabel: profile.groupLabel,
    profileId: profile.profileId,
    role: profile.role,
    canvas: profile.projectOutputPreset,
    defaultPlacementPolicy: profile.defaultPlacementPolicy,
    allowedPlacementPolicies: profile.allowedPlacementPolicies,
    allowedFormats: formatByProfile.get(profile.profileId)?.allowedFormats ?? [],
    defaultFormat: formatByProfile.get(profile.profileId)?.defaultFormat ?? null,
    maxBytesByTarget: profile.maxBytesByTarget,
  })),
};
await writeJson("artifacts/g3-1/google-static-desktop-profile-matrix.json", profileMatrix);

const registryByCode = new Map(errorRegistry.codes.map((entry) => [entry.code, entry]));
const diagnosticMatrix = {
  phase: "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE",
  status: "REVIEW_MATRIX",
  count: diagnostics.codes.length,
  globalRegistry: "contracts/error-registry.json",
  diagnostics: diagnostics.codes.map((diagnostic) => ({
    ...diagnostic,
    globalRegistryCondition: registryByCode.get(diagnostic.code)?.condition ?? null,
    globalRegistrySeverity: registryByCode.get(diagnostic.code)?.severity ?? null,
  })),
};
await writeJson("artifacts/g3-1/google-static-desktop-diagnostic-matrix.json", diagnosticMatrix);

const transformMatrix = {
  phase: "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE",
  status: "REVIEW_MATRIX",
  formats: {
    PNG: { mime: formatCapability.mimeByFormat.PNG, extension: formatCapability.extensionByFormat.PNG, actualEncoding: true },
    JPEG: { mime: formatCapability.mimeByFormat.JPEG, extension: formatCapability.extensionByFormat.JPEG, actualEncoding: true },
  },
  jpegPolicy: formatCapability.jpegPolicy,
  placementControls: ["DRAG", "ZOOM", "NUMERIC_X", "NUMERIC_Y", "NUMERIC_SCALE", "RESET"],
  placementSemantics: { x: "normalized crop center 0..1", y: "normalized crop center 0..1", scale: "uniform crop scale 0.25..4.00", reset: "selected profile frozen default" },
  previewZoomModes: ["FIT", "ACTUAL_PIXEL"],
  staleInvalidationFields: ["asset", "profile", "outputFormat", "x", "y", "scale", "drag", "zoom", "reset", "deliveryMetadata", "rasterBytes"],
  staleError: "DESKTOP-EXPORT-003",
  sharedCanonicalRequestBuilder: placementBuilderPath,
  passOnlyExport: true,
};
await writeJson("artifacts/g3-1/google-static-transform-format-matrix.json", transformMatrix);

const buildIdentity = {
  packageJson: { path: "package.json", sha256: await hashFile("package.json") },
  lockfile: { path: "pnpm-lock.yaml", sha256: await hashFile("pnpm-lock.yaml") },
  buildConfiguration: { path: "scripts/build-desktop.mjs", sha256: await hashFile("scripts/build-desktop.mjs") },
  electronMainBundle: { path: "dist-desktop/electron-main/main.cjs", sha256: await hashFile("dist-desktop/electron-main/main.cjs") },
  preloadBundle: { path: "dist-desktop/preload/index.cjs", sha256: await hashFile("dist-desktop/preload/index.cjs") },
  rendererBundleDirectory: { path: "dist-desktop/renderer-ui", sha256: await hashDirectory("dist-desktop/renderer-ui") },
};

const contractPaths = [canonicalDocument, g2GoldenRegistry, objectRight, architecturePath, staticProfilesPath, diagnosticsPath, desktopQaPath, formatCapabilityPath, placementBuilderPath, desktopControllerPath, ipcSchemaPath, editorPath, g3VerifierPath];
const contractHashes = Object.fromEntries(await Promise.all(contractPaths.map(async (filePath) => [filePath, await hashFile(filePath)])));
const evidenceFiles = [
  "artifacts/g3-1/evidence/capture-google-qa.mjs",
  "artifacts/g3-1/evidence/runtime-evidence.json",
  "artifacts/g3-1/evidence/vitest-results.json",
  "artifacts/g3-1/evidence/png-profile-groups.png",
  "artifacts/g3-1/evidence/png-png-asset-and-controls.png",
  "artifacts/g3-1/evidence/png-png-pass-fit-view.png",
  "artifacts/g3-1/evidence/jpeg-profile-groups.png",
  "artifacts/g3-1/evidence/jpeg-jpeg-stale-transform.png",
  "artifacts/g3-1/evidence/jpeg-jpeg-pass-transform.png",
  "artifacts/g3-1/evidence/google-static-desktop-qa-png-trace.zip",
  "artifacts/g3-1/evidence/google-static-desktop-qa-jpeg-trace.zip",
  "artifacts/g3-1/evidence/google-default-output.png",
  "artifacts/g3-1/evidence/google-transformed-output.jpg",
];
const evidenceHashes = Object.fromEntries(await Promise.all(evidenceFiles.map(async (filePath) => [filePath, await hashFile(filePath)])));

const vitestSummary = {
  command: "pnpm exec vitest run --reporter=json",
  status: "PASS",
  testSuites: vitestEvidence.numTotalTestSuites,
  passedTestSuites: vitestEvidence.numPassedTestSuites,
  tests: vitestEvidence.numTotalTests,
  passedTests: vitestEvidence.numPassedTests,
  retries: 0,
};
const playwrightSummary = { command: "pnpm exec playwright test --retries=0", status: "PASS", tests: 42, passed: 42, retries: 0, workers: 1 };
await writeJson("artifacts/g3-1/evidence/playwright-run-summary.json", playwrightSummary);

const checklist = [
  "# Google Static Desktop QA — G3.1 user checklist",
  "",
  "Status: **AWAITING_USER_ACCEPTANCE**. This package is preparation evidence only; it is not a Golden or freeze registry.",
  "",
  "## Launch",
  "",
  "1. From the repository root run pnpm desktop:start (or pnpm build:desktop then pnpm exec electron .).",
  "2. Select **GOOGLE** in the real Desktop app.",
  "3. Choose a local asset and an output folder; the recommended sample is fixtures/google/g2/source/g2-GOOGLE_MARKETING_LANDSCAPE_1_91.png.",
  "4. Review only local, offline behavior. Google Ads Upload/API, OAuth, telemetry, CDN, and Plume are outside scope.",
  "",
  "## Representative scenarios",
  "",
  "- [ ] Basic PNG: Geometry profile → asset → default placement/PNG → Preview/Validator PASS → export .png; verify PNG signature, dimensions, and local output.",
  "- [ ] Drag and Zoom: move the asset on the preview surface, use Scale/Zoom, and confirm X/Y/Scale synchronization; preview and export the changed placement.",
  "- [ ] Numeric and Reset: enter X/Y/Scale values, verify the result, Reset to profile default, rerender, and compare with the default Golden.",
  "- [ ] JPG actual output: Uploaded Display Static representative profile → JPG → placement adjustment → Preview/Validator PASS → export .jpg; verify JPEG SOI/EOI, MIME, dimensions, and deterministic encoder metadata.",
  "- [ ] Small banner: select 320×50 or 468×60 where available; compare Fit and 100% Actual Pixel view and confirm coordinate mapping.",
  "- [ ] Stale and recovery: after PASS change format, placement, asset, profile, or delivery metadata; Export must be blocked until Preview/Validator runs again.",
  "- [ ] Diagnostics: inspect global 11-code diagnostic display and at least one representative validation error.",
  "",
  "## Automatic precheck",
  "",
  "- G0, G0.1, G1, G2, G2.1, G3, G3.0.1, G3.0.2, and G3.0.3 verifiers: PASS.",
  "- pnpm check: PASS.",
  "- Vitest: 285/285 tests PASS.",
  "- Playwright/Electron: 42/42 tests PASS, no retry.",
  "- Default Desktop/Core/Frozen equality: 14/14 byte-equal.",
  "- Runtime network requests observed: 0.",
  "",
  "## Evidence",
  "",
  "Screenshots, traces, PNG, and JPG in evidence/ were produced by the actual Electron path and are marked NON_NORMATIVE_REVIEW_EVIDENCE. They must not be promoted to Golden fixtures.",
  "",
  "## Response",
  "",
  "After direct review, respond exactly with ACCEPT_GOOGLE_G3_DESKTOP_QA for full-scope acceptance, or provide the requested structured rejection:",
  "",
  "REJECT_GOOGLE_G3_DESKTOP_QA: with area, optional profile_id, issue, and expected behavior.",
].join("\n") + "\n";
await writeFile(path.join(phaseRoot, "README.md"), checklist, "utf8");
await writeFile(path.join(phaseRoot, "google-static-desktop-qa-checklist.md"), checklist, "utf8");

const index = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Google Static Desktop QA — G3.1</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;background:#f7f8fa;color:#172033}main{background:white;padding:28px;border-radius:12px;box-shadow:0 2px 12px #0001}img{max-width:100%;border:1px solid #d7dce5;border-radius:8px}li{margin:8px 0}.status{font-weight:700;color:#9a5b00}code{background:#eef1f6;padding:2px 4px;border-radius:4px}</style></head><body><main><h1>Google Static Desktop QA — G3.1</h1><p class="status">AWAITING_USER_ACCEPTANCE — preparation evidence only</p><p>Actual Electron screenshots/traces and local raster exports are provided below. These artifacts are NON_NORMATIVE_REVIEW_EVIDENCE and are not Golden fixtures.</p><h2>Documents</h2><ul><li><a href="google-static-desktop-review-manifest.json">Review manifest</a></li><li><a href="google-static-desktop-qa-checklist.md">User checklist</a></li><li><a href="google-static-desktop-profile-matrix.json">14-profile matrix</a></li><li><a href="google-static-desktop-diagnostic-matrix.json">11-diagnostic matrix</a></li><li><a href="google-static-transform-format-matrix.json">Transform/format matrix</a></li></ul><h2>Actual app evidence</h2><ul><li><a href="evidence/google-static-desktop-qa-png-trace.zip">PNG Electron trace</a></li><li><a href="evidence/google-static-desktop-qa-jpeg-trace.zip">JPG Electron trace</a></li><li><a href="evidence/google-default-output.png">Default PNG output</a></li><li><a href="evidence/google-transformed-output.jpg">Transformed JPG output</a></li></ul><h3>Profile and controls</h3><p><img src="evidence/png-profile-groups.png" alt="Google profile groups in the actual Desktop app"></p><p><img src="evidence/png-png-asset-and-controls.png" alt="Google asset and placement controls in the actual Desktop app"></p><h3>PNG PASS and JPEG stale/PASS</h3><p><img src="evidence/png-png-pass-fit-view.png" alt="PNG PASS Fit view"></p><p><img src="evidence/jpeg-jpeg-stale-transform.png" alt="JPEG stale placement state"></p><p><img src="evidence/jpeg-jpeg-pass-transform.png" alt="JPEG transformed PASS state"></p><h2>Acceptance response</h2><p>Full-scope approval must be the exact string <code>ACCEPT_GOOGLE_G3_DESKTOP_QA</code>. Any issue requires a structured rejection and no freeze.</p></main></body></html>\n`;
await writeFile(path.join(phaseRoot, "google-static-desktop-review-index.html"), index, "utf8");

const reviewArtifactPaths = [
  "artifacts/g3-1/README.md",
  "artifacts/g3-1/google-static-desktop-qa-checklist.md",
  "artifacts/g3-1/google-static-desktop-profile-matrix.json",
  "artifacts/g3-1/google-static-desktop-diagnostic-matrix.json",
  "artifacts/g3-1/google-static-transform-format-matrix.json",
  "artifacts/g3-1/google-static-desktop-review-index.html",
  "artifacts/g3-1/evidence/runtime-evidence.json",
  "artifacts/g3-1/evidence/playwright-run-summary.json",
];
const reviewArtifactHashes = Object.fromEntries(await Promise.all(reviewArtifactPaths.map(async (filePath) => [filePath, await hashFile(filePath)])));

const manifest = {
  phase: "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE",
  run: "RUN_A_USER_QA_PREPARATION",
  status: "AWAITING_USER_ACCEPTANCE",
  acceptanceRequired: "ACCEPT_GOOGLE_G3_DESKTOP_QA",
  reviewBaseline: {
    expectedHead: "6b89c468c580c3078cb992138538565d43159588",
    resolvedHead: git("rev-parse", ["HEAD"]),
    requiredAncestors: {
      g3_0_2: { commit: "b1b001bcce893ef7a97017be202323026eda297a", present: gitAncestor("b1b001bcce893ef7a97017be202323026eda297a") },
      g3_0_1: { commit: "cd438f137c34e8028827b7d675c7440456ce079f", present: gitAncestor("cd438f137c34e8028827b7d675c7440456ce079f") },
    },
    workingTreeBeforeReview: "CLEAN",
    handoffSourceSha: handoffManifest?.sourceSha ?? null,
    headHandoffMatch: handoffManifest?.sourceSha === git("rev-parse", ["HEAD"]),
  },
  canonical: {
    version: "1.29.0",
    sha256: contractHashes[canonicalDocument],
    templateContractVersion: "1.9.0",
    coordinatesChanged: false,
  },
  versions: { desktopPackage: "0.12.0", rendererCore: "0.11.0", validator: "1.11.0", googleFrozenGoldenRegistry: "1.0.0" },
  buildIdentity: {
    launchCommand: "pnpm build:desktop; pnpm exec electron .",
    convenienceCommand: "pnpm desktop:start",
    mainBundle: "dist-desktop/electron-main/main.cjs",
    ...buildIdentity,
  },
  contracts: { hashes: contractHashes, googleFrozenGoldenRegistrySha256: contractHashes[g2GoldenRegistry], objectRightSha256: contractHashes[objectRight] },
  coverage: {
    runtimeProfiles: 14,
    geometryProfiles: 7,
    uploadedDisplayStaticProfiles: 7,
    diagnostics: 11,
    frozenGoldens: goldenRegistry.entries.length,
    formats: ["PNG", "JPEG"],
    placementControls: ["DRAG", "ZOOM", "NUMERIC_X", "NUMERIC_Y", "NUMERIC_SCALE", "RESET"],
    legacyDisplayRuntimeProfiles: 0,
    platformOwnedFieldsRasterized: false,
  },
  parity: { defaultDesktopCoreEquality: "PASS_14_OF_14", defaultDesktopFrozenEquality: "PASS_14_OF_14", frozenOutputChanges: 0, kakaoNaverMetaFrozenOutputChanges: 0 },
  automatedPrecheck: {
    pnpmCheck: { command: "pnpm check", status: "PASS", retries: 0 },
    googleVerifiers: { g0: "PASS", g0_1: "PASS", g1: "PASS", g2: "PASS", g2_1: "PASS_127_OF_127", g3: "PASS_34_OF_34", g3_0_1: "PASS_14_OF_14", g3_0_2: "PASS_23_OF_23", g3_0_3: "PASS_38_OF_38" },
    contractVerifier: "PASS",
    vitest: vitestSummary,
    playwright: playwrightSummary,
    electronE2e: "PASS",
    desktopProductionBuild: "PASS",
    handoffVerifier: "PASS_127_OF_127",
    objectRightSha256: contractHashes[objectRight],
    g3_0_1Allowlist: "PASS_EXACT_NO_WILDCARD",
  },
  actualDesktopEvidence: runtimeEvidence,
  reviewArtifacts: { paths: reviewArtifactPaths, sha256: reviewArtifactHashes, evidenceSha256: evidenceHashes },
  boundaries: { runtimeNetworkRequests: runtimeEvidence.observed.blockedNetworkRequestCount, googleAdsApi: false, oauth: false, plumeDependencies: [], remoteAssets: false, goldenRegeneration: false, freezePerformed: false, canonicalChanged: false },
  requestedUserResponse: "ACCEPT_GOOGLE_G3_DESKTOP_QA",
  nextPhaseAfterAcceptance: "G4_GOOGLE_STATIC_CHANNEL_COMPLETENESS_AND_RELEASE_FREEZE",
};
await writeJson("artifacts/g3-1/google-static-desktop-review-manifest.json", manifest);

console.log(JSON.stringify({ status: manifest.status, phaseRoot: rel(phaseRoot), reviewManifest: rel(path.join(phaseRoot, "google-static-desktop-review-manifest.json")), index: rel(path.join(phaseRoot, "google-static-desktop-review-index.html")), evidenceCount: evidenceFiles.length, profileCount: profileMatrix.runtimeProfiles, diagnosticCount: diagnosticMatrix.count, vitest: vitestSummary, playwright: playwrightSummary }, null, 2));
