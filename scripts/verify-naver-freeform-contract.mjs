import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const failures = [];
const pass = (name, detail) => console.log(`PASS ${name}: ${detail}`);
const fail = (name, detail) => {
  failures.push(name);
  console.error(`FAIL ${name}: ${detail}`);
};
const check = (name, condition, detail) => condition ? pass(name, detail) : fail(name, detail);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const profilesRegistry = await readJson("contracts/freeform-format-profiles.json");
const sourceRevision = await readJson("contracts/naver-freeform-source-revision.json");
const profileBoundary = await readJson("contracts/naver-freeform-profiles.json");
const capabilities = await readJson("contracts/channel-capabilities.json");
const versions = await readJson("contracts/contract-versions.json");

const expected = {
  NAVER_MOBILE_DA: {
    canvas: { width: 1250, height: 560 },
    placement: "MOBILE_DA",
    minimumBytes: 50000,
    maximumBytes: 250000,
  },
  NAVER_IMAGE_BANNER_1_1: {
    canvas: { width: 1200, height: 1200 },
    placement: "IMAGE_BANNER_1_1",
    minimumBytes: 80000,
    maximumBytes: 800000,
  },
};

for (const [id, rule] of Object.entries(expected)) {
  const profile = profilesRegistry.profiles?.find((entry) => entry.formatProfileId === id);
  check(`profile_${id}`, Boolean(profile), "profile is present");
  if (!profile) continue;
  check(`profile_${id}_runtime`, profile.channel === "NAVER_GFA" && profile.channelNamespace === "NAVER_GFA" && profile.implementationStatus === "IMPLEMENTED" && profile.layoutMode === "FREEFORM" && profile.compositionMode === "RENDERER_COMPOSED" && profile.artifactCardinality === "SINGLE", JSON.stringify({ channel: profile.channel, channelNamespace: profile.channelNamespace, implementationStatus: profile.implementationStatus, layoutMode: profile.layoutMode, compositionMode: profile.compositionMode, artifactCardinality: profile.artifactCardinality }));
  check(`profile_${id}_canvas`, profile.canvas?.width === rule.canvas.width && profile.canvas?.height === rule.canvas.height, JSON.stringify(profile.canvas));
  check(`profile_${id}_placement`, profile.placement === rule.placement, String(profile.placement));
  check(`profile_${id}_bytes`, profile.outputConstraints?.minimumBytes === rule.minimumBytes && profile.outputConstraints?.minimumBytesComparator === "GTE" && profile.outputConstraints?.maximumBytes === rule.maximumBytes && profile.outputConstraints?.maximumBytesComparator === "LTE", JSON.stringify(profile.outputConstraints));
  check(`profile_${id}_formats`, JSON.stringify(profile.outputConstraints?.allowedFormats) === JSON.stringify(["PNG", "JPEG"]), JSON.stringify(profile.outputConstraints?.allowedFormats));
}

const mobileSource = sourceRevision.sources?.mobileDa;
const bannerSource = sourceRevision.sources?.imageBanner1x1;
check("source_revision_status", sourceRevision.sourceStatus === "SOURCE_CONFIRMED" && sourceRevision.runtimeNetworkAccess === "PROHIBITED", JSON.stringify({ sourceStatus: sourceRevision.sourceStatus, runtimeNetworkAccess: sourceRevision.runtimeNetworkAccess }));
check("mobile_da_source", mobileSource?.pageUrl === "https://ads.naver.com/adguide/1474" && mobileSource?.pageUpdate === "2025-04-08" && mobileSource?.attachmentSha256 === "a5f61b376d4ae1f6eb0c187b2a55af229916e875959cf798d7cd1fe7fdc4d11f" && mobileSource?.canvas?.width === 1250 && mobileSource?.canvas?.height === 560, JSON.stringify({ pageUrl: mobileSource?.pageUrl, pageUpdate: mobileSource?.pageUpdate, attachmentSha256: mobileSource?.attachmentSha256, canvas: mobileSource?.canvas }));
check("mobile_da_safe_text", JSON.stringify(mobileSource?.safeArea?.text) === JSON.stringify({ left: 240, right: 240, top: 50, bottom: 35 }), JSON.stringify(mobileSource?.safeArea?.text));
check("mobile_da_safe_object", JSON.stringify(mobileSource?.safeArea?.mainObject) === JSON.stringify({ left: 225, right: 225 }), JSON.stringify(mobileSource?.safeArea?.mainObject));
check("mobile_da_text_constraints", JSON.stringify(mobileSource?.textRules) === JSON.stringify({ maxFontSizePx: 52, minRasterHeightPx: 22, maxLines: 4, maxDistinctColors: 3 }), JSON.stringify(mobileSource?.textRules));
check("image_banner_source", bannerSource?.pageUrl === "https://ads.naver.com/adguide/1473" && bannerSource?.pageUpdate === "2023-12-20" && bannerSource?.attachmentSha256 === "b71852dfcc62160633af96bffdd3aca990e8acf932ddf188b06a59aee942d30b" && bannerSource?.canvas?.width === 1200 && bannerSource?.canvas?.height === 1200, JSON.stringify({ pageUrl: bannerSource?.pageUrl, pageUpdate: bannerSource?.pageUpdate, attachmentSha256: bannerSource?.attachmentSha256, canvas: bannerSource?.canvas }));
check("image_banner_pt_rules", JSON.stringify(bannerSource?.textRulesPt) === JSON.stringify({ TITLE: 32, SUBCOPY: 16, DISCLAIMER: 14 }), JSON.stringify(bannerSource?.textRulesPt));

