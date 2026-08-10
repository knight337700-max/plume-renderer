import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const checks = [];

async function json(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) { failures.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`); return null; }
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

function check(name, condition, detail) {
  checks.push({ name, condition: Boolean(condition), detail });
  if (!condition) failures.push(`${name}: ${detail}`);
}

const registry = await json("contracts/desktop-capability-registry.json");
const versions = await json("contracts/contract-versions.json");
const templates = await json("contracts/naver-smartchannel-template-contract.json");
const profiles = await json("contracts/naver-platform-composed-source-profiles.json");
const desktopErrors = await json("contracts/desktop-error-registry.json");
const packageJson = await json("package.json");
const channels = registry?.channels ?? [];
const naver = channels.find((entry) => entry.id === "NAVER");
const placements = naver?.placements ?? [];
const ids = placements.map((entry) => entry.id);

check("registry_identity", registry?.registryVersion === "1.0.0" && registry?.channelFirst === true && registry?.modeIsNotUserPrimaryChoice === true, JSON.stringify({ version: registry?.registryVersion, channelFirst: registry?.channelFirst, modeIsNotUserPrimaryChoice: registry?.modeIsNotUserPrimaryChoice }));
check("channel_boundary", channels.length === 2 && channels.some((entry) => entry.id === "KAKAO") && channels.some((entry) => entry.id === "NAVER"), JSON.stringify(channels.map((entry) => entry.id)));
check("naver_placement_count", placements.length === 8 && new Set(ids).size === 8, JSON.stringify(ids));
check("smartchannel_whitelist", templates?.templates?.length === 120 && placements.find((entry) => entry.id === "NAVER_SMARTCHANNEL")?.templateRegistry === "contracts/naver-smartchannel-template-contract.json", String(templates?.templates?.length));
check("renderer_composed_paths", ["NAVER_SMARTCHANNEL", "NAVER_MOBILE_DA", "NAVER_IMAGE_BANNER_1_1"].every((id) => placements.find((entry) => entry.id === id)?.compositionMode === "RENDERER_COMPOSED"), "SmartChannel/Mobile DA/Image Banner are renderer-composed");
check("shared_freeform_mapping", placements.filter((entry) => ["NAVER_MOBILE_DA", "NAVER_IMAGE_BANNER_1_1"].includes(entry.id)).every((entry) => entry.editorType === "FREEFORM_EDITOR" && entry.freeformProfileId === entry.id), "Naver freeform placements reuse their existing profile IDs");
check("source_paths", placements.filter((entry) => ["NAVER_MOBILE_NATIVE", "NAVER_PC_NATIVE", "NAVER_SHOPPING_NEWS", "NAVER_COMMUNICATION_AD", "NAVER_MOBILE_DA_FEED"].includes(entry.id)).every((entry) => entry.compositionMode === "PLATFORM_COMPOSED" && entry.layoutMode === "PLATFORM_SOURCE"), "platform-owned placements use Source Editor");
const feed = placements.find((entry) => entry.id === "NAVER_MOBILE_DA_FEED");
check("feed_scope", feed?.feedSubtypes?.find((entry) => entry.id === "IMAGE")?.enabled === true && feed?.feedSubtypes?.find((entry) => entry.id === "COLLECTION")?.enabled === true && feed?.feedSubtypes?.find((entry) => entry.id === "VIDEO")?.enabled === false, JSON.stringify(feed?.feedSubtypes));
const collectionProfile = profiles?.profiles?.find((entry) => entry.id === "NAVER_FEED_COLLECTION_SOURCE_V1");
check("collection_editor_contract", collectionProfile?.collection?.minimumItems === 4 && collectionProfile?.collection?.maximumItems === 10 && collectionProfile?.collection?.ordering === "INPUT_ORDER_PRESERVED", JSON.stringify(collectionProfile?.collection));
check("version_alignment", packageJson?.version === "0.9.1" && versions?.desktopAppVersion === "0.9.1" && versions?.canonicalPhaseN7?.desktopCurrent === "0.9.0" && versions?.canonicalPhaseN7_1?.desktopCurrent === "0.9.1" && versions?.canonicalPhaseN7_1?.desktopPrevious === "0.9.0" && versions?.canonicalPhaseN7_1?.rendererCoreVersion === "0.8.0" && versions?.documentVersion?.current === "1.21.0", JSON.stringify({ package: packageJson?.version, desktop: versions?.desktopAppVersion, phaseN7: versions?.canonicalPhaseN7, phaseN7_1: versions?.canonicalPhaseN7_1, document: versions?.documentVersion?.current }));
check("implementation_files", await exists("apps/desktop/renderer-ui/src/features/naver/NaverDesktopEditor.tsx") && await exists("tests/e2e/naver-desktop.spec.ts") && await exists("docs/implementation/naver-desktop-capability-matrix.md"), "Naver Desktop editor, E2E suite, and capability matrix exist");
check("runtime_resilience_files", await exists("apps/desktop/electron-main/src/diagnostics/renderer-diagnostics.ts") && await exists("apps/desktop/renderer-ui/src/app/RendererErrorBoundary.tsx") && await exists("apps/desktop/renderer-ui/src/diagnostics/renderer-diagnostics.ts") && await exists("scripts/smoke-naver-desktop.mjs"), "local diagnostics, Error Boundary, renderer capture, and packaged smoke exist");
check("desktop_error_registry", desktopErrors?.registryVersion === "1.0.0" && Array.isArray(desktopErrors?.codes) && ["DESKTOP-CAPABILITY-001", "DESKTOP-CAPABILITY-004", "DESKTOP-EDITOR-001"].every((code) => desktopErrors.codes.some((entry) => entry.code === code)), JSON.stringify({ version: desktopErrors?.registryVersion, codes: desktopErrors?.codes?.length }));
check("final_ui_boundary", !JSON.stringify(registry).includes("finalCanvas") && !JSON.stringify(registry).includes("finalCoordinates"), "capability registry contains no final UI geometry");

for (const result of checks) console.log(`${result.condition ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
if (failures.length > 0) {
  console.error(JSON.stringify({ status: "FAIL", failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: "PASS", checks: checks.length, naverPlacements: placements.length, smartChannelTemplates: templates?.templates?.length ?? 0 }, null, 2));
}
