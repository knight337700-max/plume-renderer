import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const checks = [];
const failures = [];

function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function exists(relativePath) {
  return stat(path.join(root, relativePath)).then(() => true).catch(() => false);
}

async function sha256File(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function pixelSha(relativePath) {
  const { data } = await sharp(path.join(root, relativePath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return createHash("sha256").update(data).digest("hex");
}

async function metadata(relativePath) {
  return sharp(path.join(root, relativePath)).metadata();
}

const requiredJson = [
  "artifacts/m2/meta-m1-artifact-inventory.json",
  "artifacts/m2/meta-artifact-audit.json",
  "artifacts/m2/meta-platform-copy-separation.json",
  "artifacts/m2/meta-crop-audit.json",
  "artifacts/m2/meta-typography-audit.json",
  "artifacts/m2/meta-stories-safe-zone-audit.json",
  "artifacts/m2/meta-reels-audit.json",
  "artifacts/m2/meta-placement-set-audit.json",
  "artifacts/m2/meta-png-jpeg-determinism.json",
  "artifacts/m2/meta-desktop-ux-audit.json",
  "artifacts/m2/meta-regression.json",
  "contracts/audits/meta-golden-candidates-m2.json",
];

let audit;
let inventory;
let registry;
let versions;
let packageJson;
for (const relativePath of requiredJson) {
  try {
    await readJson(relativePath);
    check(`json_parse_${relativePath}`, true, "parseable");
  } catch (error) {
    check(`json_parse_${relativePath}`, false, error instanceof Error ? error.message : String(error));
  }
}

try {
  audit = await readJson("artifacts/m2/meta-artifact-audit.json");
  inventory = await readJson("artifacts/m2/meta-m1-artifact-inventory.json");
  registry = await readJson("contracts/audits/meta-golden-candidates-m2.json");
  versions = await readJson("contracts/contract-versions.json");
  packageJson = await readJson("package.json");
} catch (error) {
  console.error(JSON.stringify({ status: "FAIL", failures: [error instanceof Error ? error.message : String(error)] }, null, 2));
  process.exit(1);
}

check("artifact_audit_status", audit.status === "PASS", JSON.stringify({ status: audit.status }));
check("manual_acceptance_not_reviewed", audit.manualAcceptanceStatus === "NOT_REVIEWED" && registry.manualAcceptanceStatus === "NOT_REVIEWED", "manual review remains pending");
check("golden_registry_not_frozen", registry.status === "CANDIDATE_NOT_APPROVED" && registry.finalGoldenFrozen === false, JSON.stringify({ status: registry.status, finalGoldenFrozen: registry.finalGoldenFrozen }));
check("m2_version_freeze", versions.documentVersion?.current === "1.22.0" && versions.templateContractVersion === "1.9.0" && versions.canonicalPhaseM2?.documentCurrent === "1.22.0" && versions.canonicalPhaseM2?.rendererCoreVersion === "0.9.0" && versions.canonicalPhaseM2?.validatorCurrent === "1.9.0" && versions.canonicalPhaseM2?.desktopCurrent === "0.10.0" && packageJson.version === "0.10.0", JSON.stringify({ document: versions.documentVersion?.current, template: versions.templateContractVersion, core: versions.canonicalPhaseM2?.rendererCoreVersion, validator: versions.canonicalPhaseM2?.validatorCurrent, desktop: versions.canonicalPhaseM2?.desktopCurrent, package: packageJson.version }));

const expectedCandidates = [
  { id: "META_GC_FEED_SQUARE_V1", key: "square", width: 1080, height: 1080, profile: "META_STATIC_FEED_SQUARE" },
  { id: "META_GC_FEED_PORTRAIT_V1", key: "portrait", width: 1080, height: 1350, profile: "META_STATIC_FEED_PORTRAIT" },
  { id: "META_GC_VERTICAL_STORIES_V1", key: "stories", width: 1080, height: 1920, profile: "META_STATIC_VERTICAL_FULL" },
  { id: "META_GC_VERTICAL_REELS_V1", key: "reels", width: 1080, height: 1920, profile: "META_STATIC_VERTICAL_FULL" },
];
const registeredById = new Map((registry.candidates ?? []).map((candidate) => [candidate.id, candidate]));
check("golden_candidate_cardinality", (registry.candidates ?? []).length === 5, JSON.stringify((registry.candidates ?? []).map((candidate) => candidate.id)));

for (const expected of expectedCandidates) {
  const candidate = registeredById.get(expected.id);
  const candidateAudit = audit.candidates?.[expected.key];
  check(`${expected.key}_candidate_status`, candidate?.status === "CANDIDATE_NOT_APPROVED", JSON.stringify(candidate));
  check(`${expected.key}_candidate_profile`, candidate?.profile === expected.profile, JSON.stringify(candidate?.profile));
  check(`${expected.key}_artifact_exists`, Boolean(candidate?.artifact) && await exists(candidate?.artifact), candidate?.artifact ?? "missing registry path");
  check(`${expected.key}_manifest_exists`, Boolean(candidate?.manifest) && await exists(candidate?.manifest), candidate?.manifest ?? "missing registry path");
  if (candidate?.artifact && await exists(candidate.artifact)) {
    const artifactSha = await sha256File(candidate.artifact);
    const pixels = await pixelSha(candidate.artifact);
    const info = await metadata(candidate.artifact);
    check(`${expected.key}_artifact_sha`, artifactSha === candidate.artifactSha && artifactSha === candidateAudit?.artifactSha, artifactSha);
    check(`${expected.key}_pixel_sha`, pixels === candidate.pixelSha && pixels === candidateAudit?.pixelSha, pixels);
    check(`${expected.key}_canvas`, info.width === expected.width && info.height === expected.height, `${info.width}x${info.height}`);
    check(`${expected.key}_rgba_png32`, info.format === "png" && info.channels === 4 && info.hasAlpha === true, JSON.stringify({ format: info.format, channels: info.channels, hasAlpha: info.hasAlpha, depth: info.depth }));
    check(`${expected.key}_size_limit`, (await stat(path.join(root, candidate.artifact))).size <= 300000, `${(await stat(path.join(root, candidate.artifact))).size} bytes`);
    check(`${expected.key}_validator`, candidateAudit?.validator?.status === "PASS" && candidateAudit.validator.errors === 0, JSON.stringify(candidateAudit?.validator));
    check(`${expected.key}_clipping`, candidateAudit?.clipping?.unexpected === false && candidateAudit.clipping.outOfCanvasLayerCount === 0, JSON.stringify(candidateAudit?.clipping));
    check(`${expected.key}_contamination`, Object.values(candidateAudit?.contamination ?? {}).every((value) => value === false), JSON.stringify(candidateAudit?.contamination));
    check(`${expected.key}_manifest_sha`, await sha256File(candidate.manifest) === candidate.manifestSha && await sha256File(candidate.manifest) === candidateAudit?.manifestSha, candidate.manifestSha);
  }
}

const placementCandidate = registeredById.get("META_GC_PLACEMENT_SET_V1");
const expectedOrder = ["META_STATIC_FEED_SQUARE", "META_STATIC_FEED_PORTRAIT", "META_STATIC_VERTICAL_FULL"];
check("placement_candidate_status", placementCandidate?.status === "CANDIDATE_NOT_APPROVED", JSON.stringify(placementCandidate));
check("placement_set_cardinality", placementCandidate?.artifactCount === 3 && JSON.stringify(placementCandidate.order) === JSON.stringify(expectedOrder), JSON.stringify(placementCandidate));
check("placement_set_audit", audit.placementSet?.artifactCount === 3 && audit.placementSet.deterministic === true && audit.placementSet.independentPlans === true && JSON.stringify(audit.placementSet.order) === JSON.stringify(expectedOrder), JSON.stringify(audit.placementSet));
check("placement_set_manifest", Boolean(placementCandidate?.manifest) && await exists(placementCandidate?.manifest ?? ""), placementCandidate?.manifest ?? "missing");
if (placementCandidate?.manifest && await exists(placementCandidate.manifest)) check("placement_set_manifest_sha", await sha256File(placementCandidate.manifest) === placementCandidate.manifestSha, placementCandidate.manifestSha);
check("placement_set_artifact_shas", JSON.stringify(placementCandidate?.artifactShas) === JSON.stringify(expectedCandidates.slice(0, 3).map((entry) => registeredById.get(entry.id)?.artifactSha)), JSON.stringify(placementCandidate?.artifactShas));

const platformCopy = audit.platformCopySeparation ?? {};
check("platform_copy_metadata_only", platformCopy.result === "PASS" && platformCopy.metadataOnlyChangePreservesArtifactBytes === true && platformCopy.metadataOnlyChangePreservesPixelFingerprint === true && platformCopy.requestFingerprintChanged === true && platformCopy.embeddedTextChangeChangesPixels === true, JSON.stringify(platformCopy));
check("manual_crop_audit", audit.manualCrop?.result === true && audit.manualCrop.deterministic === true && audit.manualCrop.accidentalStretch === false && audit.manualCrop.applied?.placementPolicy === "MANUAL_CROP", JSON.stringify(audit.manualCrop));
check("alpha_product_audit", audit.alphaProduct?.alphaPreserved === true && audit.alphaProduct?.unexpectedMatte === false && audit.alphaProduct?.haloDetected === false && audit.alphaProduct?.partialAlphaPixels > 0, JSON.stringify(audit.alphaProduct));
check("typography_audit", audit.typography?.rendererOwnedFontsOnly === true && audit.typography?.fallbackUsed === false && audit.typography?.clippingErrors === 0 && audit.typography?.fontIds?.length === 2, JSON.stringify(audit.typography));

const stories = audit.stories ?? {};
check("stories_safe_zone", stories.topExclusion === 0.14 && stories.bottomExclusion === 0.2 && stories.safe?.result === true && stories.safe.warnings === 0 && stories.safe.errors === 0, JSON.stringify(stories.safe));
check("stories_warning_behavior", stories.warning?.result === true && stories.warning.warnings >= 1 && stories.warning.errors === 0, JSON.stringify(stories.warning));
check("stories_guide_separation", stories.guidePreview === "PASS" && stories.finalArtifactClean === true && Boolean(stories.guidePath) && await exists(stories.guidePath), JSON.stringify({ guidePath: stories.guidePath, finalArtifactClean: stories.finalArtifactClean }));

const reels = audit.reels ?? {};
check("reels_source_required_info", reels.exactSafeZoneStatus === "SOURCE_REQUIRED" && reels.guessedGeometryUsed === false && reels.render?.errors === 0 && reels.render?.info >= 1 && reels.result === "PASS", JSON.stringify(reels));
check("runtime_network_zero", audit.runtime?.networkRequests === 0 && audit.runtime?.systemFontDependency === 0 && audit.runtime?.absolutePathFingerprintDependency === 0, JSON.stringify(audit.runtime));
check("artifact_policy", Object.values(audit.artifactPolicy ?? {}).every((value) => value === false || value === 0), JSON.stringify(audit.artifactPolicy));
check("m1_inventory_status", inventory.status === "PASS" && Object.keys(inventory.fixtures ?? {}).length === 6 && Object.values(inventory.fixtures ?? {}).every((fixture) => fixture.status === "PASS" && fixture.validator?.errors === 0), JSON.stringify(Object.keys(inventory.fixtures ?? {})));
check("m1_baseline_preserved", audit.m1Baseline?.preserved === true && audit.m1Baseline.kakaoPixelsChanged === false && audit.m1Baseline.naverPixelsChanged === false, JSON.stringify(audit.m1Baseline));

const determinism = audit.determinism ?? {};
check("png_determinism", determinism.png?.runs === 3 && determinism.png.byteEqual === true && determinism.png.pixelEqual === true, JSON.stringify(determinism.png));
check("jpeg_determinism", determinism.jpeg?.runs === 3 && determinism.jpeg.byteEqual === true && determinism.jpeg.pixelEqual === true, JSON.stringify(determinism.jpeg));
check("placement_determinism", determinism.placementSet?.deterministic === true, JSON.stringify(determinism.placementSet));
check("missing_variant_block", audit.missingVariant?.status === "BLOCKED" && audit.missingVariant.finalExportBlocked === true && audit.missingVariant.explicitMissingProfile === true && audit.missingVariant.errors?.some((entry) => entry.code === "KBR-META-PLACEMENT-SET-INCOMPLETE"), JSON.stringify(audit.missingVariant));

const reviewFiles = ["README.md", "01-feed-square.png", "02-feed-portrait.png", "03-vertical-stories-artifact.png", "04-vertical-stories-guide.png", "05-vertical-reels-artifact.png", "06-placement-set-contact-sheet.png"];
for (const file of reviewFiles) check(`manual_review_${file}`, await exists(`artifacts/m2/manual-review/${file}`), file);
const manifestFiles = await readdir(path.join(root, "artifacts/m2/manual-review/manifests")).catch(() => []);
check("manual_review_manifests", expectedCandidates.map((entry) => entry.id).concat("META_GC_PLACEMENT_SET_V1").every((id) => manifestFiles.includes(`${id}.manifest.json`)), JSON.stringify(manifestFiles));
check("manual_review_readme_declares_pending", (await readFile(path.join(root, "artifacts/m2/manual-review/README.md"), "utf8")).includes("NOT_REVIEWED") && (await readFile(path.join(root, "artifacts/m2/manual-review/README.md"), "utf8")).includes("Golden"), "README status and non-golden warning");

if (failures.length > 0) {
  for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
  console.error(JSON.stringify({ status: "FAIL", failures, checks: checks.length }, null, 2));
  process.exitCode = 1;
} else {
  for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, candidates: registry.candidates.map((candidate) => candidate.id), manualAcceptanceStatus: registry.manualAcceptanceStatus, finalGoldenFrozen: registry.finalGoldenFrozen }, null, 2));
}