const feedSource = sourceRevision.sources?.mobileDaFeed;
const feedBoundary = profileBoundary.feedBoundary;
check("feed_source_boundary", feedSource?.pageUrl === "https://ads.naver.com/adguide/1480" && feedSource?.pageUpdate === "2026-04-15" && feedBoundary?.outerComposition === "PLATFORM_COMPOSED" && feedBoundary?.outerWrapperRuntime === "NOT_IMPLEMENTED" && feedBoundary?.collectionRuntime === "NOT_IMPLEMENTED" && feedBoundary?.videoRuntime === "NOT_IMPLEMENTED", JSON.stringify({ source: { pageUrl: feedSource?.pageUrl, pageUpdate: feedSource?.pageUpdate }, boundary: feedBoundary }));

const naverCapabilities = (capabilities.capabilities ?? []).filter((entry) => entry.channel === "NAVER_GFA");
check("channel_capability_boundary", naverCapabilities.some((entry) => entry.placement === "MOBILE_DA" && entry.runtimeStatus === "IMPLEMENTED") && naverCapabilities.some((entry) => entry.placement === "IMAGE_BANNER_1_1" && entry.runtimeStatus === "IMPLEMENTED") && naverCapabilities.some((entry) => entry.placement === "MOBILE_DA_FEED" && entry.runtimeStatus !== "IMPLEMENTED"), JSON.stringify(naverCapabilities.map((entry) => ({ placement: entry.placement, runtimeStatus: entry.runtimeStatus }))));
check("profile_registry_boundary", profileBoundary.runtimeProfiles?.length === 2 && profileBoundary.runtimeProfiles.every((entry) => entry.runtimeStatus === "IMPLEMENTED") && profileBoundary.feedBoundary?.singleImageSourceProfiles === "CATALOG_ONLY", JSON.stringify(profileBoundary));
check("version_alignment", (versions.documentVersion?.current === "1.22.0" && versions.freeformFormatProfileRegistryVersion === "1.3.0" && versions.canonicalPhaseN4?.rendererCoreVersion === "0.7.0" && versions.canonicalPhaseN4?.integrationContractCurrent === "1.8.0" && versions.canonicalPhaseM1?.metaRuntimeImplemented === true) || (versions.documentVersion?.current === "1.21.4" && versions.freeformFormatProfileRegistryVersion === "1.2.0" && versions.canonicalPhaseN4?.rendererCoreVersion === "0.7.0" && versions.canonicalPhaseN4?.integrationContractCurrent === "1.8.0"), JSON.stringify({ document: versions.documentVersion, profiles: versions.freeformFormatProfileRegistryVersion, phase: versions.canonicalPhaseN4, m1: versions.canonicalPhaseM1 }));
check("no_constrained_layout_mode", !(profilesRegistry.profiles ?? []).some((entry) => entry.layoutMode === "FREEFORM_CONSTRAINED"), "layoutMode axis remains TEMPLATE_LOCKED | FREEFORM");

for (const golden of [
  { id: "NAVER_MOBILE_DA", artifact: "fixtures/golden/naver-freeform/naver-mobile-da__jpeg.golden.jpg", manifest: "fixtures/golden/naver-freeform/naver-mobile-da__jpeg.manifest.json", format: "JPEG", minimum: 50000, maximum: 250000 },
  { id: "NAVER_IMAGE_BANNER_1_1", artifact: "fixtures/golden/naver-freeform/naver-image-banner-1x1__png.golden.png", manifest: "fixtures/golden/naver-freeform/naver-image-banner-1x1__png.manifest.json", format: "PNG", minimum: 80000, maximum: 800000 },
]) {
  try {
    const bytes = await readFile(path.join(root, golden.artifact));
    const manifest = JSON.parse(await readFile(path.join(root, golden.manifest), "utf8"));
    check(`golden_${golden.id}`, manifest.formatProfileId === golden.id && manifest.outputEncoding?.format === golden.format && manifest.outputArtifactDigest === sha256(bytes) && !Object.prototype.hasOwnProperty.call(manifest, "manifestDigest") && bytes.byteLength >= golden.minimum && bytes.byteLength <= golden.maximum, JSON.stringify({ profile: manifest.formatProfileId, format: manifest.outputEncoding?.format, bytes: bytes.byteLength, digest: sha256(bytes) }));
  } catch (error) {
    fail(`golden_${golden.id}`, error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error(`Naver FREEFORM contract verification failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`PASS naver_freeform_contract_verification: ${Object.keys(expected).length} source-backed runtime profiles and feed boundary verified`);
}
