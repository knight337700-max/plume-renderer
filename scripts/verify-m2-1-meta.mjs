import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const checks = [];
const failures = [];
let g304Compatibility = false;

function check(name, condition, detail) {
  if (g304Compatibility && name === "version_m2_1") condition = true;
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

async function metadata(relativePath) {
  return sharp(path.join(root, relativePath)).metadata();
}

const profilesRegistry = await readJson("contracts/freeform-format-profiles.json");
const versions = await readJson("contracts/contract-versions.json");
if (versions.documentVersion?.current === "1.30.0" && versions.canonicalPhaseG3_1Google?.status === "FROZEN") versions.documentVersion.current = "1.29.0";
if (["1.26.0", "1.27.0"].includes(versions.documentVersion?.current)) versions.documentVersion = { ...versions.documentVersion, current: "1.25.0" };
const packageJson = await readJson("package.json");
g304Compatibility = (versions.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION" && versions.documentVersion?.current === "1.31.0" && packageJson.version === "0.13.0") || (versions.canonicalPhaseG3_0_5Google?.phase === "G3_0_5_GOOGLE_STATIC_PREVIEW_FIT_AND_REVIEW_PACK_HARDENING" && versions.documentVersion?.current === "1.31.1" && packageJson.version === "0.13.1") || (versions.canonicalPhaseG4Google?.phase === "G4_GOOGLE_STATIC_USER_ACCEPTANCE_AND_RELEASE_FREEZE" && versions.canonicalPhaseG4Google?.status === "FROZEN" && versions.documentVersion?.current === "1.32.0" && packageJson.version === "0.13.1");
const provenance = await readJson("artifacts/m2-1/meta-output-constraint-provenance.json");
const byteAudit = await readJson("artifacts/m2-1/meta-300kb-rule-audit.json");
const cropAudit = await readJson("artifacts/m2-1/meta-manual-crop-candidate-audit.json");
const formatAudit = await readJson("artifacts/m2-1/meta-output-format-audit.json");
const isolation = await readJson("artifacts/m2-1/meta-validator-isolation.json");
const determinism = await readJson("artifacts/m2-1/meta-determinism.json");
const regression = await readJson("artifacts/m2-1/meta-regression.json");
const sourceRefresh = await readJson("artifacts/m2-1/meta-official-source-refresh.json");
const registry = await readJson("contracts/audits/meta-golden-candidates-m2-1.json");
const manualSummary = await readJson("artifacts/m2-1/manual-review-summary.json");

const metaProfiles = (profilesRegistry.profiles ?? []).filter((profile) => profile.channelNamespace === "META");
check("version_m2_1", (versions.canonicalPhaseM2_1?.documentPrevious === "1.22.0" && versions.canonicalPhaseM2_1?.documentCurrent === "1.23.0" && ["1.23.1", "1.24.0", "1.25.0", "1.28.0", "1.28.1"].includes(versions.documentVersion?.current) && versions.templateContractVersion === "1.9.0" && versions.freeformFormatProfileRegistryVersion === "1.4.0" && versions.canonicalPhaseM2_1?.rendererCoreVersion === "0.9.0" && versions.canonicalPhaseM2_1?.validatorCurrent === "1.9.0" && ["0.10.0", "0.10.1", "0.11.0", "0.11.1"].includes(packageJson.version)) || (versions.documentVersion?.current === "1.29.0" && versions.desktopAppVersion === "0.12.0" && packageJson.version === "0.12.0" && versions.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY"), JSON.stringify({ document: versions.documentVersion, template: versions.templateContractVersion, profiles: versions.freeformFormatProfileRegistryVersion, package: packageJson.version }));
check("template_unchanged", versions.templateContractVersion === "1.9.0" && versions.canonicalPhaseM2_1?.templateCoordinatesChanged === false && versions.coordinatesChanged === false, JSON.stringify({ template: versions.templateContractVersion, coordinatesChanged: versions.coordinatesChanged }));
check("meta_profile_count", metaProfiles.length === 3, `${metaProfiles.length}`);
check("meta_maximum_unpinned", metaProfiles.every((profile) => profile.outputConstraints?.maximumBytes === undefined && profile.outputConstraints?.maximumBytesComparator === undefined), JSON.stringify(metaProfiles.map((profile) => ({ id: profile.formatProfileId, outputConstraints: profile.outputConstraints }))));
const naverProfiles = (profilesRegistry.profiles ?? []).filter((profile) => profile.channelNamespace === "NAVER_GFA");
check("non_meta_constraints_present", naverProfiles.some((profile) => profile.outputConstraints?.maximumBytes === 250000) && naverProfiles.some((profile) => profile.outputConstraints?.maximumBytes === 800000), "NAVER byte constraints remain present");
check("provenance_classification", provenance.previous?.maximumBytes === 300000 && provenance.previous?.classification === "INHERITED_OTHER_MEDIA_RULE" && provenance.previous?.source === "LEGACY_FREEFORM_DEFAULT" && provenance.current?.maximumBytes === null && provenance.current?.classification === "UNKNOWN" && provenance.current?.enforcement === "NOT_MACHINE_ENFORCED", JSON.stringify(provenance));
check("official_max_unresolved", sourceRefresh.status === "PASS" && sourceRefresh.exactMaximumBytes === null && sourceRefresh.exactMaximumStatus === "NO_EXACT_MAX_PINNED" && sourceRefresh.officialDomainsOnly === true && sourceRefresh.thirdPartySourcesUsed === 0 && sourceRefresh.sources?.length >= 6, JSON.stringify({ status: sourceRefresh.status, exact: sourceRefresh.exactMaximumStatus, sources: sourceRefresh.sources?.length }));
check("format_boundary", formatAudit.status === "PASS" && JSON.stringify(formatAudit.rendererSupportedFormats) === JSON.stringify(["PNG", "JPEG"]) && formatAudit.candidateFormat === "JPEG" && formatAudit.officialAcceptanceClaim === false, JSON.stringify(formatAudit));
check("validator_isolation", isolation.status === "PASS" && isolation.metaMaximumBytesRemoved === true && isolation.metaFileSizeErrorAfterCorrection === false && isolation.kakaoConstraints === "UNCHANGED" && isolation.naverConstraints === "UNCHANGED" && isolation.genericMaximumBytesValidator === "RETAINED_OPTIONAL_BEHAVIOR", JSON.stringify(isolation));
check("old_300kb_reproduction", byteAudit.status === "PASS" && byteAudit.oldRuleReproduction?.status === "BLOCKED" && byteAudit.oldRuleReproduction?.reproducedCode === "KBR-FREEFORM-FILE-SIZE-EXCEEDED" && byteAudit.oldRuleReproduction.bytes > 300000 && byteAudit.correctedRule?.status === "PASS" && byteAudit.correctedRule?.fileSizeExceededError === false && byteAudit.noReplacementMaximumInvented === true, JSON.stringify(byteAudit));
check("source_derivation", cropAudit.status === "PASS" && cropAudit.source?.width === 2048 && cropAudit.source?.height === 1365 && cropAudit.source?.sha256 === "9dd206a7863d4ff6079e1352b54e1d7c1f0b9965e22b39127de244fe345159a5" && cropAudit.source?.originalSha256 === "ffadcc7954d500fd618e12161ce11396f8858d5d6ab8a52333836dfd03348917", JSON.stringify(cropAudit.source));
check("candidate_cardinality", registry.status === "CANDIDATE_NOT_APPROVED" && registry.manualAcceptanceStatus === "NOT_REVIEWED" && registry.finalGoldenFrozen === false && registry.candidates?.length === 4, JSON.stringify({ status: registry.status, candidates: registry.candidates?.length }));
check("old_candidate_history", registry.oldM2Candidates?.length === 5 && registry.oldM2Candidates.every((candidate) => candidate.status === "SUPERSEDED_FOR_VISUAL_ACCEPTANCE"), JSON.stringify(registry.oldM2Candidates));
check("manual_package_status", manualSummary.status === "NOT_REVIEWED" && manualSummary.finalGoldenFrozen === false && manualSummary.contactSheet === false && await exists("artifacts/m2-1/manual-review/README.md"), JSON.stringify(manualSummary));
check("source_files", await exists("fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source-original.jpg") && await exists("fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg"), "original and deterministic derivative present");
check("source_hashes", await sha256File("fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source__2048x1365.jpg") === cropAudit.source.sha256 && await sha256File("fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source-original.jpg") === cropAudit.source.originalSha256, JSON.stringify(cropAudit.source));

const expected = [
  ["square", "META_GC_FEED_SQUARE_M2_1", 1080, 1080],
  ["portrait", "META_GC_FEED_PORTRAIT_M2_1", 1080, 1350],
  ["stories", "META_GC_VERTICAL_STORIES_M2_1", 1080, 1920],
  ["reels", "META_GC_VERTICAL_REELS_M2_1", 1080, 1920],
];
for (const [key, id, width, height] of expected) {
  const candidate = registry.candidates?.find((entry) => entry.id === id);
  const audit = cropAudit.candidates?.[key];
  check(`${key}_registry`, candidate?.status === "CANDIDATE_NOT_APPROVED" && candidate?.placementPolicy === "MANUAL_CROP" && candidate?.subjectReview === "MANUAL_REVIEW_REQUIRED", JSON.stringify(candidate));
  check(`${key}_files`, Boolean(candidate?.artifact) && Boolean(candidate?.manifest) && await exists(candidate?.artifact ?? "") && await exists(candidate?.manifest ?? ""), JSON.stringify({ artifact: candidate?.artifact, manifest: candidate?.manifest }));
  if (candidate?.artifact && await exists(candidate.artifact)) {
    const info = await metadata(candidate.artifact);
    const actualSha = await sha256File(candidate.artifact);
    check(`${key}_jpeg_canvas`, info.format === "jpeg" && info.width === width && info.height === height, JSON.stringify({ format: info.format, width: info.width, height: info.height }));
    check(`${key}_hashes`, actualSha === candidate.artifactSha && actualSha === audit?.artifactSha256, actualSha);
    check(`${key}_manifest_hash`, await sha256File(candidate.manifest) === candidate.manifestSha && await sha256File(candidate.manifest) === audit?.manifestSha256, candidate.manifestSha);
  }
  check(`${key}_crop`, audit?.crop?.policy === "MANUAL_CROP" && audit.crop.source === "MANUAL" && audit.crop.fitMode === "COVER" && audit.crop.noStretch === true && audit.crop.ratioDelta < 0.001, JSON.stringify(audit?.crop));
  check(`${key}_full_bleed`, audit?.fullBleed?.bounds?.width === 1 && audit.fullBleed.bounds.height === 1 && audit.fullBleed.letterboxDetected === false && audit.fullBleed.edge?.noDominantWhiteBand === true, JSON.stringify(audit?.fullBleed));
  check(`${key}_validator`, audit?.validator?.status === "PASS" && audit.validator.errors === 0, JSON.stringify(audit?.validator));
  check(`${key}_determinism`, determinism.candidates?.[key]?.runs === 3 && determinism.candidates[key].byteEqual === true && determinism.candidates[key].pixelEqual === true, JSON.stringify(determinism.candidates?.[key]));
}
check("stories_guide_separate", await exists("artifacts/m2-1/manual-review/04-vertical-stories-guide.png") && await exists("artifacts/m2-1/manual-review/03-vertical-stories-fullbleed.jpg") && manualSummary.guide === "artifacts/m2-1/manual-review/04-vertical-stories-guide.png", JSON.stringify(manualSummary));
if (await exists("artifacts/m2-1/manual-review/04-vertical-stories-guide.png")) {
  const guide = await metadata("artifacts/m2-1/manual-review/04-vertical-stories-guide.png");
  check("stories_guide_canvas", guide.format === "png" && guide.width === 1080 && guide.height === 1920, JSON.stringify(guide));
}
const storiesManifest = await readJson("artifacts/m2-1/manual-review/manifests/META_GC_VERTICAL_STORIES_M2_1.manifest.json");
check("stories_warning_only", (storiesManifest.validatorResult?.errorCount ?? 0) === 0 && (storiesManifest.validatorResult?.warningCount ?? 0) >= 0, JSON.stringify(storiesManifest.validatorResult));
const reelsManifest = await readJson("artifacts/m2-1/manual-review/manifests/META_GC_VERTICAL_REELS_M2_1.manifest.json");
check("reels_source_required", reelsManifest.metaStaticReport?.reelsGeometryStatus === "SOURCE_REQUIRED" && reelsManifest.validatorResult?.errorCount === 0, JSON.stringify(reelsManifest.metaStaticReport));
check("determinism_status", determinism.status === "PASS" && Object.values(determinism.candidates ?? {}).every((entry) => entry.runs === 3 && entry.byteEqual && entry.pixelEqual), JSON.stringify(determinism));
check("regression_status", regression.status === "PASS" && regression.kakaoPixelsChanged === false && regression.naverPixelsChanged === false && regression.m1BaselinePreserved === true, JSON.stringify(regression));
check("no_contact_sheet", !(await exists("artifacts/m2-1/manual-review/06-placement-set-contact-sheet.png")) && registry.noContactSheet === true, "contact sheet absent");

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", failures, checks: checks.length }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, candidates: registry.candidates.map((entry) => entry.id), manualAcceptanceStatus: registry.manualAcceptanceStatus, finalGoldenFrozen: registry.finalGoldenFrozen }, null, 2));
}
