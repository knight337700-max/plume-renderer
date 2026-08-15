import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baselineCommit = "b1b001bcce893ef7a97017be202323026eda297a";
const expectedCanonicalSha256 = null;
const expectedGoldenSha256 = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const productionPaths = new Set([
  "apps/desktop/electron-main/src/desktop-controller.ts",
  "apps/desktop/electron-main/src/ipc/schemas.ts",
  "apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx",
  "apps/desktop/renderer-ui/src/i18n/ko-KR.json",
  "apps/desktop/renderer-ui/src/styles.css",
  "apps/desktop/shared/src/google-static-request.ts",
  "apps/desktop/shared/src/types.ts",
  "src/core/google-static-render.ts",
  "src/core/google-static.ts",
  "src/core/index.ts",
  "packages/renderer-contract/src/google-static.ts",
  "packages/renderer-contract/src/index.ts",
]);
const checks = [];
const failures = [];

function check(id, condition, detail = "") {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
  console.log(`${status} ${id}: ${detail}`);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function sha256(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isAncestor(commit) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function pngHeader(bytes) {
  if (bytes.length < 26 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function jpegSignature(bytes) {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

async function main() {
  const versions = await readJson("contracts/contract-versions.json");
  const packageJson = await readJson("package.json");
  const formats = await readJson("contracts/google/format-capability.g3-0-3.json");
  const goldens = await readJson("contracts/google/goldens.g2.1.json");
  const profiles = await readJson("contracts/google/static-asset-profiles.g1.json");
  const canonicalSha = await sha256("docs/kakao-bizboard-renderer-spec-v1.md");
  const goldenSha = await sha256("contracts/google/goldens.g2.1.json");
  const objectSha = await sha256("reference/kakao-tool/OBJECT_RIGHT.png");
  const phase = versions?.canonicalPhaseG3_0_3Google;
  const g3_1Frozen = versions?.canonicalPhaseG3_1Google?.phase === "G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE" && versions?.canonicalPhaseG3_1Google?.status === "FROZEN";

  check("baseline_lineage", isAncestor(baselineCommit), baselineCommit);
  check("phase_record", (phase?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY" && phase?.g3_1ArtifactsCreated === false) || (g3_1Frozen && versions?.canonicalPhaseG3_1Google?.acceptance === "USER_ACCEPTED"), JSON.stringify({ phase: phase?.phase, g3_1Frozen }));
  check("canonical_version", g3_1Frozen ? versions?.documentVersion?.previous === "1.29.0" && versions?.documentVersion?.current === "1.30.0" && versions?.documentVersion?.bump === "minor" : versions?.documentVersion?.previous === "1.28.1" && versions?.documentVersion?.current === "1.29.0" && versions?.documentVersion?.bump === "minor", JSON.stringify(versions?.documentVersion));
  check("canonical_hash", (g3_1Frozen ? versions?.canonicalPhaseG3_1Google?.canonicalDocumentSha256 : phase?.canonicalDocumentSha256) === canonicalSha && (expectedCanonicalSha256 === null || g3_1Frozen || canonicalSha === expectedCanonicalSha256), canonicalSha);
  check("desktop_version", packageJson?.version === "0.12.0" && versions?.desktopAppVersion === "0.12.0", JSON.stringify({ package: packageJson?.version, desktop: versions?.desktopAppVersion }));
  check("reused_core_validator_schemas", phase?.rendererCoreVersion === "0.11.0" && phase?.validatorCurrent === "1.11.0" && phase?.inputSchemaVersion === "1.2.0" && phase?.outputSchemaVersion === "2.0.0", JSON.stringify({ core: phase?.rendererCoreVersion, validator: phase?.validatorCurrent, input: phase?.inputSchemaVersion, output: phase?.outputSchemaVersion }));
  check("template_and_canvas_frozen", phase?.templateCoordinatesChanged === false && versions?.templateContractVersion === "1.9.0", JSON.stringify({ template: versions?.templateContractVersion, coordinatesChanged: phase?.templateCoordinatesChanged }));
  check("frozen_golden_registry", goldenSha === expectedGoldenSha256 && goldens?.status === "FROZEN" && goldens?.entries?.length === 14, goldenSha);
  check("object_right_reference", objectSha === expectedObjectRightSha256, objectSha);
  check("g3_1_absent", g3_1Frozen ? await exists("artifacts/g3-1/google-static-desktop-user-acceptance.json") && await exists("contracts/google/desktop-qa-freeze.g3.1.json") : !(await exists("artifacts/g3-1")) && !(await exists("docs/implementation/google-static-user-visual-acceptance-golden-freeze-g3-1.md")), g3_1Frozen ? "G3.1 freeze artifacts present" : "G3.1 acceptance/freeze artifacts absent");

  const changed = new Set([
    ...git(["diff", "--name-only", baselineCommit, "HEAD"]).split(/\r?\n/u),
    ...git(["diff", "--name-only"]).split(/\r?\n/u),
    ...git(["diff", "--name-only", "--cached"]).split(/\r?\n/u),
  ].map((entry) => entry.replaceAll("\\", "/")).filter(Boolean));
  const changedProduction = [...changed].filter((entry) => entry.startsWith("apps/desktop/") || entry.startsWith("src/") || entry.startsWith("packages/") || entry.startsWith("fixtures/golden/"));
  const unexpectedProduction = changedProduction.filter((entry) => !productionPaths.has(entry) && !entry.startsWith("fixtures/golden/google/"));
  check("production_scope", unexpectedProduction.length === 0, unexpectedProduction.join(",") || "only approved Google production paths changed");

  const editor = await readText("apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx");
  const controller = await readText("apps/desktop/electron-main/src/desktop-controller.ts");
  const sharedBuilder = await readText("apps/desktop/shared/src/google-static-request.ts");
  const coreSource = await readText("src/core/google-static-render.ts");
  const forbiddenRuntime = /(?:toDataURL|html2canvas|capturePage|fetch\s*\(|googleapis|plume|cdn\.|https?:\/\/)/iu;
  check("production_transform_controls", ["google-output-format", "google-placement-x", "google-placement-y", "google-placement-scale", "google-placement-zoom-in", "google-placement-zoom-out", "google-reset-placement"].every((id) => editor.includes(id)), "format, numeric, zoom, and reset controls are in the production UI");
  check("canonical_builder_path", editor.includes("buildCanonicalGoogleStaticRequest") && controller.includes("buildCanonicalGoogleStaticRequest(requestInput)") && controller.includes("built.requestFingerprint !== previewRecord.inputDigest"), "Preview/Export share canonical builder and stale guard");
  check("runtime_boundary", !forbiddenRuntime.test(editor + controller + sharedBuilder + coreSource), "no screenshot capture, remote network, Plume, or CDN path");
  const googleExportStart = controller.indexOf("async #exportGoogle");
  const googleManifestStart = controller.indexOf("const manifest = {", googleExportStart);
  const googleManifestEnd = controller.indexOf("const manifestText", googleManifestStart);
  const googleManifestSource = googleManifestStart >= 0 && googleManifestEnd > googleManifestStart ? controller.slice(googleManifestStart, googleManifestEnd) : "";
  check("manifest_self_digest_absent", googleManifestSource.length > 0 && !googleManifestSource.includes("manifestDigest"), "stored manifest is not self-referential");
  check("output_extension_and_encoder", controller.includes("output.${outputFormat === \"JPEG\" ? \"jpg\" : \"png\"}") && coreSource.includes("outputFormat === \"PNG\" ? \"image/png\" : \"image/jpeg\""), "PNG/JPEG extension and MIME are selected by the same plan");

  const profileIds = new Set([
    ...(profiles?.geometryProfiles ?? []).map((entry) => entry.profileId),
    ...(profiles?.uploadedDisplayStaticProfiles ?? []).map((entry) => entry.profileId),
  ]);
  const goldenByProfile = new Map((goldens?.entries ?? []).map((entry) => [entry.profileId, entry]));
  check("format_registry_shape", formats?.status === "IMPLEMENTED" && formats?.globalAllowedFormats?.join(",") === "PNG,JPEG" && formats?.profiles?.length === 14 && formats?.profiles?.every((entry) => profileIds.has(entry.profileId) && entry.allowedFormats?.join(",") === "PNG,JPEG"), JSON.stringify({ profiles: formats?.profiles?.length, allowed: formats?.globalAllowedFormats }));
  check("default_format_matches_frozen_goldens", formats?.profiles?.length === 14 && formats.profiles.every((entry) => entry.defaultFormat === (goldenByProfile.get(entry.profileId)?.mime === "image/jpeg" ? "JPEG" : "PNG")), "default formats preserve all 14 G2.1 MIME values");
  check("jpeg_policy_pinned", formats?.jpegPolicy?.qualityDefault === 88 && formats?.jpegPolicy?.qualitySlider === false && formats?.jpegPolicy?.chromaSubsampling === "4:2:0" && formats?.jpegPolicy?.progressive === false && formats?.jpegPolicy?.metadataPassthrough === false && formats?.jpegPolicy?.alphaMatte === "EXISTING_OPAQUE_CANVAS_BACKGROUND", JSON.stringify(formats?.jpegPolicy));
  check("phase_capabilities_recorded", phase?.allowedFormats?.join(",") === "PNG,JPEG" && phase?.profileCount === 14 && phase?.defaultGoldenFormatPreserved === true && phase?.placementAndFormatInFingerprint === true && phase?.stalePlacementExportBlocked === true && phase?.staleFormatExportBlocked === true, JSON.stringify({ allowedFormats: phase?.allowedFormats, profileCount: phase?.profileCount }));
  check("byte_limits_frozen", versions?.fileSizePolicy?.warningThresholdBytes === 270000 && versions?.fileSizePolicy?.hardLimitBytes === 300000, JSON.stringify(versions?.fileSizePolicy));

  let core;
  try {
    core = await import("../dist/core/index.js");
  } catch (error) {
    check("core_build", false, error instanceof Error ? error.message : String(error));
  }
  if (core) {
    const contracts = await core.loadGoogleStaticContracts(root);
    let goldenPasses = 0;
    for (const entry of goldens?.entries ?? []) {
      const sourceBytes = await readFile(path.join(root, entry.sourceFixtureRelativePath));
      const plan = JSON.parse(await readFile(path.join(root, entry.layoutPlanRelativePath), "utf8"));
      const renderPlan = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "schemaVersion" && key !== "sourceFixturePath"));
      const rendered = await core.renderGoogleStaticCandidate(sourceBytes, renderPlan, contracts);
      const digest = createHash("sha256").update(rendered.bytes).digest("hex");
      const png = rendered.mime === "image/png" ? pngHeader(rendered.bytes) : null;
      const signatureOk = rendered.mime === "image/png" ? Boolean(png && png.bitDepth === 8 && png.colorType === 6) : jpegSignature(rendered.bytes);
      const ok = digest === entry.artifactSha256 && rendered.renderFingerprint === entry.renderFingerprint && rendered.width === entry.canvas.width && rendered.height === entry.canvas.height && signatureOk;
      check(`frozen_render_${entry.profileId}`, ok, `${digest} / ${entry.artifactSha256}`);
      if (ok) goldenPasses += 1;
    }
    check("frozen_render_all_14", goldenPasses === 14, `${goldenPasses}/14 byte-equal outputs`);

    const landscape = goldens.entries.find((entry) => entry.profileId === "GOOGLE_MARKETING_LANDSCAPE_1_91");
    if (landscape) {
      const sourceBytes = await readFile(path.join(root, landscape.sourceFixtureRelativePath));
      const baseJson = JSON.parse(await readFile(path.join(root, landscape.layoutPlanRelativePath), "utf8"));
      const basePlan = Object.fromEntries(Object.entries(baseJson).filter(([key]) => key !== "schemaVersion" && key !== "sourceFixturePath"));
      const changedCrop = { ...basePlan, sourceRect: { x: 128, y: 0, width: 448, height: 480 }, outputFormat: "PNG" };
      const first = await core.renderGoogleStaticCandidate(sourceBytes, changedCrop, contracts);
      const second = await core.renderGoogleStaticCandidate(sourceBytes, changedCrop, contracts);
      const defaultBytes = await core.renderGoogleStaticCandidate(sourceBytes, basePlan, contracts);
      check("manual_transform_deterministic", first.bytes.equals(second.bytes) && !first.bytes.equals(defaultBytes.bytes) && first.renderFingerprint === second.renderFingerprint, "manual crop transform is byte deterministic and changes pixels");
      const jpeg = await core.renderGoogleStaticCandidate(sourceBytes, { ...basePlan, outputFormat: "JPEG", jpegQuality: 88 }, contracts);
      check("jpeg_actual_encoding", jpeg.mime === "image/jpeg" && jpegSignature(jpeg.bytes) && jpeg.bytes.length > 0, `${jpeg.mime} ${jpeg.bytes.length} bytes`);
    }
  }

  const status = failures.length === 0 ? "PASS" : "FAIL";
  console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, canonicalSha256: canonicalSha, goldenSha256: goldenSha, objectRightSha256: objectSha }, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

await main();
