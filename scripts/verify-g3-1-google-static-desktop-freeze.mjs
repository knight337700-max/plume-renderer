import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const acceptedSource = "6b89c468c580c3078cb992138538565d43159588";
const expectedObjectRight = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const expectedGoldenRegistry = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const acceptanceStatement = "ACCEPT_GOOGLE_G3_DESKTOP_QA";
const phaseName = "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE";
const checks = [];
const failures = [];

function check(id, condition, detail = "") {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
  console.log(`${status} ${id}: ${detail}`);
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.isAbsolute(relativePath) ? relativePath : path.join(root, relativePath), "utf8")); }
  catch (error) { check(`read_${relativePath}`, false, error instanceof Error ? error.message : String(error)); return null; }
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function hashDirectory(relativePath) {
  const directory = path.join(root, relativePath);
  const files = [];
  async function walk(current, prefix) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(absolute, relative);
      else if (entry.isFile()) files.push([relative, await sha256(path.relative(root, absolute))]);
    }
  }
  await walk(directory, "");
  return createHash("sha256").update(Buffer.from(files.map(([file, digest]) => `${file}\0${digest}`).join("\n"), "utf8")).digest("hex");
}

function git(args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); } catch { return ""; }
}

function isAncestor(commit) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}

async function verifyArtifactMap(map) {
  if (!map || typeof map !== "object") return false;
  let valid = true;
  for (const [relativePath, expected] of Object.entries(map)) {
    try { valid &&= (await sha256(relativePath)) === expected; }
    catch { valid = false; }
  }
  return valid;
}

