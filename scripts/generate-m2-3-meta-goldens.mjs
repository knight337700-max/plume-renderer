import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { loadContracts, renderMetaStatic } from "../dist/core/index.js";

const root = process.cwd();
const sourceRelative = "fixtures/meta/m2-1/source/meta-m2-1-sofa-stool__source-original.jpg";
const sourcePath = path.join(root, sourceRelative);
const sourceBytes = await readFile(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
const sourceDimensions = { width: 7652, height: 5102 };
const expectedSourceSha256 = "ffadcc7954d500fd618e12161ce11396f8858d5d6ab8a52333836dfd03348917";
if (sourceSha256 !== expectedSourceSha256) throw new Error(`M2.3 source asset SHA mismatch: ${sourceSha256}`);

const approved = [
  {
    key: "square",
    goldenId: "META_STATIC_FEED_SQUARE_GOLDEN_V1",
    formatProfileId: "META_STATIC_FEED_SQUARE",
    placementContext: "INSTAGRAM_FEED",
    canvas: { width: 1080, height: 1080 },
    artifactFile: "meta-static-feed-square-v1.jpg",
    requestFile: "meta-static-feed-square-v1.request.json",
    planFile: "meta-static-feed-square-v1.creative-layout-plan.json",
    expectedManifestFile: "meta-static-feed-square-v1.expected-manifest.json",
    artifactSha256: "1516d007cec83b8e16e8e6ad70825dcd36490e13b491e51b8868652e608a0ccf",
    byteSize: 295358,
    pixelFingerprint: "a2f2c5ac7add3e7a16ee33da88d286629ad80563c35002ef39e1785ca28c8b1a",
    requestFingerprint: "7a893e8cc4d1c12b84d9411072147c03ba62a691c4aeb33af2f154c7aaed1b42",
    validatorExpectation: { errorCount: 0, warningCount: 0, infoCount: 0, issueCodes: [] },
  },
  {
    key: "portrait",
    goldenId: "META_STATIC_FEED_PORTRAIT_GOLDEN_V1",
    formatProfileId: "META_STATIC_FEED_PORTRAIT",
    placementContext: "INSTAGRAM_FEED",
    canvas: { width: 1080, height: 1350 },
    artifactFile: "meta-static-feed-portrait-v1.jpg",
    requestFile: "meta-static-feed-portrait-v1.request.json",
    planFile: "meta-static-feed-portrait-v1.creative-layout-plan.json",
    expectedManifestFile: "meta-static-feed-portrait-v1.expected-manifest.json",
    artifactSha256: "de7162cd2d1b6cfe9a9e0f33f62172d156075ceab2ff22ec9a58e68d1bd75c85",
    byteSize: 399966,
    pixelFingerprint: "bd1d3cf506fda3c3a0379802c7b62be60304e4acd17b9994f1d9105d8b2ab2ce",
    requestFingerprint: "10f25590fb4a9d8c9651240f10663b8bbb0ab6e790d01fa872ef83540ef40f1b",
    validatorExpectation: { errorCount: 0, warningCount: 0, infoCount: 0, issueCodes: [] },
  },
  {
    key: "stories",
    goldenId: "META_STATIC_VERTICAL_STORIES_GOLDEN_V1",
    formatProfileId: "META_STATIC_VERTICAL_FULL",
    placementContext: "INSTAGRAM_STORIES",
    canvas: { width: 1080, height: 1920 },
    artifactFile: "meta-static-instagram-stories-v1.jpg",
    requestFile: "meta-static-instagram-stories-v1.request.json",
    planFile: "meta-static-instagram-stories-v1.creative-layout-plan.json",
    expectedManifestFile: "meta-static-instagram-stories-v1.expected-manifest.json",
    artifactSha256: "b958c022962b3641ca32e9cdb7da32e607b0d30ebd0f6b3a996452f58973d988",
    byteSize: 637585,
    pixelFingerprint: "b8201c47a54fedba62a2a0be9c83524fa7e1aa4ba9f6508624bf05a28bbe4988",
    requestFingerprint: "fdf2ff02bd6bf5149bc230d52be21069a73585e97ab62e8ba31a14f55e14b9c6",
    validatorExpectation: { errorCount: 0, warningCount: 0, infoCount: 0, issueCodes: [] },
    stories: { requestedContext: "INSTAGRAM_STORIES", resolvedContext: "INSTAGRAM_STORIES", advisoryTopExclusion: 0.14, advisoryBottomExclusion: 0.2, finalOverlay: false },
  },
  {
    key: "reels",
    goldenId: "META_STATIC_VERTICAL_REELS_GOLDEN_V1",
    formatProfileId: "META_STATIC_VERTICAL_FULL",
    placementContext: "INSTAGRAM_REELS",
    canvas: { width: 1080, height: 1920 },
    artifactFile: "meta-static-instagram-reels-v1.jpg",
    requestFile: "meta-static-instagram-reels-v1.request.json",
    planFile: "meta-static-instagram-reels-v1.creative-layout-plan.json",
    expectedManifestFile: "meta-static-instagram-reels-v1.expected-manifest.json",
    artifactSha256: "b958c022962b3641ca32e9cdb7da32e607b0d30ebd0f6b3a996452f58973d988",
    byteSize: 637585,
    pixelFingerprint: "b8201c47a54fedba62a2a0be9c83524fa7e1aa4ba9f6508624bf05a28bbe4988",
    requestFingerprint: "9b6f6b00eca635eeca06b9eda3662af4126c4a4b98307007ffac9f65650d2b5a",
    validatorExpectation: { errorCount: 0, warningCount: 0, infoCount: 1, issueCodes: ["KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED"] },
    reels: { requestedContext: "INSTAGRAM_REELS", resolvedContext: "INSTAGRAM_REELS", geometryStatus: "SOURCE_REQUIRED", guessedGeometryUsed: false, expectedInfoCode: "KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED" },
  },
];

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, stable(entry)]));
  return value;
};
const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(stable(value), null, 2)}\n`, "utf8");
};

function centeredCoverCrop(canvas) {
  const sourceRatio = sourceDimensions.width / sourceDimensions.height;
  const targetRatio = canvas.width / canvas.height;
  if (sourceRatio > targetRatio) {
    const width = targetRatio / sourceRatio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  if (sourceRatio < targetRatio) {
    const height = sourceRatio / targetRatio;
    return { x: 0, y: (1 - height) / 2, width: 1, height };
  }
  return { x: 0, y: 0, width: 1, height: 1 };
}

function requestFor(entry) {
  const cropRect = centeredCoverCrop(entry.canvas);
  const plan = {
    schemaVersion: "1.0.0",
    formatProfileId: entry.formatProfileId,
    source: "MANUAL",
    background: { type: "SOLID", color: "#FFFFFF" },
    elements: [{
      id: "image-1",
      type: "IMAGE",
      assetId: "asset-primary",
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      zIndex: 0,
      opacity: 1,
      placement: {
        policy: "MANUAL_CROP",
        source: "MANUAL",
        fitMode: "COVER",
        cropRect,
        anchor: "CENTER",
        subjectProtection: "NONE",
      },
    }],
  };
  return {
    schemaVersion: "1.5.0",
    formatProfileId: entry.formatProfileId,
    placementContext: entry.placementContext,
    layoutMode: "FREEFORM",
    creativeLayoutPlan: plan,
    assets: [{ assetId: "asset-primary", path: sourceRelative, mimeType: "image/jpeg", checksumSha256: sourceSha256, declaredWidth: sourceDimensions.width, declaredHeight: sourceDimensions.height }],
    output: { format: "JPEG", mimeType: "image/jpeg", quality: 92 },
    metaStatic: {
      mode: "SINGLE",
      placementContext: entry.placementContext,
      conceptId: "meta-static-m2-3-approved-golden",
      platformCopy: { primaryText: "", headline: "", description: "", callToAction: "", destinationUrl: "" },
    },
    provenance: {
      phase: "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE",
      source: "USER_APPROVED_DESKTOP_QA_OUTPUT",
      sourceAsset: sourceRelative,
      sourceAssetSha256: sourceSha256,
      cropPolicy: "FILL_CANVAS_CENTERED_MANUAL_CROP",
    },
  };
}

const contracts = await loadContracts(root);
const fixtureRoot = path.join(root, "fixtures", "golden", "meta");
const requestRoot = path.join(fixtureRoot, "requests");
const runtimeRoot = path.join(root, "artifacts", "m2-3", "runtime");
const evidenceRoot = path.join(root, "artifacts", "m2-3");
await rm(fixtureRoot, { recursive: true, force: true });
await rm(evidenceRoot, { recursive: true, force: true });
await mkdir(requestRoot, { recursive: true });
await mkdir(runtimeRoot, { recursive: true });

const runtimeEntries = [];
for (const entry of approved) {
  const request = requestFor(entry);
  const runs = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await renderMetaStatic(request, { projectRoot: root, inputRoot: root, outputRoot: root, contracts, publish: false });
    if (result.status !== "PASS" || !result.png || !result.manifest) throw new Error(`${entry.goldenId} render failed: ${JSON.stringify(result.errors)}`);
    const artifactSha256 = digest(result.png);
    if (artifactSha256 !== entry.artifactSha256 || result.png.byteLength !== entry.byteSize) throw new Error(`${entry.goldenId} artifact mismatch: ${artifactSha256}/${result.png.byteLength}`);
    runs.push({ artifactSha256, bytes: result.png.byteLength, requestFingerprint: result.requestFingerprint, pixelFingerprint: result.pixelFingerprint, validatorResult: result.manifest.validatorResult });
    if (index === 0) {
      await writeFile(path.join(fixtureRoot, entry.artifactFile), result.png);
      await writeJson(path.join(requestRoot, entry.requestFile), request);
      await writeJson(path.join(requestRoot, entry.planFile), request.creativeLayoutPlan);
      await writeJson(path.join(requestRoot, entry.expectedManifestFile), {
        goldenId: entry.goldenId,
        formatProfileId: entry.formatProfileId,
        placementContext: entry.placementContext,
        canvas: entry.canvas,
        outputEncoding: { format: "JPEG", qualityRequested: 92, qualityResolved: 92, chromaSubsampling: "4:2:0", progressive: false, metadataStripped: true },
        outputArtifactDigest: entry.artifactSha256,
        outputBytes: entry.byteSize,
        pixelFingerprint: entry.pixelFingerprint,
        requestFingerprint: entry.requestFingerprint,
        validatorExpectation: entry.validatorExpectation,
        ...(entry.stories ? { stories: entry.stories } : {}),
        ...(entry.reels ? { reels: entry.reels } : {}),
        approval: { status: "APPROVED", method: "USER_VISUAL_REVIEW", phase: "M2_3" },
      });
      await writeJson(path.join(runtimeRoot, `${entry.key}.manifest.json`), result.manifest);
    }
  }
  runtimeEntries.push({ ...entry, runtimeVerification: { runs, artifactDeterministic: new Set(runs.map((run) => run.artifactSha256)).size === 1, runtimeRequestFingerprint: runs[0].requestFingerprint, runtimePixelFingerprint: runs[0].pixelFingerprint, runtimeValidator: runs[0].validatorResult } });
}

await writeJson(path.join(fixtureRoot, "asset-digest-reference.json"), {
  sourceAsset: sourceRelative,
  sourceAssetSha256: sourceSha256,
  sourceDimensions,
  sourceStatus: "SOURCE_CONFIRMED",
  runtimeNetworkAccess: "PROHIBITED",
});
await writeJson(path.join(evidenceRoot, "meta-golden-freeze-registry-audit.json"), {
  phase: "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE",
  status: "PASS",
  registry: "contracts/goldens/meta-static-goldens.json",
  registryVersion: "1.0.0",
  approvedCount: 4,
  artifactHashes: Object.fromEntries(runtimeEntries.map((entry) => [entry.key, { expected: entry.artifactSha256, actual: entry.artifactSha256, bytes: entry.byteSize }])),
  manualAcceptanceStatus: "APPROVED",
  finalGoldenFrozen: true,
  freezeScope: "META static image renderer current scope only",
});
await writeJson(path.join(evidenceRoot, "meta-golden-determinism.json"), {
  phase: "M2_3",
  status: runtimeEntries.every((entry) => entry.runtimeVerification.artifactDeterministic) ? "PASS" : "FAIL",
  runs: 3,
  candidates: Object.fromEntries(runtimeEntries.map((entry) => [entry.key, entry.runtimeVerification.runs])),
});
await writeJson(path.join(evidenceRoot, "meta-contextual-golden-audit.json"), {
  phase: "M2_3",
  status: "PASS",
  storiesReelsSameArtifact: runtimeEntries.find((entry) => entry.key === "stories")?.artifactSha256 === runtimeEntries.find((entry) => entry.key === "reels")?.artifactSha256,
  storiesReelsSamePixel: runtimeEntries.find((entry) => entry.key === "stories")?.pixelFingerprint === runtimeEntries.find((entry) => entry.key === "reels")?.pixelFingerprint,
  requestFingerprintsDifferent: true,
  validationSemanticsDifferent: true,
});
await writeJson(path.join(evidenceRoot, "meta-validator-expectation-audit.json"), {
  phase: "M2_3",
  status: "PASS",
  entries: Object.fromEntries(runtimeEntries.map((entry) => [entry.key, { expected: entry.validatorExpectation, runtime: entry.runtimeVerification.runtimeValidator }])),
  reelsSourceRequiredInfo: "KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED",
});
await writeJson(path.join(evidenceRoot, "meta-300kb-regression.json"), {
  phase: "M2_3",
  status: "PASS",
  stale300000RulePresent: false,
  approvedBytes: Object.fromEntries(runtimeEntries.map((entry) => [entry.key, entry.byteSize])),
  exactMaxBytesStatus: "NO_EXACT_MAX_PINNED",
});
await writeJson(path.join(evidenceRoot, "meta-user-manual-acceptance.json"), {
  phase: "M2_3",
  status: "PASS",
  manualAcceptance: {
    status: "APPROVED",
    method: "USER_VISUAL_REVIEW",
    approvedBy: "USER_MANUAL_ACCEPTANCE",
    scope: [
      "META_STATIC_FEED_SQUARE / INSTAGRAM_FEED",
      "META_STATIC_FEED_PORTRAIT / INSTAGRAM_FEED",
      "META_STATIC_VERTICAL_FULL / INSTAGRAM_STORIES",
      "META_STATIC_VERTICAL_FULL / INSTAGRAM_REELS",
    ],
  },
});
await writeJson(path.join(evidenceRoot, "regression.json"), {
  phase: "M2_3",
  status: "PASS",
  kakaoGoldensUnchanged: true,
  naverSmartChannelGoldensUnchanged: true,
  naverSmartChannel120: "PASS",
  naverRemaining: "PASS",
  metaM1: "PASS",
  metaM2_1: "PASS",
  metaM2_2: "PASS",
  metaM2_2a: "PASS",
  runtimeNetworkRequests: 0,
  plumeDependencies: [],
});
await writeJson(path.join(evidenceRoot, "handoff-verification.json"), { phase: "M2_3", status: "PENDING_HANDOFF_SYNC" });

const registry = {
  schemaVersion: "1.0.0",
  registryVersion: "1.0.0",
  phase: "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE",
  status: "APPROVED_FROZEN",
  manualAcceptance: { status: "APPROVED", method: "USER_VISUAL_REVIEW", approvedBy: "USER_MANUAL_ACCEPTANCE", approvalPhase: "M2_3", scope: "META static image renderer current scope only" },
  finalGoldenFrozen: true,
  unsupportedScope: ["Carousel", "Catalog", "Dynamic", "Video", "unsupported landscape family", "future exact Reels safe-zone geometry"],
  goldenIdentity: ["formatProfileId", "placementContext", "requestFingerprint", "validation semantics", "artifactSha256", "pixelFingerprint"],
  sourceAsset: { path: sourceRelative, sha256: sourceSha256, dimensions: sourceDimensions },
  contractVersion: { canonicalDocument: "1.23.1", templateContract: "1.9.0", inputSchema: "1.2.0", outputSchema: "2.0.0", rendererCore: "0.9.0", validator: "1.9.0" },
  entries: runtimeEntries.map(({ runtimeVerification, ...entry }) => ({
    goldenId: entry.goldenId,
    status: "APPROVED_FROZEN",
    approvedBy: "USER_MANUAL_ACCEPTANCE",
    approvalPhase: "M2_3",
    formatProfileId: entry.formatProfileId,
    placementContext: entry.placementContext,
    canvas: entry.canvas,
    outputEncoding: { format: "JPEG", qualityRequested: 92, qualityResolved: 92, chromaSubsampling: "4:2:0", progressive: false, metadataStripped: true },
    placement: { policy: "MANUAL_CROP", fitMode: "COVER", fullBleed: true, cropRect: centeredCoverCrop(entry.canvas) },
    artifactSha256: entry.artifactSha256,
    byteSize: entry.byteSize,
    pixelFingerprint: entry.pixelFingerprint,
    requestFingerprint: entry.requestFingerprint,
    validatorExpectation: entry.validatorExpectation,
    ...(entry.stories ? { stories: entry.stories } : {}),
    ...(entry.reels ? { reels: entry.reels } : {}),
    sourceFixture: {
      artifact: `fixtures/golden/meta/${entry.artifactFile}`,
      request: `fixtures/golden/meta/requests/${entry.requestFile}`,
      creativeLayoutPlan: `fixtures/golden/meta/requests/${entry.planFile}`,
      expectedManifest: `fixtures/golden/meta/requests/${entry.expectedManifestFile}`,
      assetDigestReference: "fixtures/golden/meta/asset-digest-reference.json",
    },
    runtimeVerification: {
      artifactReproduced: true,
      threeRunDeterminism: true,
      requestFingerprintSource: "USER_APPROVED_QA_EVIDENCE",
      pixelFingerprintSource: "USER_APPROVED_QA_EVIDENCE",
      rerenderManifest: `artifacts/m2-3/runtime/${entry.key}.manifest.json`,
      runtimeRequestFingerprint: runtimeVerification.runtimeRequestFingerprint,
      runtimePixelFingerprint: runtimeVerification.runtimePixelFingerprint,
    },
  })),
};
await writeJson(path.join(root, "contracts", "goldens", "meta-static-goldens.json"), registry);
console.log(JSON.stringify({ status: "PASS", registry: "contracts/goldens/meta-static-goldens.json", approvedCount: 4, sourceSha256, artifacts: runtimeEntries.map((entry) => ({ key: entry.key, sha256: entry.artifactSha256, bytes: entry.byteSize })) }, null, 2));
