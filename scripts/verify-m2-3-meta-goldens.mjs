import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadContracts, renderMetaStatic } from "../dist/core/index.js";

const root = process.cwd();
const checks = [];
const check = (id, ok, detail) => {
  checks.push({ id, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
};
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const exists = async (relativePath) => access(path.join(root, relativePath)).then(() => true).catch(() => false);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const registry = await readJson("contracts/goldens/meta-static-goldens.json");
const sourceReference = await readJson("fixtures/golden/meta/asset-digest-reference.json");
const packageJson = await readJson("package.json");
const profiles = await readJson("contracts/freeform-format-profiles.json");
const contractVersions = await readJson("contracts/contract-versions.json");
const canonicalDocument = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8");
const handoffEvidence = await readJson("artifacts/m2-3/handoff-verification.json");
const contracts = await loadContracts(root);

check("registry_shape", registry.schemaVersion === "1.0.0" && registry.registryVersion === "1.0.0" && registry.status === "APPROVED_FROZEN" && registry.manualAcceptance?.status === "APPROVED" && registry.finalGoldenFrozen === true && registry.entries?.length === 4, JSON.stringify({ schemaVersion: registry.schemaVersion, registryVersion: registry.registryVersion, status: registry.status, manualAcceptance: registry.manualAcceptance?.status, finalGoldenFrozen: registry.finalGoldenFrozen, entries: registry.entries?.length }));
check("manual_acceptance_scope", registry.manualAcceptance?.method === "USER_VISUAL_REVIEW" && registry.manualAcceptance?.approvedBy === "USER_MANUAL_ACCEPTANCE" && registry.manualAcceptance?.approvalPhase === "M2_3", JSON.stringify(registry.manualAcceptance));
check("source_asset", sourceReference.sourceAssetSha256 === "ffadcc7954d500fd618e12161ce11396f8858d5d6ab8a52333836dfd03348917" && sourceReference.sourceDimensions?.width === 7652 && sourceReference.sourceDimensions?.height === 5102, JSON.stringify(sourceReference));
check("scope_boundary", Array.isArray(registry.unsupportedScope) && registry.unsupportedScope.includes("Carousel") && registry.unsupportedScope.includes("Video") && registry.manualAcceptance.scope === "META static image renderer current scope only", JSON.stringify(registry.unsupportedScope));
check("runtime_dependency_boundary", !JSON.stringify(packageJson.dependencies ?? {}).toLowerCase().includes("plume") && !JSON.stringify(packageJson.devDependencies ?? {}).toLowerCase().includes("plume"), "no plume dependency in package manifests");
check("m2_3_contract_version", contractVersions.canonicalPhaseM2_3?.phase === "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE" && contractVersions.canonicalPhaseM2_3?.documentCurrent === "1.23.1" && contractVersions.canonicalPhaseM2_3?.goldenRegistryVersion === "1.0.0" && contractVersions.canonicalPhaseM2_3?.manualAcceptanceStatus === "APPROVED" && contractVersions.canonicalPhaseM2_3?.finalGoldenFrozen === true && contractVersions.canonicalPhaseM2_3?.templateCoordinatesChanged === false, JSON.stringify(contractVersions.canonicalPhaseM2_3));
check("m2_3_canonical_document", canonicalDocument.includes("Phase M2.3") && canonicalDocument.includes("META user visual acceptance and Golden freeze") && /\*\*Document version:\*\* (?:1\.23\.1|1\.24\.0|1\.25\.0|1\.26\.0|1\.27\.0)/u.test(canonicalDocument), "canonical document records the M2.3 freeze without changing template coordinates");

const metaProfiles = profiles.profiles.filter((entry) => entry.channelNamespace === "META");
check("stale_300kb_rule_absent", metaProfiles.every((entry) => entry.outputConstraints?.maximumBytes === undefined), JSON.stringify(metaProfiles.map((entry) => ({ id: entry.formatProfileId, outputConstraints: entry.outputConstraints ?? null }))));
check("golden_identity_fields", registry.entries.every((entry) => entry.goldenId && entry.status === "APPROVED_FROZEN" && entry.approvedBy === "USER_MANUAL_ACCEPTANCE" && entry.approvalPhase === "M2_3" && entry.formatProfileId && entry.placementContext && entry.artifactSha256 && entry.pixelFingerprint && entry.requestFingerprint && entry.validatorExpectation && entry.sourceFixture), "all four entries contain the frozen identity and fixture references");

const expected = {
  square: { profile: "META_STATIC_FEED_SQUARE", context: "INSTAGRAM_FEED", artifact: "1516d007cec83b8e16e8e6ad70825dcd36490e13b491e51b8868652e608a0ccf", bytes: 295358, pixel: "a2f2c5ac7add3e7a16ee33da88d286629ad80563c35002ef39e1785ca28c8b1a", request: "7a893e8cc4d1c12b84d9411072147c03ba62a691c4aeb33af2f154c7aaed1b42", counts: [0, 0, 0], codes: [] },
  portrait: { profile: "META_STATIC_FEED_PORTRAIT", context: "INSTAGRAM_FEED", artifact: "de7162cd2d1b6cfe9a9e0f33f62172d156075ceab2ff22ec9a58e68d1bd75c85", bytes: 399966, pixel: "bd1d3cf506fda3c3a0379802c7b62be60304e4acd17b9994f1d9105d8b2ab2ce", request: "10f25590fb4a9d8c9651240f10663b8bbb0ab6e790d01fa872ef83540ef40f1b", counts: [0, 0, 0], codes: [] },
  stories: { profile: "META_STATIC_VERTICAL_FULL", context: "INSTAGRAM_STORIES", artifact: "b958c022962b3641ca32e9cdb7da32e607b0d30ebd0f6b3a996452f58973d988", bytes: 637585, pixel: "b8201c47a54fedba62a2a0be9c83524fa7e1aa4ba9f6508624bf05a28bbe4988", request: "fdf2ff02bd6bf5149bc230d52be21069a73585e97ab62e8ba31a14f55e14b9c6", counts: [0, 0, 0], codes: [] },
  reels: { profile: "META_STATIC_VERTICAL_FULL", context: "INSTAGRAM_REELS", artifact: "b958c022962b3641ca32e9cdb7da32e607b0d30ebd0f6b3a996452f58973d988", bytes: 637585, pixel: "b8201c47a54fedba62a2a0be9c83524fa7e1aa4ba9f6508624bf05a28bbe4988", request: "9b6f6b00eca635eeca06b9eda3662af4126c4a4b98307007ffac9f65650d2b5a", counts: [0, 0, 1], codes: ["KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED"] },
};

const runtime = {};
for (const [key, target] of Object.entries(expected)) {
  const entry = registry.entries.find((candidate) => candidate.goldenId.toLowerCase().includes(key) || candidate.placementContext.toLowerCase().includes(key));
  const registryMatch = entry && entry.formatProfileId === target.profile && entry.placementContext === target.context && entry.artifactSha256 === target.artifact && entry.byteSize === target.bytes && entry.pixelFingerprint === target.pixel && entry.requestFingerprint === target.request;
  check(`${key}_approved_values`, registryMatch, JSON.stringify({ registry: entry ? { profile: entry.formatProfileId, context: entry.placementContext, artifact: entry.artifactSha256, bytes: entry.byteSize, pixel: entry.pixelFingerprint, request: entry.requestFingerprint } : null, expected: target }));
  if (!entry) continue;
  const artifactPath = entry.sourceFixture.artifact;
  const requestPath = entry.sourceFixture.request;
  const planPath = entry.sourceFixture.creativeLayoutPlan;
  const expectedManifestPath = entry.sourceFixture.expectedManifest;
  const allFiles = [artifactPath, requestPath, planPath, expectedManifestPath, entry.sourceFixture.assetDigestReference];
  check(`${key}_fixture_presence`, (await Promise.all(allFiles.map(exists))).every(Boolean), allFiles.join(", "));
  const artifact = await readFile(path.join(root, artifactPath));
  const metadata = await sharp(artifact).metadata();
  const artifactHash = sha256(artifact);
  check(`${key}_artifact_sha256`, artifactHash === target.artifact && artifact.length === target.bytes, JSON.stringify({ expected: target.artifact, actual: artifactHash, expectedBytes: target.bytes, actualBytes: artifact.length }));
  check(`${key}_jpeg_canvas`, metadata.format === "jpeg" && metadata.width === (key === "square" ? 1080 : key === "portrait" ? 1080 : 1080) && metadata.height === (key === "square" ? 1080 : key === "portrait" ? 1350 : 1920), JSON.stringify({ format: metadata.format, width: metadata.width, height: metadata.height }));
  const request = await readJson(requestPath);
  const plan = await readJson(planPath);
  const expectedManifest = await readJson(expectedManifestPath);
  check(`${key}_request_boundary`, request.formatProfileId === target.profile && request.placementContext === target.context && request.creativeLayoutPlan && !Object.prototype.hasOwnProperty.call(request.creativeLayoutPlan, "placementContext") && plan.formatProfileId === target.profile && !Object.prototype.hasOwnProperty.call(plan, "placementContext"), JSON.stringify({ formatProfileId: request.formatProfileId, placementContext: request.placementContext, planHasPlacementContext: Object.prototype.hasOwnProperty.call(plan, "placementContext") }));
  check(`${key}_expected_manifest`, expectedManifest.outputArtifactDigest === target.artifact && expectedManifest.pixelFingerprint === target.pixel && expectedManifest.requestFingerprint === target.request && expectedManifest.validatorExpectation?.errorCount === target.counts[0] && expectedManifest.validatorExpectation?.warningCount === target.counts[1] && expectedManifest.validatorExpectation?.infoCount === target.counts[2], JSON.stringify(expectedManifest.validatorExpectation));

  const runs = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await renderMetaStatic(request, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
    const renderedHash = result.png ? sha256(result.png) : null;
    const validator = result.manifest?.validatorResult ?? null;
    const issueCodes = validator?.issues?.map((issue) => issue.code) ?? [];
    runs.push({ renderedHash, bytes: result.png?.length ?? 0, requestFingerprint: result.requestFingerprint, pixelFingerprint: result.pixelFingerprint, validator });
    if (index === 0) {
      check(`${key}_rendered_artifact_match`, result.status === "PASS" && renderedHash === target.artifact && result.png?.length === target.bytes, JSON.stringify({ status: result.status, expected: target.artifact, actual: renderedHash, expectedBytes: target.bytes, actualBytes: result.png?.length ?? 0 }));
      check(`${key}_validator_expectation`, validator?.errorCount === target.counts[0] && validator?.warningCount === target.counts[1] && validator?.infoCount === target.counts[2] && JSON.stringify(issueCodes) === JSON.stringify(target.codes), JSON.stringify({ expected: { counts: target.counts, codes: target.codes }, actual: { counts: [validator?.errorCount, validator?.warningCount, validator?.infoCount], codes: issueCodes } }));
    }
  }
  const deterministic = new Set(runs.map((run) => run.renderedHash)).size === 1 && new Set(runs.map((run) => run.requestFingerprint)).size === 1 && new Set(runs.map((run) => run.pixelFingerprint)).size === 1;
  check(`${key}_three_run_determinism`, deterministic, JSON.stringify(runs));
  runtime[key] = runs;
}

check("stories_reels_contextual_identity", registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.artifactSha256 === registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.artifactSha256 && registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.pixelFingerprint === registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.pixelFingerprint && registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.requestFingerprint !== registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.requestFingerprint, "Stories/Reels share artifact and pixel fingerprint but keep separate request identity");
const reelsRuntime = runtime.reels?.[0]?.validator;
check("reels_source_required_info", reelsRuntime?.infoCount === 1 && reelsRuntime.issues?.some((issue) => issue.code === "KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED" && issue.severity === "INFO"), JSON.stringify(reelsRuntime));
check("stories_guide_semantics", registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.stories?.advisoryTopExclusion === 0.14 && registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.stories?.advisoryBottomExclusion === 0.2 && registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.stories?.finalOverlay === false, JSON.stringify(registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_STORIES")?.stories));
check("no_guessed_reels_geometry", registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.reels?.geometryStatus === "SOURCE_REQUIRED" && registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.reels?.guessedGeometryUsed === false, JSON.stringify(registry.entries.find((entry) => entry.placementContext === "INSTAGRAM_REELS")?.reels));
check("handoff_evidence", handoffEvidence.phase === "M2_3" && handoffEvidence.status === "PASS" && handoffEvidence.verifier === "scripts/verify-renderer-module-handoff.mjs", JSON.stringify(handoffEvidence));

const status = checks.every((entry) => entry.ok) ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.ok).length, failed: checks.filter((entry) => !entry.ok).map((entry) => entry.id), registryVersion: registry.registryVersion, finalGoldenFrozen: registry.finalGoldenFrozen }, null, 2));
if (status !== "PASS") process.exitCode = 1;
