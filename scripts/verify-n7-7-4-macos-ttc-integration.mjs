import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const checks = [];
const expectedCollectionSha = "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66";
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const sha256 = (relativePath) => createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

const audit = readJson("contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json");
const versions = readJson("contracts/contract-versions.json");
const policy = readJson("contracts/naver-smartchannel-runtime-font-policy.json");
const contract = readJson("contracts/naver-smartchannel-font-contract.json");
const manifest = readJson("contracts/naver-smartchannel-font-asset-manifest.json");
const inventory = readJson("artifacts/n7-7-4/ttc-face-inventory.json");
const equivalence = readJson("artifacts/n7-7-4/derived-face-equivalence.json");
const metrics = readJson("artifacts/n7-7-4/representative-ab-diff-metrics.json");
const representativeManifest = readJson("artifacts/n7-7-4/representative-macos-ttc.manifest.json");
const parity = readJson("artifacts/n7-7-4/font-provider-parity.json");
const backend = readJson("artifacts/n7-7-4/font-backend-audit.json");
const smoke = readJson("artifacts/n7-7-4/smartchannel-120-smoke.json");

check("phase", audit.phase.id === "N7_7_4_MACOS_ORIGINAL_TTC_RENDERER_INTEGRATION" && audit.phase.status === "PASS", JSON.stringify(audit.phase));
check("versions", versions.documentVersion.current === "1.21.3" && versions.desktopAppVersion === "0.9.8" && versions.canonicalPhaseN7_7_4.rendererCoreVersion === "0.8.5" && contract.registryVersion === "1.2.0" && policy.registryVersion === "1.5.0" && manifest.manifestVersion === "1.2.0", JSON.stringify(versions.canonicalPhaseN7_7_4));
check("source_collection", fs.statSync(path.join(root, manifest.source.relativePath)).size === 28427796 && sha256(manifest.source.relativePath) === expectedCollectionSha && manifest.source.sha256 === expectedCollectionSha, JSON.stringify(manifest.source));
check("inventory", inventory.faceCount === 18 && inventory.source.sha256 === expectedCollectionSha, JSON.stringify({ faceCount: inventory.faceCount, source: inventory.source }));
const expectedFaces = [
  { index: 0, postScriptName: "AppleSDGothicNeo-Regular" },
  { index: 4, postScriptName: "AppleSDGothicNeo-SemiBold" },
  { index: 6, postScriptName: "AppleSDGothicNeo-Bold" },
];
check("required_faces", expectedFaces.every((expected) => { const face = inventory.faces[expected.index]; return face?.postScriptNames?.includes(expected.postScriptName) && face?.versions?.includes("19.0d2e1") && face?.unitsPerEm === 1000 && face?.glyphCount === 18662 && face?.outlineFormat === "CFF"; }), JSON.stringify(expectedFaces.map((expected) => inventory.faces[expected.index])));
check("backend_decision", backend.directTtc.supported === false && backend.integrationMode === "VERIFIED_DERIVED_STANDALONE_FACE" && backend.systemFontsDisabled === true && backend.directTtc.preflight?.systemFontsDisabled === true && backend.directTtc.preflight?.directMatchesRegular === true && backend.directTtc.preflight?.distinctRequiredFaces === true && backend.directTtc.preflight?.faces?.regular?.load === "PASS" && backend.directTtc.preflight?.faces?.semibold?.load === "FAIL" && backend.directTtc.preflight?.faces?.bold?.load === "FAIL", JSON.stringify(backend));
check("derived_equivalence", equivalence.sourceCollectionSha256 === expectedCollectionSha && equivalence.derived.length === 3 && equivalence.derived.every((face) => face.tableEquivalence.every((table) => table.status === "IDENTICAL" || table.status === "SEMANTICALLY_IDENTICAL_CHECKSUM_ADJUSTMENT_ONLY")), JSON.stringify(equivalence.derived.map((face) => ({ role: face.role, sha256: face.sha256, tables: face.tableEquivalence.length }))));
check("runtime_mapping", policy.runtimeAssets.filter((asset) => asset.required).length === 3 && policy.runtimeAssets.filter((asset) => asset.required).every((asset) => asset.resourceKind === "DERIVED_STANDALONE_FACE" && asset.sourceCollection.sha256 === expectedCollectionSha && sha256(asset.relativePath) === asset.runtimeDigest), JSON.stringify(policy.runtimeAssets.filter((asset) => asset.required).map((asset) => ({ id: asset.id, source: asset.sourceCollection, digest: asset.runtimeDigest }))));
check("fail_closed", policy.fallbackAllowed === false && ["FONT_RESOURCE_MISSING", "FONT_RESOURCE_SHA_MISMATCH", "FONT_COLLECTION_FACE_NOT_FOUND", "FONT_COLLECTION_FACE_IDENTITY_MISMATCH", "FONT_COLLECTION_UNSUPPORTED", "FONT_DERIVED_RESOURCE_PROVENANCE_MISMATCH"].every((code) => policy.preflight.errors.includes(code)), JSON.stringify(policy.preflight));
check("fingerprint_contract", JSON.stringify(policy.resourceProviderContract.fingerprintMaterial) === JSON.stringify(["fontToken", "collectionAssetId", "collectionDigest", "faceIndex", "facePostScriptName", "fontContractVersion"]) && policy.resourceProviderContract.physicalAbsolutePathIncluded === false, JSON.stringify(policy.resourceProviderContract));
check("representative", metrics.template === "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE" && metrics.geometryChanged === false && fs.existsSync(path.join(root, "artifacts/n7-7-4/representative-legacy-n77.png")) && fs.existsSync(path.join(root, "artifacts/n7-7-4/representative-macos-ttc.png")) && fs.existsSync(path.join(root, "artifacts/n7-7-4/representative-ab-diff.png")), JSON.stringify({ template: metrics.template, diff: metrics.pixelDiff }));
check("actual_raster_evidence", metrics.macosTtc.textRoles.every((role) => role.actualRasterBounds && role.inkBounds && role.scannedNonTransparentPixels > 0 && role.measuredGlyphWidth > 0), JSON.stringify(metrics.macosTtc.textRoles));
check("determinism", metrics.determinism.runs === 3 && metrics.determinism.pixelIdentical === true && metrics.determinism.outputBytesIdentical === true && new Set(metrics.determinism.pixelDigests).size === 1 && new Set(metrics.determinism.outputDigests).size === 1, JSON.stringify(metrics.determinism));
check("manual_acceptance", representativeManifest.manualAcceptance.approvedCreativeMatch.status === "NOT_REVIEWED", JSON.stringify(representativeManifest.manualAcceptance));
check("provider_parity", parity.status === "PASS" && parity.collectionShaMatch && parity.faceIndexMatch && parity.postScriptMatch && parity.pixelMatch && parity.pngMatch && parity.physicalAbsolutePathInFingerprint === false, JSON.stringify(parity));
check("smartchannel_120", smoke.attempted === 120 && smoke.rendered === 120 && smoke.fontResolutionErrors === 0 && smoke.newValidatorErrors === 0 && smoke.crashes === 0 && smoke.goldenRebasePerformed === false, JSON.stringify(smoke));
check("system_font_independence", policy.resourceProviderContract.systemFontLookupAllowed === false && policy.resourceProviderContract.windowsAbsoluteFontPathAllowed === false && policy.runtimeNetworkAccess === "PROHIBITED", JSON.stringify(policy.resourceProviderContract));
check("legacy_retained", ["AppleSDGothicNeo-Bold.ttf", "AppleSDGothicNeo-Regular.ttf", "AppleSDGothicNeo-SemiBold.ttf"].every((file) => fs.existsSync(path.join(root, "assets/fonts/naver-smartchannel", file))) && audit.legacyFont.convertedTtfRuntimeStatus === "DEPRECATED_FOR_SMARTCHANNEL" && audit.legacyFont.deleted === false, JSON.stringify(audit.legacyFont));
const coreText = ["src/core/naver-smartchannel.ts", "src/core/naver-smartchannel-font-preflight.ts"].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
check("no_absolute_path_in_core", !/C:\\Users\\/u.test(coreText) && !coreText.includes("C:/Users/"), "Core contains no machine-specific absolute path");
check("no_runtime_network_or_plume", !/\bfetch\s*\(|https?:\/\//u.test(coreText) && !/plume/iu.test(coreText) && !/plume/iu.test(fs.readFileSync(path.join(root, "package.json"), "utf8")), "Core/package contains no runtime network call or plume dependency");

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
console.log(JSON.stringify({ status: failures.length === 0 ? "PASS" : "FAIL", checks: checks.length, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