async function main() {
  const versions = await readJson("contracts/contract-versions.json");
  const phase = versions?.canonicalPhaseG3_1Google;
  const registry = await readJson("contracts/google/desktop-qa-freeze.g3.1.json");
  const acceptance = await readJson("artifacts/g3-1/google-static-desktop-user-acceptance.json");
  const review = await readJson("artifacts/g3-1/google-static-desktop-review-manifest.json");
  const packageJson = await readJson("package.json");
  const currentHead = git(["rev-parse", "HEAD"]);
  const canonicalSha = await sha256("docs/kakao-bizboard-renderer-spec-v1.md").catch(() => null);

  check("accepted_source_ancestor", isAncestor(acceptedSource), acceptedSource);
  check("current_head_is_commit", /^[0-9a-f]{40}$/u.test(currentHead), currentHead);
  check("phase_and_status", phase?.phase === phaseName && phase?.status === "FROZEN" && phase?.acceptance === "USER_ACCEPTED", JSON.stringify({ phase: phase?.phase, status: phase?.status, acceptance: phase?.acceptance }));
  check("canonical_version_bump", versions?.documentVersion?.previous === "1.29.0" && versions?.documentVersion?.current === "1.30.0" && versions?.documentVersion?.bump === "minor" && phase?.documentPrevious === "1.29.0" && phase?.documentCurrent === "1.30.0", JSON.stringify(versions?.documentVersion));
  check("canonical_hash", canonicalSha === phase?.canonicalDocumentSha256 && canonicalSha !== "TO_BE_FILLED", canonicalSha ?? "missing");
  check("template_coordinates_frozen", phase?.templateContractVersion === "1.9.0" && phase?.templateCoordinatesChanged === false, JSON.stringify({ template: phase?.templateContractVersion, changed: phase?.templateCoordinatesChanged }));
  check("runtime_versions_frozen", packageJson?.version === "0.12.0" && versions?.desktopAppVersion === "0.12.0" && phase?.rendererCoreVersion === "0.11.0" && phase?.validatorCurrent === "1.11.0", JSON.stringify({ package: packageJson?.version, desktop: versions?.desktopAppVersion, core: phase?.rendererCoreVersion, validator: phase?.validatorCurrent }));

  check("acceptance_identity", acceptance?.status === "ACCEPTED" && acceptance?.phase === phaseName && acceptance?.acceptanceStatement === acceptanceStatement && acceptance?.acceptedScope === "GOOGLE_STATIC_DESKTOP_QA" && acceptance?.acceptedSourceSha === acceptedSource, JSON.stringify({ status: acceptance?.status, statement: acceptance?.acceptanceStatement, source: acceptance?.acceptedSourceSha }));
  check("review_identity_revalidated", review?.status === "AWAITING_USER_ACCEPTANCE" && review?.phase === phaseName && review?.reviewBaseline?.expectedHead === acceptedSource && review?.reviewBaseline?.resolvedHead === acceptedSource && review?.reviewBaseline?.workingTreeBeforeReview === "CLEAN" && review?.canonical?.version === "1.29.0" && review?.canonical?.sha256 === "951611a7ef09150dcc6af2e231bffc84a713a239fe103117ac1534af6c5e94ee", "RUN_A identity is immutable");
  const actualAcceptanceSha = await sha256("artifacts/g3-1/google-static-desktop-user-acceptance.json").catch(() => null);
  const actualRegistrySha = await sha256("contracts/google/desktop-qa-freeze.g3.1.json").catch(() => null);
  const actualReviewSha = await sha256("artifacts/g3-1/google-static-desktop-review-manifest.json").catch(() => null);
  check("acceptance_evidence_hash", actualAcceptanceSha === phase?.acceptanceEvidenceSha256 && actualAcceptanceSha === registry?.acceptanceEvidenceSha256, actualAcceptanceSha ?? "missing");
  check("freeze_registry_hash", actualRegistrySha === phase?.freezeRegistrySha256, actualRegistrySha ?? "missing");
  check("review_manifest_hash", actualReviewSha === phase?.reviewManifestSha256 && actualReviewSha === acceptance?.reviewIdentity?.reviewManifestSha256 && actualReviewSha === registry?.reviewIdentity?.reviewManifestSha256, actualReviewSha ?? "missing");

  check("registry_shape", registry?.schemaVersion === "1.0.0" && registry?.registryVersion === "1.0.0" && registry?.status === "FROZEN" && registry?.acceptance === "USER_ACCEPTED" && registry?.acceptedSourceSha === acceptedSource && registry?.nextPhase === "G4_GOOGLE_STATIC_CHANNEL_COMPLETENESS_AND_RELEASE_FREEZE", JSON.stringify({ status: registry?.status, next: registry?.nextPhase }));
  check("registry_identity", registry?.versions?.canonicalDocumentPrevious === "1.29.0" && registry?.versions?.canonicalDocumentVersion === "1.30.0" && registry?.versions?.desktopPackage === "0.12.0" && registry?.versions?.googleFrozenGoldenRegistry === "1.0.0", JSON.stringify(registry?.versions));
  check("registry_coverage", registry?.desktopQa?.runtimeProfiles === 14 && registry?.desktopQa?.geometryProfiles === 7 && registry?.desktopQa?.uploadedDisplayStaticProfiles === 7 && registry?.desktopQa?.diagnostics === 11 && registry?.desktopQa?.formats?.join(",") === "PNG,JPEG" && registry?.desktopQa?.legacyDisplayRuntimeProfiles === 0, JSON.stringify(registry?.desktopQa));
  check("registry_controls", registry?.desktopQa?.placementControls?.join(",") === "DRAG,ZOOM,NUMERIC_X,NUMERIC_Y,NUMERIC_SCALE,RESET" && registry?.desktopQa?.fitActualPreview === true && registry?.desktopQa?.passOnlyExport === true && registry?.desktopQa?.staleExportBlocked === true, JSON.stringify(registry?.desktopQa?.placementControls));
  check("registry_boundaries", registry?.invariants?.googleGoldenChanges === 0 && registry?.invariants?.kakaoNaverMetaFrozenOutputChanges === 0 && registry?.invariants?.runtimeNetworkRequests === 0 && registry?.invariants?.coordinatesChanged === false && registry?.invariants?.plumeDependencies?.length === 0 && registry?.invariants?.googleAdsApiDependencies?.length === 0, JSON.stringify(registry?.invariants));

  const contractHashes = registry?.sourceContracts ?? {};
  const sourceHashChecks = [
    ["architecture", contractHashes.architecture, contractHashes.architectureSha256],
    ["profileRegistry", contractHashes.profileRegistry, contractHashes.profileRegistrySha256],
    ["diagnosticRegistry", contractHashes.diagnosticRegistry, contractHashes.diagnosticRegistrySha256],
    ["desktopQaContract", contractHashes.desktopQaContract, contractHashes.desktopQaContractSha256],
    ["formatCapability", contractHashes.formatCapability, contractHashes.formatCapabilitySha256],
    ["goldenRegistry", contractHashes.goldenRegistry, contractHashes.goldenRegistrySha256],
    ["objectRight", contractHashes.objectRight, contractHashes.objectRightSha256],
  ];
  for (const [id, file, expected] of sourceHashChecks) check(`source_contract_${id}`, Boolean(file && expected) && await sha256(file).catch(() => null) === expected, `${file ?? "missing"}`);
  check("object_right_reference", await sha256("reference/kakao-tool/OBJECT_RIGHT.png").catch(() => null) === expectedObjectRight, expectedObjectRight);
  check("golden_registry_reference", await sha256("contracts/google/goldens.g2.1.json").catch(() => null) === expectedGoldenRegistry, expectedGoldenRegistry);

  const build = registry?.reviewIdentity ?? {};
  const buildChecks = [
    ["package", "package.json", build.buildPackageSha256],
    ["lockfile", "pnpm-lock.yaml", build.lockfileSha256],
    ["build_configuration", "scripts/build-desktop.mjs", build.buildConfigurationSha256],
    ["electron_main_bundle", "dist-desktop/electron-main/main.cjs", build.electronMainBundleSha256],
    ["preload_bundle", "dist-desktop/preload/index.cjs", build.preloadBundleSha256],
  ];
  for (const [id, file, expected] of buildChecks) check(`build_identity_${id}`, Boolean(expected) && await sha256(file).catch(() => null) === expected, file);
  check("build_identity_renderer_bundle", await hashDirectory("dist-desktop/renderer-ui").catch(() => null) === build.rendererBundleSha256, "dist-desktop/renderer-ui");

  check("review_artifacts_sha256", await verifyArtifactMap(review?.reviewArtifacts?.sha256), "reviewArtifacts.sha256");
  check("review_evidence_sha256", await verifyArtifactMap(review?.reviewArtifacts?.evidenceSha256), "reviewArtifacts.evidenceSha256");
  check("review_automated_precheck", review?.automatedPrecheck?.pnpmCheck?.status === "PASS" && review?.automatedPrecheck?.vitest?.status === "PASS" && review?.automatedPrecheck?.playwright?.status === "PASS" && review?.automatedPrecheck?.electronE2e === "PASS" && review?.automatedPrecheck?.desktopProductionBuild === "PASS", "RUN_A automated precheck");

  check("acceptance_coverage", acceptance?.coverage?.runtimeProfiles === 14 && acceptance?.coverage?.geometryProfiles === 7 && acceptance?.coverage?.uploadedDisplayStaticProfiles === 7 && acceptance?.coverage?.diagnostics === 11 && acceptance?.coverage?.formats?.join(",") === "PNG,JPEG" && acceptance?.coverage?.fitActualPreview === true && acceptance?.coverage?.passOnlyExport === true && acceptance?.coverage?.staleExportBlocked === true, JSON.stringify(acceptance?.coverage));
  check("acceptance_regression", acceptance?.verification?.runtimeNetworkRequests === 0 && acceptance?.verification?.frozenOutputChanges === 0 && acceptance?.verification?.plumeDependencies?.length === 0 && acceptance?.verification?.defaultDesktopCoreEquality === "PASS_14_OF_14" && acceptance?.verification?.defaultDesktopFrozenEquality === "PASS_14_OF_14", JSON.stringify(acceptance?.verification));

  const pngEvidence = registry?.evidence?.pngEvidence;
  const jpegEvidence = registry?.evidence?.jpegEvidence;
  const pngBytes = pngEvidence ? await readFile(path.join(root, pngEvidence)).catch(() => null) : null;
  const jpegBytes = jpegEvidence ? await readFile(path.join(root, jpegEvidence)).catch(() => null) : null;
  const pngMeta = pngBytes ? await sharp(pngBytes).metadata().catch(() => null) : null;
  const jpegMeta = jpegBytes ? await sharp(jpegBytes).metadata().catch(() => null) : null;
  check("png_evidence", Boolean(pngBytes && pngMeta?.format === "png" && pngMeta.width === 1200 && pngMeta.height === 628 && pngMeta.hasAlpha === true && pngBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && await sha256(pngEvidence).catch(() => null) === registry?.evidence?.pngEvidenceSha256), JSON.stringify(pngMeta));
  check("jpeg_evidence", Boolean(jpegBytes && jpegMeta?.format === "jpeg" && jpegMeta.width === 1200 && jpegMeta.height === 628 && jpegMeta.hasAlpha === false && jpegBytes[0] === 0xff && jpegBytes[1] === 0xd8 && jpegBytes.at(-2) === 0xff && jpegBytes.at(-1) === 0xd9 && await sha256(jpegEvidence).catch(() => null) === registry?.evidence?.jpegEvidenceSha256), JSON.stringify(jpegMeta));

  const changedSinceAccepted = new Set(git(["diff", "--name-only", acceptedSource, "HEAD"]).split(/\r?\n/u).concat(git(["diff", "--name-only"]).split(/\r?\n/u), git(["diff", "--name-only", "--cached"]).split(/\r?\n/u)).map((entry) => entry.replaceAll("\\", "/")).filter(Boolean));
  const runtimePrefixes = ["apps/", "src/", "packages/", "tests/", "fixtures/", "reference/"];
  const runtimeFiles = [...changedSinceAccepted].filter((entry) => runtimePrefixes.some((prefix) => entry.startsWith(prefix)) || ["package.json", "pnpm-lock.yaml"].includes(entry));
  check("no_runtime_or_golden_changes", runtimeFiles.length === 0, runtimeFiles.join(",") || "docs/contracts/evidence/scripts only");
  check("no_plume_or_remote_scope", registry?.invariants?.plumeDependencies?.length === 0 && registry?.invariants?.googleAdsApiDependencies?.length === 0 && registry?.invariants?.runtimeNetworkRequests === 0, "offline local renderer boundary");

  const g3_0_3 = spawnSync(process.execPath, [path.join(root, "scripts/verify-g3-0-3-google-static-transform-raster-export-parity.mjs")], { cwd: root, encoding: "utf8" });
  check("g3_0_3_regression_verifier", g3_0_3.status === 0, (g3_0_3.stdout ?? "").split(/\r?\n/u).filter(Boolean).at(-1) ?? g3_0_3.stderr ?? "failed");

  const handoffManifest = await readJson("C:/Users/Lenovo/Desktop/Renderer Module/MANIFEST.json");
  check("handoff_source_identity", handoffManifest?.sourceSha === currentHead && handoffManifest?.handoffPhase === phaseName, JSON.stringify({ sourceSha: handoffManifest?.sourceSha, currentHead, phase: handoffManifest?.handoffPhase }));
  check("next_phase_fixed", phase?.nextPhase === "G4_GOOGLE_STATIC_CHANNEL_COMPLETENESS_AND_RELEASE_FREEZE" && registry?.nextPhase === phase?.nextPhase, phase?.nextPhase);

  const passed = checks.filter((entry) => entry.status === "PASS").length;
  console.log(JSON.stringify({ status: failures.length === 0 ? "PASS" : "FAIL", passed, total: checks.length, failures, checks }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

await main();
