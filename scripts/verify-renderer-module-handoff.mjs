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
  const required = ["README.md", "MANIFEST.json", "artifacts/n7-7-4", "artifacts/n7-7-5", "contracts", "src", "packages", "scripts", "tests", "fixtures", "reference", "docs", "source-guides", "local-runtime-resources", "package.json", "pnpm-lock.yaml"];
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
  check("n7_runtime_manifest", manifest?.handoffPhase === "N7_7_5_SMARTCHANNEL_TYPOGRAPHY_PARITY_CORRECTION" && manifest?.versions?.rendererCore === "0.8.6" && manifest?.versions?.desktop === "0.9.9", JSON.stringify({ phase: manifest?.handoffPhase, rendererCore: manifest?.versions?.rendererCore, desktop: manifest?.versions?.desktop }));
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
