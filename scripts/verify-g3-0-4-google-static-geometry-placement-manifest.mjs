import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const rootArg = process.argv.find((arg) => arg.startsWith("--root="))?.slice("--root=".length);
const root = path.resolve(rootArg ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const expectedBaselineHead = "44b64dcba1400c0637c4266ba735efc318d003c4";
const expectedGoldenSha256 = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const checks = [];
const failures = [];

function check(id, condition, detail = "") {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  console.log(`${status} ${id}: ${detail}`);
  if (!condition) failures.push(`${id}: ${detail}`);
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) { check(`json_${relativePath}`, false, error instanceof Error ? error.message : String(error)); return null; }
}

async function fileBytes(relativePath) { return readFile(path.join(root, relativePath)); }
async function exists(relativePath) { try { await stat(path.join(root, relativePath)); return true; } catch { return false; } }
async function sha256(relativePath) { return createHash("sha256").update(await fileBytes(relativePath)).digest("hex"); }

function git(args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
  catch { return ""; }
}

function ancestor(commit) {
  try { execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" }); return true; }
  catch { return false; }
}

function canonicalPlan(entry, plan) {
  const keys = ["profileId", "placementPolicy", "sourceRect", "destinationRect", "background", "outputFormat", "jpegQuality", "semanticPlan", "explicitElementPlan"];
  return keys.every((key) => {
    const left = entry[key];
    const right = plan[key];
    if (left === undefined && right === undefined) return true;
    return JSON.stringify(left) === JSON.stringify(right);
  });
}

function pngHeader(bytes) {
  if (bytes.length < 26 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitDepth: bytes[24], colorType: bytes[25] };
}

function jpegSignature(bytes) {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

async function main() {
  const head = git(["rev-parse", "HEAD"]);
  check("baseline_lineage", ancestor(expectedBaselineHead), `expected ancestor=${expectedBaselineHead}; actual=${head}`);

  const versions = await readJson("contracts/contract-versions.json");
  const packageJson = await readJson("package.json");
  const registry = await readJson("contracts/google/default-placement-plans.g3.0.4.json");
  const registrySchema = await readJson("contracts/google/default-placement-plans.g3.0.4.schema.json");
  const goldens = await readJson("contracts/google/goldens.g2.1.json");
  const supersession = await readJson("contracts/google/desktop-qa-supersession.g3.0.4.json");
  check("phase_record", versions?.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION", JSON.stringify(versions?.canonicalPhaseG3_0_4Google));
  check("version_policy", versions?.documentVersion?.previous === "1.30.0" && versions?.documentVersion?.current === "1.31.0" && versions?.documentVersion?.bump === "minor" && packageJson?.version === "0.13.0" && versions?.desktopAppVersion === "0.13.0" && versions?.googleExportManifestSchemaVersion === "1.1.0", JSON.stringify({ document: versions?.documentVersion, package: packageJson?.version, desktop: versions?.desktopAppVersion, googleManifest: versions?.googleExportManifestSchemaVersion }));
  check("reused_versions", versions?.templateContractVersion === "1.9.0" && versions?.inputSchemaVersion?.current === "1.2.0" && versions?.outputSchemaVersion?.current === "2.0.0" && versions?.renderManifestSchemaVersion === "1.0.0" && versions?.responseEnvelopeSchemaVersion === "1.0.0", "template/input/output/legacy manifest/response versions remain frozen");
  check("template_coordinates", versions?.canonicalPhaseG3_0_4Google?.templateCoordinatesChanged === false, "coordinates unchanged");
  const goldenSha = await sha256("contracts/google/goldens.g2.1.json").catch(() => "");
  const objectSha = await sha256("reference/kakao-tool/OBJECT_RIGHT.png").catch(() => "");
  check("frozen_golden_registry", goldenSha === expectedGoldenSha256 && goldens?.status === "FROZEN" && goldens?.entries?.length === 14, goldenSha);
  check("object_right_reference", objectSha === expectedObjectRightSha256, objectSha);
  check("g3_1_historical_preserved", supersession?.status === "SUPERSEDED_PENDING_REACCEPTANCE" && supersession?.supersedes?.freezeRegistrySha256 === "1dc779a4feb83b7df5c6b06966d74492f2e5c682ea32b19dcd87813b3ea218ef" && supersession?.evidence?.userAcceptanceRecorded === false && supersession?.evidence?.freezePerformed === false, JSON.stringify(supersession?.evidence));
  const freezeSha = await sha256("contracts/google/desktop-qa-freeze.g3.1.json").catch(() => "");
  check("g3_1_freeze_byte_preserved", freezeSha === supersession?.supersedes?.freezeRegistrySha256, freezeSha);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  let schemaValid = false;
  try { schemaValid = Boolean(ajv.compile(registrySchema)(registry)); } catch (error) { check("registry_schema_compile", false, error instanceof Error ? error.message : String(error)); }
  check("default_registry_schema", schemaValid, schemaValid ? "registry validates against g3.0.4 schema" : JSON.stringify(ajv.errors));
  const entries = Array.isArray(registry?.entries) ? [...registry.entries].sort((a, b) => a.profileId.localeCompare(b.profileId)) : [];
  const geometry = entries.filter((entry) => entry.role !== "UPLOADED_DISPLAY_STATIC");
  const uploaded = entries.filter((entry) => entry.role === "UPLOADED_DISPLAY_STATIC");
  check("default_registry_shape", registry?.schemaVersion === "1.0.0" && registry?.registryVersion === "1.0.0" && entries.length === 14 && geometry.length === 7 && uploaded.length === 7, JSON.stringify({ entries: entries.length, geometry: geometry.length, uploaded: uploaded.length }));
  check("uploaded_none_exact_canvas", uploaded.length === 7 && uploaded.every((entry) => entry.placementPolicy === "NONE" && entry.explicitElementPlan === true && entry.destinationRect.x === 0 && entry.destinationRect.y === 0 && entry.destinationRect.width === entry.sourceDimensions.width && entry.destinationRect.height === entry.sourceDimensions.height), "Uploaded Display Static defaults are exact-canvas NONE plans");
  check("identity_transform", JSON.stringify(versions?.canonicalPhaseG3_0_4Google?.identityTransform) === JSON.stringify({ x: 0.5, y: 0.5, scale: 1 }), "x=.5 y=.5 scale=1");

  const core = await import(pathToFileURL(path.join(root, "dist", "core", "index.js")).href).catch((error) => { check("core_build_import", false, error instanceof Error ? error.message : String(error)); return null; });
  let contracts = null;
  if (core) contracts = await core.loadGoogleStaticContracts(root).catch((error) => { check("core_contract_loader", false, error instanceof Error ? error.message : String(error)); return null; });
  check("runtime_registry_loaded", Boolean(contracts?.defaultPlacementPlans?.entries?.length === 14), `${contracts?.defaultPlacementPlans?.entries?.length ?? 0} entries loaded by packaged contract loader`);

  const goldenById = new Map((goldens?.entries ?? []).map((entry) => [entry.profileId, entry]));
  let goldenEqual = 0;
  let replayEqual = 0;
  for (const entry of entries) {
    const planPath = entry.layoutPlanRelativePath;
    const plan = await readJson(planPath);
    const sourceBytes = await fileBytes(entry.sourceFixtureRelativePath).catch(() => null);
    const golden = goldenById.get(entry.profileId);
    check(`registry_plan_${entry.profileId}`, Boolean(plan && sourceBytes && golden && canonicalPlan(entry, plan)), `${planPath}`);
    if (!sourceBytes || !golden || !plan || !core || !contracts) continue;
    try {
      const renderPlan = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "schemaVersion" && key !== "sourceFixturePath"));
      const first = await core.renderGoogleStaticCandidate(sourceBytes, renderPlan, contracts);
      const second = await core.renderGoogleStaticCandidate(sourceBytes, renderPlan, contracts);
      const digest = createHash("sha256").update(first.bytes).digest("hex");
      const goldenBytes = await fileBytes(golden.frozenArtifactRelativePath);
      const equal = digest === golden.artifactSha256 && first.bytes.equals(goldenBytes) && first.renderFingerprint === golden.renderFingerprint && first.width === golden.canvas.width && first.height === golden.canvas.height;
      const replay = first.bytes.equals(second.bytes) && first.renderFingerprint === second.renderFingerprint;
      const sig = first.mime === "image/png" ? pngHeader(first.bytes) : jpegSignature(first.bytes);
      check(`default_golden_${entry.profileId}`, equal && Boolean(sig), `${digest} / ${golden.artifactSha256}`);
      check(`default_replay_${entry.profileId}`, replay, first.renderFingerprint);
      if (equal) goldenEqual += 1;
      if (replay) replayEqual += 1;
    } catch (error) { check(`default_render_${entry.profileId}`, false, error instanceof Error ? error.message : String(error)); }
  }
  check("all_14_default_goldens", goldenEqual === 14, `${goldenEqual}/14 byte-equal`);
  check("all_14_default_replay", replayEqual === 14, `${replayEqual}/14 deterministic replays`);

  const controller = await readFile(path.join(root, "apps/desktop/electron-main/src/desktop-controller.ts"), "utf8");
  const ui = await readFile(path.join(root, "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx"), "utf8");
  const coreSource = await readFile(path.join(root, "src/core/google-static.ts"), "utf8");
  const exportGoogleStart = controller.indexOf("async #exportGoogle");
  const manifestStart = controller.indexOf("const manifest = {", exportGoogleStart);
  const manifestEnd = controller.indexOf("const manifestText", manifestStart);
  const manifestSource = manifestStart >= 0 && manifestEnd > manifestStart ? controller.slice(manifestStart, manifestEnd) : "";
  check("runtime_source_of_truth", controller.includes("validateGoogleDefaultPlacementContract") && coreSource.includes("default-placement-plans.g3.0.4.json") && !controller.includes("goldens.g2.1.json"), "Main/Core validate the packaged default registry and do not read Golden registry");
  check("placement_plan_required", controller.includes("if (!request.placementPlan)") && controller.includes("placementPlan"), "missing plans fail closed");
  check("uploaded_controls_disabled", ui.includes("disabled={profile.role === \"UPLOADED_DISPLAY_STATIC\" || !asset}") && ui.includes("배치 조정은 비활성화됩니다"), "Uploaded controls are disabled in the production UI");
  check("manifest_v1_1_fields", manifestSource.includes('schemaVersion: "1.1.0"') && manifestSource.includes("outputArtifactDigest") && manifestSource.includes("canonicalRequest") && manifestSource.includes("resolvedPlacement") && manifestSource.includes("outputEncoding"), "Google export manifest contains canonical provenance and output digest");
  check("jpeg_png_digest_policy", manifestSource.includes("outputPngDigest: artifactDigest") && manifestSource.includes("outputFormat === \"PNG\"") && manifestSource.includes("qualityResolved") && controller.includes("chromaSubsampling: \"4:2:0\""), "JPEG omits deprecated PNG digest and encoder settings are pinned");
  check("no_network_or_plume", !`${controller}${ui}${coreSource}`.toLowerCase().match(/googleapis|plume|cdn\.|fetch\s*\(/u), "production Google path has no remote runtime dependency");

  const desktopE2eCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
  const desktopE2eArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec playwright test tests/e2e/desktop.spec.ts -g G3.0.4 --retries=0"]
    : ["exec", "playwright", "test", "tests/e2e/desktop.spec.ts", "-g", "G3.0.4", "--retries=0"];
  let desktopE2eOutput = "";
  try {
    desktopE2eOutput = execFileSync(desktopE2eCommand, desktopE2eArgs, {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      env: { ...process.env, CI: "1" },
    });
  } catch (error) {
    desktopE2eOutput = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${String(error)}`;
  }
  check("electron_desktop_g304_e2e", /2 passed/u.test(desktopE2eOutput), desktopE2eOutput.trim().slice(-800) || "G3.0.4 Electron E2E did not run");

  const changed = new Set([git(["diff", "--name-only", expectedBaselineHead, "HEAD"]), git(["diff", "--name-only"]), git(["diff", "--name-only", "--cached"])].join("\n").split(/\r?\n/u).map((value) => value.replaceAll("\\", "/")).filter(Boolean));
  const forbidden = [...changed].filter((entry) => entry === "contracts/google/goldens.g2.1.json" || entry.startsWith("artifacts/g3-1/") || entry === "contracts/google/desktop-qa-freeze.g3.1.json" || entry.startsWith("fixtures/golden/google/"));
  check("frozen_artifacts_unchanged", forbidden.length === 0, forbidden.join(",") || "G2.1/G3.1 frozen artifacts unchanged");
  check("frozen_channel_paths_unchanged", ![...changed].some((entry) => /^(fixtures\/golden\/(?!google\/)|artifacts\/(?!g3-1\/)|contracts\/goldens)/u.test(entry)), "KAKAO/NAVER/META frozen paths unchanged");

  const status = failures.length === 0 ? "PASS" : "FAIL";
  console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, head, canonicalDocumentVersion: versions?.documentVersion?.current }, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

await main();
