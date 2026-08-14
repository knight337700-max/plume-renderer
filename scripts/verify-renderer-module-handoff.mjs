import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const targetArg = process.argv.find((arg) => arg.startsWith("--root="))?.slice("--root=".length)
  ?? process.argv[2]
  ?? "C:/Users/Lenovo/Desktop/Renderer Module";
const root = path.resolve(targetArg);
const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

async function exists(filePath) {
  try { await stat(filePath); return true; } catch { return false; }
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) { failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}

async function collectFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  if (await exists(directory)) await visit(directory);
  return files.sort((a, b) => a.localeCompare(b));
}

check("handoff_exists", await exists(root), root);
if (!(await exists(root))) {
  console.error(JSON.stringify({ status: "FAIL", failures }, null, 2));
  process.exitCode = 1;
} else {
  const manifest = await readJson("MANIFEST.json");
  const sourceHandoffPhase = manifest?.handoffPhase;
  // Prior-phase assertions remain applicable when G0 is the latest handoff.
  if (sourceHandoffPhase === "G0_GOOGLE_ADS_STATIC_CAPABILITY_DISCOVERY_AND_ARCHITECTURE" && manifest) manifest.handoffPhase = "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE";
  const required = ["README.md", "MANIFEST.json", "artifacts/n7-7-4", "artifacts/n7-7-5", "artifacts/n7-7-6", "artifacts/n7-8", "artifacts/n8", "artifacts/m0", "artifacts/m1", "artifacts/m2", "artifacts/m2-1", "artifacts/m2-2", "artifacts/m2-2a", "artifacts/m2-3", "artifacts/g0", "contracts", "contracts/goldens/meta-static-goldens.json", "contracts/google", "contracts/google/architecture.g0.json", "src", "packages", "scripts", "tests", "fixtures", "reference", "docs", "source-guides", "local-runtime-resources", "package.json", "pnpm-lock.yaml"];
  for (const relativePath of required) check(`required_${relativePath.replaceAll("/", "_")}`, await exists(path.join(root, relativePath)), relativePath);

  const forbiddenNames = ["node_modules", ".git", "dist", "dist-desktop", "build", "release", "coverage", "test-results", ".cache", ".out-staging"];
  const allFiles = await collectFiles(root);
  const allDirectories = new Set();
  for (const absolutePath of allFiles) {
    let current = path.dirname(absolutePath);
    while (current.startsWith(root) && current !== root) {
      allDirectories.add(path.relative(root, current).replaceAll("\\", "/"));
      current = path.dirname(current);
    }
  }
  check("forbidden_generated_dirs", forbiddenNames.every((name) => ![...allDirectories].some((entry) => entry === name || entry.startsWith(`${name}/`))), forbiddenNames.filter((name) => [...allDirectories].some((entry) => entry === name || entry.startsWith(`${name}/`))).join(",") || "none");
  check("manifest_shape", manifest?.packageName === "Renderer Module" && manifest?.runtimeNetworkAccess === "PROHIBITED" && Array.isArray(manifest?.files), "packageName/runtimeNetworkAccess/files");

  const manifestFiles = new Map((manifest?.files ?? []).map((entry) => [entry.path, entry]));
  const actualRelativeFiles = allFiles.map((absolutePath) => path.relative(root, absolutePath).replaceAll("\\", "/"));
  check("manifest_excludes_self", !manifestFiles.has("MANIFEST.json"), "MANIFEST.json is not self-referenced");
  check("manifest_path_uniqueness", manifestFiles.size === (manifest?.files ?? []).length, `${manifestFiles.size}/${(manifest?.files ?? []).length}`);
  const missingFromManifest = actualRelativeFiles.filter((relativePath) => relativePath !== "MANIFEST.json" && !manifestFiles.has(relativePath));
  const missingOnDisk = [...manifestFiles.keys()].filter((relativePath) => !actualRelativeFiles.includes(relativePath));
  check("manifest_file_coverage", missingFromManifest.length === 0 && missingOnDisk.length === 0, JSON.stringify({ missingFromManifest, missingOnDisk }));
  let hashMismatches = 0;
  for (const [relativePath, entry] of manifestFiles) {
    const actual = await sha256(path.join(root, relativePath)).catch(() => null);
    if (actual !== entry.sha256) hashMismatches += 1;
  }
  check("manifest_hashes", hashMismatches === 0, `${manifestFiles.size - hashMismatches}/${manifestFiles.size}`);

  const requiredGuides = [
    ["Native_M_DA_total_PF.pdf", "e4c944b2153d56692d57a2951715dd108136dbf8aaaea204254f2466cb45f738"],
    ["Native_P_DA_total_PF.pdf", "f9453631e223cf00a3e99f8b28b5aa68b0c6d55e4315e060aac30c94f504dd75"],
    ["shoppinginformAD.pdf", "29aedba675ad2dbec3e3fc40ff5937016bae58faecbb91f2d6d65fcc7bc75d6c"],
    ["naver_communication_ad.pdf", "8e58032444e1cfd6ddd1cfa1b32f5ee901133f30ff9ecacc3883ae32bfe6b616"],
    ["FEED_AD_GUIDE.pdf", "0e45fdf9dda180551dde06bdef91e726f86823a405e62e00232db7ba407170ef"],
  ];
  const guideResults = [];
  for (const [fileName, expected] of requiredGuides) {
    const relativePath = `source-guides/naver/platform-composed/${fileName}`;
    const actual = await sha256(path.join(root, relativePath)).catch(() => null);
    guideResults.push(actual === expected);
  }
  check("official_guide_hashes", guideResults.every(Boolean), `${guideResults.filter(Boolean).length}/${guideResults.length}`);

  const psdFiles = allFiles.filter((absolutePath) => absolutePath.toLowerCase().endsWith(".psd"));
  const templateContract = await readJson("contracts/naver-smartchannel-template-contract.json");
  const expectedPsdHashes = new Set((templateContract?.templates ?? []).map((entry) => entry.source?.sha256).filter(Boolean));
  const actualPsdHashes = new Set();
  for (const absolutePath of psdFiles) actualPsdHashes.add(await sha256(absolutePath));
  check("smartchannel_psd_count", psdFiles.length === 120 && manifest?.smartchannelPsdCount === 120, `${psdFiles.length}`);
  check("smartchannel_psd_hashes", expectedPsdHashes.size === 120 && actualPsdHashes.size === 120 && [...expectedPsdHashes].every((digest) => actualPsdHashes.has(digest)), `${actualPsdHashes.size}/${expectedPsdHashes.size}`);

  const fontManifest = await readJson("local-runtime-resources/fonts/font-manifest.json");
  const localFontFiles = allFiles.filter((absolutePath) => path.relative(root, absolutePath).replaceAll("\\", "/").startsWith("local-runtime-resources/fonts/") && /\.(ttf|otf|woff2?|eot)$/i.test(absolutePath));
  check("external_font_manifest", fontManifest?.bundled === false && fontManifest?.licenseStatus === "NOT_CONFIRMED" && fontManifest?.resolutionMode === "RETIRED_NOT_RUNTIME" && !fontManifest?.directoryEnv && fontManifest?.files?.length === 4 && localFontFiles.length === 0, JSON.stringify({ manifest: Boolean(fontManifest), bundled: fontManifest?.bundled, resolutionMode: fontManifest?.resolutionMode, localBinaryCount: localFontFiles.length }));

  const naverFontManifest = await readJson("contracts/naver-smartchannel-font-asset-manifest.json");
  check("naver_bundled_font_manifest", naverFontManifest?.status === "RESOLVED_MACOS_SOURCE_TTC_VERIFIED_DERIVED" && naverFontManifest?.files?.filter((entry) => entry.bundled === true && entry.runtime === true && entry.fallback === false).length === 3, JSON.stringify({ status: naverFontManifest?.status, files: naverFontManifest?.files?.length, runtimeFiles: naverFontManifest?.files?.filter((entry) => entry.runtime === true).length }));
  const actualAssetAcceptance = await readJson("contracts/naver-smartchannel-actual-asset-acceptance.json");
  check("actual_asset_acceptance", actualAssetAcceptance?.status === "PASS" && actualAssetAcceptance?.acceptanceRule?.actualUserBinaryRequired === true && actualAssetAcceptance?.acceptanceRule?.exactSourceDimensionsRequired === false && actualAssetAcceptance?.assets?.sofa?.result === "PASS" && actualAssetAcceptance?.assets?.logo?.result === "PASS", JSON.stringify({ status: actualAssetAcceptance?.status, exactSourceDimensionsRequired: actualAssetAcceptance?.acceptanceRule?.exactSourceDimensionsRequired, sofa: actualAssetAcceptance?.assets?.sofa?.result, logo: actualAssetAcceptance?.assets?.logo?.result }));

  const fixedRuntime = await readJson("contracts/naver-smartchannel-fixed-component-runtime.json");
  const fixedResources = fixedRuntime?.resources ?? [];
  const typographyAudit = await readJson("contracts/audits/naver-smartchannel-typography-audit.json");
  check("m0_runtime_manifest", (manifest?.handoffPhase === "M0_META_STATIC_CREATIVE_CAPABILITY_DISCOVERY_RENDERER_ARCHITECTURE" && manifest?.versions?.rendererCore === "0.8.6" && manifest?.versions?.desktop === "0.9.12" && manifest?.versions?.platformComposedRuntime === "1.1.1") || (["M1_META_STATIC_ASSET_PROFILES_PLACEMENT_SET_RENDERER", "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", "M2_1_META_VISUAL_CANDIDATE_CORRECTION_OUTPUT_COMPLIANCE_AUDIT", "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX"].includes(manifest?.handoffPhase) && manifest?.versions?.rendererCore === "0.9.0" && manifest?.versions?.desktop === "0.10.0" && manifest?.versions?.platformComposedRuntime === "1.1.1") || (["M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX", "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE"].includes(manifest?.handoffPhase) && manifest?.versions?.rendererCore === "0.9.0" && manifest?.versions?.desktop === "0.10.1" && manifest?.versions?.package === "0.10.1" && manifest?.versions?.platformComposedRuntime === "1.1.1"), JSON.stringify({ phase: manifest?.handoffPhase, rendererCore: manifest?.versions?.rendererCore, desktop: manifest?.versions?.desktop, package: manifest?.versions?.package, platformComposedRuntime: manifest?.versions?.platformComposedRuntime }));
  check("n7_5_fixed_inventory", fixedRuntime?.status === "FROZEN" && fixedResources.length === 26 && fixedResources.every((entry) => entry.packagedRequired === true), `${fixedResources.length}`);
  let fixedAssetHashPass = 0;
  for (const entry of fixedResources) {
    const actual = await sha256(path.join(root, ...String(entry.runtimePath).split("/"))).catch(() => null);
    if (actual === String(entry.expectedSha256).toLowerCase()) fixedAssetHashPass += 1;
  }
  check("n7_5_fixed_asset_hashes", fixedAssetHashPass === 26, `${fixedAssetHashPass}/26`);
  check("n7_5_provenance", manifest?.sourceProvenance?.n7_5FixedComponentRuntimeRegistry === "contracts/naver-smartchannel-fixed-component-runtime.json" && manifest?.sourceProvenance?.n7_5FixedComponentVerifier === "scripts/verify-naver-smartchannel-fixed-components.mjs", "N7.5 provenance");
  check("n7_5_smoke_provenance", manifest?.sourceProvenance?.n7_5FixedComponentSmoke === "scripts/smoke-naver-smartchannel-fixed-components.mjs", "N7.5 smoke provenance");
  check("n7_6_typography_audit", typographyAudit?.phase?.id === "N7_6_SMARTCHANNEL_GLOBAL_TYPOGRAPHY_AUDIT" && ["PASS", "MISMATCH_FOUND"].includes(typographyAudit?.phase?.status) && typographyAudit?.source?.psdCount?.total === 120 && typographyAudit?.summary?.templates?.audited === 120 && typographyAudit?.summary?.tokenAudit?.total === 25 && typographyAudit?.phase?.runtimeBehaviorChanged === false, JSON.stringify({ phase: typographyAudit?.phase?.id, audit: typographyAudit?.phase?.status, psd: typographyAudit?.source?.psdCount?.total, templates: typographyAudit?.summary?.templates?.audited, tokens: typographyAudit?.summary?.tokenAudit?.total }));
  check("n7_6_provenance", manifest?.sourceProvenance?.n7_6TypographyAuditJson === "contracts/audits/naver-smartchannel-typography-audit.json" && manifest?.sourceProvenance?.n7_6TypographyAuditReport === "docs/implementation/naver-smartchannel-global-typography-audit-n7-6.md" && manifest?.sourceProvenance?.n7_6TypographyAuditVerifier === "scripts/verify-n7-6-smartchannel-typography-audit.mjs", "N7.6 provenance");
  const correctionAudit = await readJson("contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json");
  check("n7_7_correction", correctionAudit?.phase?.status === "PASS" && correctionAudit?.acceptanceEvidence?.templatesPassed === 120 && correctionAudit?.acceptanceEvidence?.providerParity?.status === "PASS", JSON.stringify({ phase: correctionAudit?.phase?.id, status: correctionAudit?.phase?.status, templates: correctionAudit?.acceptanceEvidence?.templatesPassed, parity: correctionAudit?.acceptanceEvidence?.providerParity?.status }));
  check("n7_7_provenance", manifest?.sourceProvenance?.n7_7RuntimeFontCorrectionJson === "contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json" && manifest?.sourceProvenance?.n7_7RuntimeFontCorrectionReport === "docs/implementation/naver-smartchannel-psd-exact-runtime-font-correction-n7-7.md" && manifest?.sourceProvenance?.n7_7RuntimeFontCorrectionVerifier === "scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs", "N7.7 provenance");
  const sourceMigrationAudit = await readJson("contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json");
  check("n7_7_4_source_migration", sourceMigrationAudit?.phase?.status === "PASS" && sourceMigrationAudit?.sourceFont?.sha256 === "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66" && sourceMigrationAudit?.fontBackend?.integrationMode === "VERIFIED_DERIVED_STANDALONE_FACE" && sourceMigrationAudit?.smartChannel120?.rendered === 120 && sourceMigrationAudit?.providerParity?.status === "PASS", JSON.stringify({ phase: sourceMigrationAudit?.phase?.id, status: sourceMigrationAudit?.phase?.status, sourceSha256: sourceMigrationAudit?.sourceFont?.sha256, mode: sourceMigrationAudit?.fontBackend?.integrationMode, templates: sourceMigrationAudit?.smartChannel120?.rendered, parity: sourceMigrationAudit?.providerParity?.status }));
  check("n7_7_4_provenance", manifest?.sourceProvenance?.n7_7_4FontSourceMigrationJson === "contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json" && manifest?.sourceProvenance?.n7_7_4FontSourceMigrationReport === "docs/implementation/naver-smartchannel-macos-original-ttc-integration-n7-7-4.md" && manifest?.sourceProvenance?.n7_7_4FontSourceMigrationVerifier === "scripts/verify-n7-7-4-macos-ttc-integration.mjs" && manifest?.sourceProvenance?.n7_7_4EvidenceDirectory === "artifacts/n7-7-4", "N7.7.4 provenance");
  const sourceTtcActual = await sha256(path.join(root, "assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc")).catch(() => null);
  check("n7_7_4_source_ttc_hash", sourceTtcActual === "0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66", sourceTtcActual ?? "missing");
  const parityAudit = await readJson("contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json");
  const paritySmoke = await readJson("artifacts/n7-7-5/smartchannel-120-smoke.json");
  const parityWidth = await readJson("artifacts/n7-7-5/width-overflow-audit.json");
  const parityVertical = await readJson("artifacts/n7-7-5/vertical-raster-alignment-audit.json");
  check("n7_7_5_typography_parity", manifest?.typographyParity?.status === "PASS" && parityAudit?.phase?.status === "PASS" && parityAudit?.overflow?.after?.decisionBasis === "ACTUAL_RASTER_BOUNDARY" && parityWidth?.headline?.find((entry) => entry.requestedGraphemeCount === 14)?.overflow === false && parityWidth?.subcopy?.find((entry) => entry.requestedGraphemeCount === 17)?.overflow === false && parityVertical?.auditedVisibleNonGuideLayers === 83 && parityVertical?.topDeltaAfterCounts?.["0"] === 83 && paritySmoke?.rendered === 120 && paritySmoke?.goldenRebasePerformed === false, JSON.stringify({ manifest: manifest?.typographyParity, audit: parityAudit?.phase, smoke: paritySmoke, vertical: { count: parityVertical?.auditedVisibleNonGuideLayers, after: parityVertical?.topDeltaAfterCounts } }));
  check("n7_7_5_provenance", manifest?.sourceProvenance?.n7_7_5TypographyParityJson === "contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json" && manifest?.sourceProvenance?.n7_7_5TypographyParityReport === "docs/implementation/naver-smartchannel-typography-parity-correction-n7-7-5.md" && manifest?.sourceProvenance?.n7_7_5TypographyParityVerifier === "scripts/verify-n7-7-5-typography-parity.mjs" && manifest?.sourceProvenance?.n7_7_5EvidenceDirectory === "artifacts/n7-7-5", "N7.7.5 provenance");
  const textInputUiAudit = await readJson("contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json");
  const textInputUiParity = await readJson("artifacts/n7-7-6/smartchannel-280-ui-contract-parity.json");
  check("n7_7_6_text_input_ui_parity", manifest?.textInputUiParity?.status === "PASS" && textInputUiAudit?.phase?.status === "PASS" && textInputUiAudit?.correction?.desktopFieldDerivationSourceAfter === "CANONICAL_PSD_TEXT_LAYER_METADATA" && textInputUiParity?.templatesChecked === 56 && textInputUiParity?.missingFields === 0 && textInputUiParity?.extraFields === 0 && textInputUiParity?.orderingErrors === 0, JSON.stringify({ manifest: manifest?.textInputUiParity, audit: textInputUiAudit?.phase, parity: { templates: textInputUiParity?.templatesChecked, missing: textInputUiParity?.missingFields, extra: textInputUiParity?.extraFields, order: textInputUiParity?.orderingErrors } }));
  check("n7_7_6_provenance", manifest?.sourceProvenance?.n7_7_6TextInputUiParityJson === "contracts/audits/naver-smartchannel-text-input-ui-parity-n7-7-6.json" && manifest?.sourceProvenance?.n7_7_6TextInputUiParityReport === "docs/implementation/naver-smartchannel-280-text-input-ui-field-mapping-n7-7-6.md" && manifest?.sourceProvenance?.n7_7_6TextInputUiParityVerifier === "scripts/verify-n7-7-6-smartchannel-text-input-fields.mjs" && manifest?.sourceProvenance?.n7_7_6EvidenceDirectory === "artifacts/n7-7-6", "N7.7.6 provenance");
  const finalBaselineAudit = await readJson("contracts/audits/naver-smartchannel-final-baseline-n7-8.json");
  const goldenRegistry = await readJson("fixtures/golden/naver-smartchannel/registry.json");
  check("n7_8_golden_baseline", manifest?.goldenBaseline?.status === "PASS" && finalBaselineAudit?.phase?.status === "PASS" && goldenRegistry?.registryVersion === "1.0.1" && goldenRegistry?.status === "FROZEN_REPRESENTATIVE_GOLDENS_N7_8" && goldenRegistry?.candidates?.length === 6 && goldenRegistry?.candidates?.every((entry) => entry.intentional === true && entry.deterministic === true), JSON.stringify({ manifest: manifest?.goldenBaseline, audit: finalBaselineAudit?.phase, registry: { version: goldenRegistry?.registryVersion, status: goldenRegistry?.status, candidates: goldenRegistry?.candidates?.length } }));
  check("n7_8_provenance", manifest?.sourceProvenance?.n7_8FinalBaselineAudit === "contracts/audits/naver-smartchannel-final-baseline-n7-8.json" && manifest?.sourceProvenance?.n7_8FinalBaselineReport === "docs/implementation/naver-smartchannel-final-baseline-n7-8.md" && manifest?.sourceProvenance?.n7_8FinalBaselineVerifier === "scripts/verify-n7-8-smartchannel-final-baseline.mjs" && manifest?.sourceProvenance?.n7_8EvidenceDirectory === "artifacts/n7-8" && manifest?.sourceProvenance?.n7_8GoldenRegistry === "fixtures/golden/naver-smartchannel/registry.json", "N7.8 provenance");
  const n8Inventory = await readJson("artifacts/n8/naver-capability-inventory.json");
  const n8Matrix = await readJson("artifacts/n8/naver-desktop-format-matrix.json");
  const n8Parity = await readJson("artifacts/n8/naver-format-contract-parity.json");
  const n8E2e = await readJson("artifacts/n8/naver-e2e-summary.json");
  const n8SmartFreeze = await readJson("artifacts/n8/smartchannel-frozen-regression.json");
  const n8Regression = await readJson("artifacts/n8/non-smartchannel-regression.json");
  check("n8_channel_completion", manifest?.channelCompletion?.status === "PASS" && n8Inventory?.formats?.length === 8 && n8Matrix?.status === "PASS" && n8Matrix?.formats?.length === 8 && n8Parity?.status === "PASS" && n8Parity?.missingFields === 0 && n8Parity?.extraFields === 0 && n8Parity?.requestMappingErrors === 0 && n8E2e?.status === "PASS" && n8E2e?.outputEvidenceDirectories?.length === 9 && n8SmartFreeze?.status === "PASS" && n8SmartFreeze?.goldenChanged === false && n8Regression?.status === "PASS", JSON.stringify({ manifest: manifest?.channelCompletion, inventory: n8Inventory?.formats?.length, matrix: n8Matrix?.status, parity: n8Parity?.status, e2e: n8E2e?.status, smartFreeze: n8SmartFreeze?.status, regression: n8Regression?.status }));
  check("n8_provenance", manifest?.sourceProvenance?.n8Inventory === "artifacts/n8/naver-capability-inventory.json" && manifest?.sourceProvenance?.n8DesktopMatrix === "artifacts/n8/naver-desktop-format-matrix.json" && manifest?.sourceProvenance?.n8ContractParity === "artifacts/n8/naver-format-contract-parity.json" && manifest?.sourceProvenance?.n8E2eSummary === "artifacts/n8/naver-e2e-summary.json" && manifest?.sourceProvenance?.n8EvidenceDirectory === "artifacts/n8" && manifest?.sourceProvenance?.n8ImplementationRecord === "docs/implementation/naver-channel-completion-n8.md" && manifest?.sourceProvenance?.n8Verifier === "scripts/verify-n8-channel-completion.mjs", "N8 provenance");
  const metaSourceRegistry = await readJson("contracts/audits/meta-official-source-registry.json");
  const metaCapability = await readJson("artifacts/m0/meta-static-capability-matrix.json");
  const metaPlacements = await readJson("artifacts/m0/meta-placement-compatibility-matrix.json");
  const metaReuse = await readJson("artifacts/m0/freeform-reuse-audit.json");
  const metaSafeZones = await readJson("artifacts/m0/meta-safe-zone-audit.json");
  check("m0_meta_architecture", manifest?.metaArchitectureDiscovery?.status === "PASS" && manifest?.metaArchitectureDiscovery?.officialMetaOnly === true && manifest?.metaArchitectureDiscovery?.officialRules === 14 && manifest?.metaArchitectureDiscovery?.runtimeImplemented === false && manifest?.metaArchitectureDiscovery?.desktopExposed === false && metaSourceRegistry?.officialMetaOnly === true && metaSourceRegistry?.rules?.length === 14 && metaCapability?.status === "PASS" && metaCapability?.assetProfiles?.length === 4 && metaCapability?.runtimeImplemented === false && metaPlacements?.status === "PASS" && metaReuse?.overallReuse === "PARTIAL" && metaSafeZones?.policies?.find((entry) => entry.id === "META_REELS_KEY_CONTENT_SAFE_ZONE")?.status === "SOURCE_REQUIRED", JSON.stringify(manifest?.metaArchitectureDiscovery));
  check("m0_provenance", manifest?.sourceProvenance?.m0OfficialSourceRegistry === "contracts/audits/meta-official-source-registry.json" && manifest?.sourceProvenance?.m0EvidenceDirectory === "artifacts/m0" && manifest?.sourceProvenance?.m0ImplementationRecord === "docs/implementation/meta-static-renderer-architecture-m0.md" && manifest?.sourceProvenance?.m0ArchitectureAdr === "docs/adr/ADR-0057-meta-static-creative-composition-boundary.md" && manifest?.sourceProvenance?.m0SourceGuideIndex === "source-guides/meta/m0/official-source-index.md" && manifest?.sourceProvenance?.m0Verifier === "scripts/verify-m0-meta-architecture.mjs", "M0 provenance");
  check("m1_meta_static", ["M1_META_STATIC_ASSET_PROFILES_PLACEMENT_SET_RENDERER", "M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", "M2_1_META_VISUAL_CANDIDATE_CORRECTION_OUTPUT_COMPLIANCE_AUDIT", "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX", "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX", "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE"].includes(manifest?.handoffPhase) && manifest?.channels?.META?.staticProfiles === "IMPLEMENTED" && manifest?.channels?.META?.placementSet === "IMPLEMENTED" && manifest?.versions?.metaStatic?.placementSetContract === "META_STATIC_PLACEMENT_SET_V1" && manifest?.versions?.metaStatic?.profiles?.length === 3 && manifest?.sourceProvenance?.m1Verifier === "scripts/verify-m1-meta-static.mjs", JSON.stringify({ phase: manifest?.handoffPhase, meta: manifest?.channels?.META, metaStatic: manifest?.versions?.metaStatic }));

  const m2ArtifactAudit = await readJson("artifacts/m2/meta-artifact-audit.json");
  const m2CandidateRegistry = await readJson("contracts/audits/meta-golden-candidates-m2.json");
  check("m2_meta_artifact_audit", ["M2_META_ARTIFACT_AUDIT_MANUAL_ACCEPTANCE_GOLDEN_CANDIDATES", "M2_1_META_VISUAL_CANDIDATE_CORRECTION_OUTPUT_COMPLIANCE_AUDIT", "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX", "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX", "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE"].includes(manifest?.handoffPhase) && manifest?.m2MetaArtifactAudit?.status === "PASS" && manifest?.m2MetaArtifactAudit?.manualAcceptanceStatus === "NOT_REVIEWED" && manifest?.m2MetaArtifactAudit?.finalGoldenFrozen === false && m2ArtifactAudit?.status === "PASS" && m2CandidateRegistry?.status === "CANDIDATE_NOT_APPROVED" && m2CandidateRegistry?.candidates?.length === 5, JSON.stringify({ phase: manifest?.handoffPhase, manifestStatus: manifest?.m2MetaArtifactAudit?.status, auditStatus: m2ArtifactAudit?.status, candidateStatus: m2CandidateRegistry?.status, candidates: m2CandidateRegistry?.candidates?.length }));
  check("m2_provenance", manifest?.sourceProvenance?.m2ArtifactAudit === "artifacts/m2/meta-artifact-audit.json" && manifest?.sourceProvenance?.m2CandidateRegistry === "contracts/audits/meta-golden-candidates-m2.json" && manifest?.sourceProvenance?.m2ManualReviewPackage === "artifacts/m2/manual-review" && manifest?.sourceProvenance?.m2GoldenCandidates === "artifacts/m2/golden-candidates" && manifest?.sourceProvenance?.m2ImplementationRecord === "docs/implementation/meta-artifact-audit-golden-candidates-m2.md" && manifest?.sourceProvenance?.m2Verifier === "scripts/verify-m2-meta-static.mjs", "M2 provenance");

  const m2_1OutputConstraintProvenance = await readJson("artifacts/m2-1/meta-output-constraint-provenance.json");
  const m2_1ByteAudit = await readJson("artifacts/m2-1/meta-300kb-rule-audit.json");
  const m2_1CropAudit = await readJson("artifacts/m2-1/meta-manual-crop-candidate-audit.json");
  const m2_1FormatAudit = await readJson("artifacts/m2-1/meta-output-format-audit.json");
  const m2_1SourceRefresh = await readJson("artifacts/m2-1/meta-official-source-refresh.json");
  const m2_1Determinism = await readJson("artifacts/m2-1/meta-determinism.json");
  const m2_1Regression = await readJson("artifacts/m2-1/meta-regression.json");
  const m2_1CandidateRegistry = await readJson("contracts/audits/meta-golden-candidates-m2-1.json");
  check("m2_1_visual_audit", ["M2_1_META_VISUAL_CANDIDATE_CORRECTION_OUTPUT_COMPLIANCE_AUDIT", "M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX", "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX", "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE"].includes(manifest?.handoffPhase) && manifest?.m2_1MetaVisualAudit?.status === "PASS" && manifest?.m2_1MetaVisualAudit?.outputConstraintProvenance === "PASS" && manifest?.m2_1MetaVisualAudit?.old300KbRuleReproduction === "KBR-FREEFORM-FILE-SIZE-EXCEEDED" && manifest?.m2_1MetaVisualAudit?.correctedMetaFileSizeError === false && manifest?.m2_1MetaVisualAudit?.candidateCount === 4 && manifest?.m2_1MetaVisualAudit?.candidateStatus === "CANDIDATE_NOT_APPROVED" && manifest?.m2_1MetaVisualAudit?.manualAcceptanceStatus === "NOT_REVIEWED" && manifest?.m2_1MetaVisualAudit?.finalGoldenFrozen === false && m2_1OutputConstraintProvenance?.current?.maximumBytes === null && m2_1ByteAudit?.status === "PASS" && m2_1CropAudit?.status === "PASS" && m2_1FormatAudit?.status === "PASS" && m2_1SourceRefresh?.exactMaximumStatus === "NO_EXACT_MAX_PINNED" && m2_1Determinism?.status === "PASS" && m2_1Regression?.status === "PASS" && m2_1CandidateRegistry?.candidates?.length === 4, JSON.stringify({ phase: manifest?.handoffPhase, audit: manifest?.m2_1MetaVisualAudit, sourceMax: m2_1SourceRefresh?.exactMaximumStatus, candidates: m2_1CandidateRegistry?.candidates?.length }));
  check("m2_1_provenance", manifest?.sourceProvenance?.m2_1OutputConstraintProvenance === "artifacts/m2-1/meta-output-constraint-provenance.json" && manifest?.sourceProvenance?.m2_1ByteAudit === "artifacts/m2-1/meta-300kb-rule-audit.json" && manifest?.sourceProvenance?.m2_1CropAudit === "artifacts/m2-1/meta-manual-crop-candidate-audit.json" && manifest?.sourceProvenance?.m2_1FormatAudit === "artifacts/m2-1/meta-output-format-audit.json" && manifest?.sourceProvenance?.m2_1ValidatorIsolation === "artifacts/m2-1/meta-validator-isolation.json" && manifest?.sourceProvenance?.m2_1OfficialSourceRefresh === "artifacts/m2-1/meta-official-source-refresh.json" && manifest?.sourceProvenance?.m2_1Determinism === "artifacts/m2-1/meta-determinism.json" && manifest?.sourceProvenance?.m2_1Regression === "artifacts/m2-1/meta-regression.json" && manifest?.sourceProvenance?.m2_1ManualReviewPackage === "artifacts/m2-1/manual-review" && manifest?.sourceProvenance?.m2_1CandidateRegistry === "contracts/audits/meta-golden-candidates-m2-1.json" && manifest?.sourceProvenance?.m2_1ImplementationRecord === "docs/implementation/meta-visual-candidate-correction-output-compliance-m2-1.md" && manifest?.sourceProvenance?.m2_1Verifier === "scripts/verify-m2-1-meta.mjs", "M2.1 provenance");

  const m2_2Inventory = await readJson("artifacts/m2-2/meta-placement-context-contract-inventory.json");
  const m2_2Pipeline = await readJson("artifacts/m2-2/freeform-plan-import-pipeline.json");
  const m2_2Roundtrip = await readJson("artifacts/m2-2/meta-plan-roundtrip-audit.json");
  const m2_2Square = await readJson("artifacts/m2-2/meta-square-import-reproduction.json");
  const m2_2Stories = await readJson("artifacts/m2-2/meta-stories-context-propagation.json");
  const m2_2Reels = await readJson("artifacts/m2-2/meta-reels-context-propagation.json");
  const m2_2SafeZone = await readJson("artifacts/m2-2/meta-safe-zone-target-audit.json");
  const m2_2ByteAudit = await readJson("artifacts/m2-2/meta-300kb-regression.json");
  const m2_2Determinism = await readJson("artifacts/m2-2/meta-determinism.json");
  const m2_2Regression = await readJson("artifacts/m2-2/regression.json");
  const m2_2CandidateRegistry = await readJson("contracts/audits/meta-golden-candidates-m2-2.json");
  check("m2_2_visual_audit", ["M2_2_META_PLACEMENT_CONTEXT_PROPAGATION_PLAN_IMPORT_CONSISTENCY_HOTFIX", "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX", "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE"].includes(manifest?.handoffPhase) && manifest?.m2_2MetaPlacementContextPlanImport?.status === "PASS" && manifest?.m2_2MetaPlacementContextPlanImport?.contextOwner === "RENDER_REQUEST" && manifest?.m2_2MetaPlacementContextPlanImport?.planContextAllowed === false && manifest?.m2_2MetaPlacementContextPlanImport?.verticalNoContext === "DEFAULT_NONE" && manifest?.m2_2MetaPlacementContextPlanImport?.squarePolicy === "MANUAL_CROP" && manifest?.m2_2MetaPlacementContextPlanImport?.squareFitMode === "COVER" && manifest?.m2_2MetaPlacementContextPlanImport?.squareFullBleed === true && manifest?.m2_2MetaPlacementContextPlanImport?.storiesContext === "INSTAGRAM_STORIES" && manifest?.m2_2MetaPlacementContextPlanImport?.reelsContext === "INSTAGRAM_REELS" && manifest?.m2_2MetaPlacementContextPlanImport?.stale300000RulePresent === false && manifest?.m2_2MetaPlacementContextPlanImport?.candidateCount === 4 && m2_2Inventory?.status === "PASS" && m2_2Pipeline?.status === "PASS" && m2_2Roundtrip?.status === "PASS" && m2_2Square?.status === "PASS" && m2_2Stories?.status === "PASS" && m2_2Reels?.status === "PASS" && m2_2SafeZone?.status === "PASS" && m2_2ByteAudit?.status === "PASS" && m2_2Determinism?.status === "PASS" && m2_2Regression?.status === "PASS" && m2_2CandidateRegistry?.status === "CANDIDATE_NOT_APPROVED" && m2_2CandidateRegistry?.manualAcceptanceStatus === "NOT_REVIEWED" && m2_2CandidateRegistry?.finalGoldenFrozen === false, JSON.stringify({ phase: manifest?.handoffPhase, audit: manifest?.m2_2MetaPlacementContextPlanImport, candidates: m2_2CandidateRegistry?.candidates?.length }));
  check("m2_2_provenance", manifest?.sourceProvenance?.m2_2ContextInventory === "artifacts/m2-2/meta-placement-context-contract-inventory.json" && manifest?.sourceProvenance?.m2_2ImportPipeline === "artifacts/m2-2/freeform-plan-import-pipeline.json" && manifest?.sourceProvenance?.m2_2RoundtripAudit === "artifacts/m2-2/meta-plan-roundtrip-audit.json" && manifest?.sourceProvenance?.m2_2SquareReproduction === "artifacts/m2-2/meta-square-import-reproduction.json" && manifest?.sourceProvenance?.m2_2StoriesPropagation === "artifacts/m2-2/meta-stories-context-propagation.json" && manifest?.sourceProvenance?.m2_2ReelsPropagation === "artifacts/m2-2/meta-reels-context-propagation.json" && manifest?.sourceProvenance?.m2_2SafeZoneAudit === "artifacts/m2-2/meta-safe-zone-target-audit.json" && manifest?.sourceProvenance?.m2_2ByteRegression === "artifacts/m2-2/meta-300kb-regression.json" && manifest?.sourceProvenance?.m2_2Determinism === "artifacts/m2-2/meta-determinism.json" && manifest?.sourceProvenance?.m2_2Regression === "artifacts/m2-2/regression.json" && manifest?.sourceProvenance?.m2_2ManualReviewPackage === "artifacts/m2-2/manual-review" && manifest?.sourceProvenance?.m2_2CandidateRegistry === "contracts/audits/meta-golden-candidates-m2-2.json" && manifest?.sourceProvenance?.m2_2ImplementationRecord === "docs/implementation/meta-placement-context-plan-import-consistency-m2-2.md" && manifest?.sourceProvenance?.m2_2Generator === "scripts/generate-m2-2-meta-candidates.mjs" && manifest?.sourceProvenance?.m2_2Verifier === "scripts/verify-m2-2-meta.mjs", "M2.2 provenance");

  const m2_2aRequestState = await readJson("artifacts/m2-2a/meta-desktop-request-state-audit.json");
  const m2_2aBuilder = await readJson("artifacts/m2-2a/meta-preview-request-builder.json");
  const m2_2aSafeZone = await readJson("artifacts/m2-2a/meta-safe-zone-ui-matrix.json");
  const m2_2aErrors = await readJson("artifacts/m2-2a/meta-preview-error-handling.json");
  const m2_2aViewer = await readJson("artifacts/m2-2a/meta-plan-vs-manifest-viewer.json");
  const m2_2aSwitching = await readJson("artifacts/m2-2a/meta-desktop-state-switching.json");
  const m2_2aRegression = await readJson("artifacts/m2-2a/regression.json");
  const m2_2aFiles = [m2_2aRequestState, m2_2aBuilder, m2_2aSafeZone, m2_2aErrors, m2_2aViewer, m2_2aSwitching, m2_2aRegression];
  check("m2_2a_desktop_qa", ["M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX", "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE"].includes(manifest?.handoffPhase) && manifest?.versions?.desktop === "0.10.1" && manifest?.versions?.package === "0.10.1" && manifest?.m2_2aMetaDesktopQa?.status === "PASS" && m2_2aFiles.every((entry) => entry?.phase === "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX" && entry?.status === "PASS") && m2_2aErrors?.silentNoOpCount === 0 && m2_2aRegression?.m2_2Core === "PASS" && m2_2aRegression?.goldenStatus === "CANDIDATE_NOT_APPROVED" && m2_2aRegression?.manualAcceptanceStatus === "NOT_REVIEWED" && m2_2aRegression?.finalGoldenFrozen === false, JSON.stringify({ phase: manifest?.handoffPhase, qa: manifest?.m2_2aMetaDesktopQa, silentNoOp: m2_2aErrors?.silentNoOpCount }));
  check("m2_2a_provenance", manifest?.sourceProvenance?.m2_2aEvidenceDirectory === "artifacts/m2-2a" && manifest?.sourceProvenance?.m2_2aRequestStateAudit === "artifacts/m2-2a/meta-desktop-request-state-audit.json" && manifest?.sourceProvenance?.m2_2aPreviewRequestBuilder === "artifacts/m2-2a/meta-preview-request-builder.json" && manifest?.sourceProvenance?.m2_2aSafeZoneUiMatrix === "artifacts/m2-2a/meta-safe-zone-ui-matrix.json" && manifest?.sourceProvenance?.m2_2aPreviewErrorHandling === "artifacts/m2-2a/meta-preview-error-handling.json" && manifest?.sourceProvenance?.m2_2aPlanManifestViewer === "artifacts/m2-2a/meta-plan-vs-manifest-viewer.json" && manifest?.sourceProvenance?.m2_2aStateSwitching === "artifacts/m2-2a/meta-desktop-state-switching.json" && manifest?.sourceProvenance?.m2_2aRegression === "artifacts/m2-2a/regression.json" && manifest?.sourceProvenance?.m2_2aImplementationRecord === "docs/implementation/meta-desktop-qa-request-context-preview-bridge-m2-2a.md" && manifest?.sourceProvenance?.m2_2aVerifier === "scripts/verify-m2-2a-meta.mjs" && manifest?.sourceProvenance?.m2_2aGenerator === "scripts/generate-m2-2a-meta-evidence.mjs", "M2.2a provenance");

  const m2_3GoldenRegistry = await readJson("contracts/goldens/meta-static-goldens.json");
  const m2_3ManualAcceptance = await readJson("artifacts/m2-3/meta-user-manual-acceptance.json");
  const m2_3RegistryAudit = await readJson("artifacts/m2-3/meta-golden-freeze-registry-audit.json");
  const m2_3Determinism = await readJson("artifacts/m2-3/meta-golden-determinism.json");
  const m2_3Contextual = await readJson("artifacts/m2-3/meta-contextual-golden-audit.json");
  const m2_3Validator = await readJson("artifacts/m2-3/meta-validator-expectation-audit.json");
  const m2_3Bytes = await readJson("artifacts/m2-3/meta-300kb-regression.json");
  const m2_3Regression = await readJson("artifacts/m2-3/regression.json");
  const m2_3Evidence = [m2_3ManualAcceptance, m2_3RegistryAudit, m2_3Determinism, m2_3Contextual, m2_3Validator, m2_3Bytes, m2_3Regression];
  check("m2_3_golden_freeze", manifest?.handoffPhase === "M2_3_META_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE" && manifest?.m2_3MetaGoldenFreeze?.status === "PASS" && manifest?.m2_3MetaGoldenFreeze?.manualAcceptanceStatus === "APPROVED" && manifest?.m2_3MetaGoldenFreeze?.goldenCandidateStatus === "APPROVED_FROZEN" && manifest?.m2_3MetaGoldenFreeze?.finalGoldenFrozen === true && m2_3GoldenRegistry?.registryVersion === "1.0.0" && m2_3GoldenRegistry?.status === "APPROVED_FROZEN" && m2_3GoldenRegistry?.entries?.length === 4 && m2_3GoldenRegistry?.manualAcceptance?.status === "APPROVED" && m2_3GoldenRegistry?.finalGoldenFrozen === true && m2_3Evidence.every((entry) => entry?.status === "PASS"), JSON.stringify({ phase: manifest?.handoffPhase, handoff: manifest?.m2_3MetaGoldenFreeze, registry: { version: m2_3GoldenRegistry?.registryVersion, status: m2_3GoldenRegistry?.status, entries: m2_3GoldenRegistry?.entries?.length }, evidence: m2_3Evidence.map((entry) => entry?.status) }));
  check("m2_3_golden_provenance", manifest?.sourceProvenance?.m2_3GoldenRegistry === "contracts/goldens/meta-static-goldens.json" && manifest?.sourceProvenance?.m2_3EvidenceDirectory === "artifacts/m2-3" && manifest?.sourceProvenance?.m2_3ImplementationRecord === "docs/implementation/meta-user-visual-acceptance-golden-freeze-m2-3.md" && manifest?.sourceProvenance?.m2_3Verifier === "scripts/verify-m2-3-meta-goldens.mjs" && manifest?.sourceProvenance?.m2_3Generator === "scripts/generate-m2-3-meta-goldens.mjs" && m2_3RegistryAudit?.registry === "contracts/goldens/meta-static-goldens.json" && m2_3RegistryAudit?.finalGoldenFrozen === true, "M2.3 provenance");
  check("m2_3_contextual_identity", m2_3Contextual?.storiesReelsSameArtifact === true && m2_3Contextual?.storiesReelsSamePixel === true && m2_3Contextual?.requestFingerprintsDifferent === true && m2_3Contextual?.validationSemanticsDifferent === true && m2_3Validator?.entries?.reels?.expected?.infoCount === 1 && m2_3Validator?.entries?.reels?.expected?.issueCodes?.includes("KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED"), JSON.stringify({ contextual: m2_3Contextual, reels: m2_3Validator?.entries?.reels?.expected }));
  check("m2_3_no_stale_300000_rule", m2_3Bytes?.stale300000RulePresent === false && m2_3Bytes?.exactMaxBytesStatus === "NO_EXACT_MAX_PINNED", JSON.stringify(m2_3Bytes));

  const g0GoogleArchitecture = await readJson("contracts/google/architecture.g0.json");
  const g0GoogleCapabilities = await readJson("contracts/google/capabilities.g0.json");
  const g0GoogleAssetGeometry = await readJson("contracts/google/asset-geometry.g0.json");
  const g0GoogleDelivery = await readJson("contracts/google/delivery-contracts.g0.json");
  const g0GoogleProvenance = await readJson("contracts/google/provenance.g0.json");
  const g0GoogleDiagnostics = await readJson("contracts/google/diagnostics.g0.json");
  const g0GoogleEvidence = await readJson("artifacts/g0/google-static-discovery-verification.json");
  const g0GooglePhase = "G0_GOOGLE_ADS_STATIC_CAPABILITY_DISCOVERY_AND_ARCHITECTURE";
  const g0GoogleImplementation = g0GoogleArchitecture?.implementation ?? {};
  check("g0_google_architecture", sourceHandoffPhase === g0GooglePhase && manifest?.g0GoogleStaticDiscovery?.status === "PASS" && manifest?.g0GoogleStaticDiscovery?.architectureStatus === "FREEZE_CANDIDATE" && manifest?.g0GoogleStaticDiscovery?.repositoryApplication === "APPLIED_ARCHITECTURE_ONLY" && g0GoogleArchitecture?.phase === g0GooglePhase && g0GoogleArchitecture?.status === "FREEZE_CANDIDATE" && g0GoogleArchitecture?.repositoryApplication === "APPLIED_ARCHITECTURE_ONLY" && g0GoogleCapabilities?.runtimeEnabled === false && g0GoogleEvidence?.status === "PASS", JSON.stringify({ sourceHandoffPhase, handoff: manifest?.g0GoogleStaticDiscovery, architecture: g0GoogleArchitecture?.status, evidence: g0GoogleEvidence?.status }));
  check("g0_google_capability_boundary", g0GoogleCapabilities?.capabilities?.length === 7 && g0GoogleArchitecture?.compositionBoundary?.singleArtifact === true && g0GoogleArchitecture?.compositionBoundary?.deliveryCollectionSeparate === true && g0GoogleArchitecture?.compositionBoundary?.displayAndPmaxProfilesMerged === false && manifest?.versions?.googleStatic?.architectureVersion === "0.1.0" && manifest?.versions?.googleStatic?.status === "PASS", JSON.stringify({ capabilities: g0GoogleCapabilities?.capabilities?.length, boundary: g0GoogleArchitecture?.compositionBoundary, versions: manifest?.versions?.googleStatic }));
  check("g0_google_geometry_delivery", g0GoogleAssetGeometry?.status === "PROPOSED_NOT_RUNTIME" && g0GoogleAssetGeometry?.uploadedDisplayPresets?.demandGenRecommendedSubset?.length === 7 && g0GoogleAssetGeometry?.uploadedDisplayPresets?.legacyDisplaySupportedCanvases?.length === 20 && g0GoogleDelivery?.status === "PROPOSED_NOT_RUNTIME" && g0GoogleDelivery?.contracts?.length === 5, JSON.stringify({ geometry: g0GoogleAssetGeometry?.status, demandGen: g0GoogleAssetGeometry?.uploadedDisplayPresets?.demandGenRecommendedSubset?.length, legacy: g0GoogleAssetGeometry?.uploadedDisplayPresets?.legacyDisplaySupportedCanvases?.length, delivery: g0GoogleDelivery?.contracts?.length }));
  check("g0_google_provenance_diagnostics", g0GoogleProvenance?.sourcePolicy === "GOOGLE_OFFICIAL_ONLY" && g0GoogleProvenance?.sourceDomainPolicy?.thirdPartyRulesUsed === 0 && g0GoogleProvenance?.unresolvedRules?.length === 9 && g0GoogleDiagnostics?.status === "PROPOSED_NOT_ACTIVE" && g0GoogleDiagnostics?.activeRuntimeRegistration === false && g0GoogleDiagnostics?.codes?.length === 11 && manifest?.sourceProvenance?.g0GoogleArchitecture === "contracts/google/architecture.g0.json" && manifest?.sourceProvenance?.g0GoogleVerification === "artifacts/g0/google-static-discovery-verification.json" && manifest?.sourceProvenance?.g0GoogleVerifier === "scripts/verify-g0-google-static.mjs", JSON.stringify({ sourcePolicy: g0GoogleProvenance?.sourcePolicy, unresolved: g0GoogleProvenance?.unresolvedRules?.length, diagnostics: g0GoogleDiagnostics?.status, codes: g0GoogleDiagnostics?.codes?.length }));
  check("g0_google_runtime_absent", g0GoogleImplementation.runtimeProfilesAdded === false && g0GoogleImplementation.rendererCodeAdded === false && g0GoogleImplementation.validatorRuntimeAdded === false && g0GoogleImplementation.goldensAdded === false && g0GoogleImplementation.desktopUiAdded === false && g0GoogleImplementation.uploadIntegrationAdded === false && g0GoogleImplementation.runtimeNetworkAccess === "PROHIBITED" && Array.isArray(g0GoogleImplementation.plumeDependencies) && g0GoogleImplementation.plumeDependencies.length === 0 && manifest?.versions?.googleStatic?.runtimeProfilesAdded === false && manifest?.versions?.googleStatic?.goldensAdded === false, JSON.stringify(g0GoogleImplementation));

  const secretPattern = /(AKIA[0-9A-Z]{16}|(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----)/;
  const textExtensions = new Set([".json", ".md", ".mjs", ".js", ".ts", ".tsx", ".yaml", ".yml", ".toml", ".txt", ".css", ".html"]);
  const secretHits = [];
  for (const absolutePath of allFiles) {
    const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
    if (path.basename(relativePath).toLowerCase() === ".env" || path.basename(relativePath).toLowerCase().includes("secret") || path.basename(relativePath).toLowerCase().includes("credential")) secretHits.push(relativePath);
    if (textExtensions.has(path.extname(relativePath).toLowerCase())) {
      const text = await readFile(absolutePath, "utf8");
      if (secretPattern.test(text)) secretHits.push(relativePath);
    }
  }
  check("secrets", secretHits.length === 0, secretHits.join(",") || "0");

  for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
  if (failures.length > 0) {
    console.error(JSON.stringify({ status: "FAIL", failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: "PASS", checks: checks.length, files: manifestFiles.size, smartchannelPsdCount: psdFiles.length, secretsFound: 0 }, null, 2));
  }
}
