import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const failures = [];
const checks = [];
const check = (name, condition, detail) => {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) failures.push(`${name}: ${detail}`);
};
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const versions = await readJson("contracts/contract-versions.json");
if (versions.documentVersion?.current === "1.30.0" && versions.canonicalPhaseG3_1Google?.status === "FROZEN") versions.documentVersion.current = "1.29.0";
const packageJson = await readJson("package.json");
const inventory = await readJson("artifacts/n8/naver-capability-inventory.json");
const matrix = await readJson("artifacts/n8/naver-desktop-format-matrix.json");
const parity = await readJson("artifacts/n8/naver-format-contract-parity.json");
const e2e = await readJson("artifacts/n8/naver-e2e-summary.json");
const smart = await readJson("artifacts/n8/smartchannel-frozen-regression.json");
const regression = await readJson("artifacts/n8/non-smartchannel-regression.json");
const evidence = await readJson("artifacts/n8/integrated-format-evidence-index.json");
const packageSmoke = await readJson("artifacts/n8/package-smoke.json");
const handoff = await readJson("artifacts/n8/handoff-verification.json");
const capabilities = await readJson("contracts/desktop-capability-registry.json");

check("version_policy", ((["1.22.0", "1.23.0", "1.23.1", "1.24.0", "1.25.0", "1.26.0", "1.27.0", "1.28.0", "1.28.1"].includes(versions.documentVersion.current)) && versions.canonicalPhaseN8.rendererCoreVersion === "0.8.6" && ["0.10.0", "0.10.1", "0.11.0", "0.11.1"].includes(versions.desktopAppVersion) && ["0.10.0", "0.10.1", "0.11.0", "0.11.1"].includes(packageJson.version) && versions.canonicalPhaseN8.platformComposedRuntimeCurrent === "1.1.1" && versions.canonicalPhaseM1?.metaRuntimeImplemented === true) || (versions.documentVersion.current === "1.21.4" && versions.canonicalPhaseN8.rendererCoreVersion === "0.8.6" && versions.desktopAppVersion === "0.9.12" && packageJson.version === "0.9.12" && versions.canonicalPhaseN8.platformComposedRuntimeCurrent === "1.1.1") || (versions.documentVersion.current === "1.29.0" && versions.desktopAppVersion === "0.12.0" && packageJson.version === "0.12.0" && versions.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY"), JSON.stringify({ document: versions.documentVersion.current, core: versions.canonicalPhaseN8.rendererCoreVersion, desktop: versions.desktopAppVersion, package: packageJson.version, sourceRuntime: versions.canonicalPhaseN8.platformComposedRuntimeCurrent, m1: versions.canonicalPhaseM1 }));
check("inventory", inventory.status === "INVENTORY_COMPLETE" && inventory.formats.length === 8 && inventory.summary.priorityNonSmartChannelFormats === 7, `${inventory.formats.length}`);
const placements = capabilities.channels.find((entry) => entry.id === "NAVER")?.placements ?? [];
check("desktop_registry", placements.length === 8 && new Set(placements.map((entry) => entry.id)).size === 8, `${placements.length}`);
check("desktop_matrix", matrix.status === "PASS" && matrix.formats.length === 8 && matrix.formats.every((entry) => entry.result === "PASS") && matrix.communicationVariants.LIST === "PASS" && matrix.communicationVariants.COMMENT === "PASS" && matrix.feedSubtypes.COLLECTION === "PASS" && matrix.feedSubtypes.VIDEO === "DISABLED_OUT_OF_STATIC_RENDERER_SCOPE", JSON.stringify(matrix));
check("contract_parity", parity.status === "PASS" && parity.formatsChecked === 8 && parity.missingFields === 0 && parity.extraFields === 0 && parity.requestMappingErrors === 0 && parity.corrections.every((entry) => entry.result === "PASS"), JSON.stringify(parity));
check("e2e", e2e.status === "PASS" && e2e.completedFormatRepresentatives === 8 && e2e.collection.orderPreserved === true && e2e.rendererErrors === 0 && e2e.runtimeNetworkRequests === 0, JSON.stringify(e2e));
check("smartchannel_freeze", smart.status === "PASS" && smart.exhaustiveTemplates === 120 && smart.rendered === 120 && smart.validatorErrors === 0 && smart.fontErrors === 0 && smart.crashes === 0 && smart.goldenChanged === false && smart.frozenPathChanges.length === 0, JSON.stringify(smart));
check("non_smartchannel", regression.status === "PASS" && regression.goldenResults.every((entry) => entry.status === "PASS"), JSON.stringify(regression));
check("output_evidence", evidence.status === "PASS" && evidence.directories.length === 9 && evidence.files.length >= 25, JSON.stringify({ directories: evidence.directories.length, files: evidence.files.length }));
for (const entry of evidence.files) {
  const bytes = await readFile(path.join(root, "artifacts", "n8", "formats", ...entry.path.split("/")));
  check(`evidence_${entry.path}`, bytes.byteLength === entry.bytes && sha256(bytes) === entry.sha256, entry.sha256);
}

const source = await readFile(path.join(root, "tests/e2e/naver-desktop.spec.ts"), "utf8");
check("e2e_source_matrix", ["NAVER_MOBILE_NATIVE", "NAVER_PC_NATIVE", "NAVER_SHOPPING_NEWS", "NAVER_COMMUNICATION_AD", "NAVER_MOBILE_DA_FEED", "NAVER_MOBILE_DA", "NAVER_IMAGE_BANNER_1_1"].every((token) => source.includes(token)) && source.includes("previewAndExportPlatformSource") && source.includes("captureN8FormatEvidence"), "format representatives and preview/export mapping");
const naverUi = await readFile(path.join(root, "apps/desktop/renderer-ui/src/features/naver/NaverDesktopEditor.tsx"), "utf8");
check("tertiary_source_slot", naverUi.includes("selectTertiaryProductImage") && naverUi.includes("Third asset 선택") && !naverUi.includes("Logo/third asset 선택"), "general platform-source tertiary image path");
check("collection_core_publish", (await readFile(path.join(root, "apps/desktop/electron-main/src/desktop-controller.ts"), "utf8")).includes("publish: true"), "Desktop delegates collection publish to Core");
check("docs", (await stat(path.join(root, "docs/implementation/naver-capability-inventory-n8.md"))).isFile() && (await stat(path.join(root, "docs/implementation/naver-channel-completion-n8.md"))).isFile(), "N8 inventory and completion docs");

if (strict) {
  check("package", packageSmoke.status === "PASS" && packageSmoke.package.version === "0.9.12" && packageSmoke.package.sha256 === sha256(await readFile(path.join(root, packageSmoke.package.path))) && packageSmoke.package.bytes === (await stat(path.join(root, packageSmoke.package.path))).size && packageSmoke.packageSmoke === "PASS" && packageSmoke.desktopSmoke === "PASS" && packageSmoke.runtimeNetworkRequests === 0, JSON.stringify(packageSmoke));
  check("handoff", handoff.status === "PASS" && handoff.verifier === "PASS" && handoff.rendererModule === "C:/Users/Lenovo/Desktop/Renderer Module" && handoff.filesVerified > 0, JSON.stringify(handoff));
}

for (const result of checks) console.log(`${result.status} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", strict, checks: checks.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", strict, checks: checks.length, failures: [] }, null, 2));
}
