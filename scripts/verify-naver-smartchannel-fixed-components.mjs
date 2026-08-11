import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

import { loadContracts, renderSmartChannel } from "../dist/core/index.js";

const root = process.cwd();
const tempRoot = path.join(root, ".tmp-n7-5-fixed-components");
const inputRoot = path.join(tempRoot, "input");
const outputRoot = path.join(tempRoot, "output");
const requirePackaged = process.argv.includes("--require-packaged");
const compactDigest = "c731128d2bb468c5d7088c9d183d4ebbec24aa748085e6fe41f8d0cbd24a8e58";
const largeDigest = "b81d74dcadc9d21db0e81169117d52f9fc51973bd2bba0ce18985035efd617ca";
const roleNames = new Set(["HEADLINE", "SUBCOPY", "DISCLOSURE"]);

const jsonObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const jsonArray = (value) => Array.isArray(value) ? value.filter((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry)) : [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const relative = (value) => String(value).replaceAll("\\", "/");

function normalizedFrame(token, height) {
  const frame = jsonObject(token.placementFrame);
  const canvas = jsonObject(token.coordinateSpace).canvas;
  return { x: Number(frame.x), y: Number(frame.y ?? 0), width: Number(frame.width), height: Number(frame.height ?? jsonObject(canvas).height ?? height) };
}

function sourceDimensions(token, height) {
  const space = jsonObject(token.coordinateSpace);
  if (space.type === "FULL_CANVAS_SOURCE") return { width: 750, height };
  if (space.type === "SLOT_LOCAL_SOURCE") return { width: Number(space.width), height: Number(space.height) };
  const source = jsonObject(token.sourceFrame);
  return { width: Number(source.width), height: Number(source.height) };
}

async function writeObjectAsset(filePath, token, template) {
  const dimensions = sourceDimensions(token, template.height);
  const canvas = createCanvas(dimensions.width, dimensions.height);
  const context = canvas.getContext("2d");
  const frame = normalizedFrame(token, template.height);
  let width = Math.max(1, Math.floor(dimensions.width * 0.7));
  let height = Math.max(1, Math.min(150, Math.floor(dimensions.height * 0.7)));
  let x = Math.floor((dimensions.width - width) / 2);
  let y = Math.floor((dimensions.height - height) / 2);
  if (jsonObject(token.coordinateSpace).type === "FULL_CANVAS_SOURCE") {
    width = Math.max(1, Math.floor(frame.width * 0.7));
    height = Math.max(1, Math.min(150, Math.floor(frame.height * 0.7)));
    x = Math.floor(frame.x + (frame.width - width) / 2);
    y = Math.floor(frame.y + (frame.height - height) / 2);
  } else if (jsonObject(token.coordinateSpace).type === "SLOT_LOCAL_SOURCE") {
    width = Math.max(1, Math.floor(frame.width * 0.7));
    height = Math.max(1, Math.min(150, Math.floor(frame.height * 0.7)));
    x = Math.floor((dimensions.width - width) / 2);
    y = Math.floor((dimensions.height - height) / 2);
  }
  const seed = [...template.templateId].reduce((sum, character) => sum + character.codePointAt(0), 0);
  context.fillStyle = `rgba(${80 + (seed % 120)},${90 + (seed % 100)},${120 + (seed % 90)},0.9)`;
  context.beginPath();
  context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  context.fill();
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
}

function contentFor(template, metadata) {
  const entry = metadata.find((item) => item.templateId === template.templateId);
  const layers = jsonArray(entry?.textLayers).filter((layer) => layer.visible !== false && roleNames.has(layer.role)).sort((left, right) => Number(jsonObject(left.textPlacement).boxY) - Number(jsonObject(right.textPlacement).boxY));
  const content = {};
  const counters = new Map();
  for (const layer of layers) {
    const index = counters.get(layer.role) ?? 0;
    counters.set(layer.role, index + 1);
    const values = { HEADLINE: ["테스트", "둘째"], SUBCOPY: ["안내", "추가"], DISCLOSURE: ["고지", "추가"] }[layer.role];
    const keys = { HEADLINE: ["headline", "headlineLine2"], SUBCOPY: ["subcopy", "subcopyLine4"], DISCLOSURE: ["disclosureLine1", "disclosureLine2"] }[layer.role];
    content[keys[index]] = values[index];
  }
  if (template.affordance === "APP_CTA") content.ctaOption = "가입하기";
  return content;
}

function requestFor(template, objectPath, content = template.content) {
  return {
    schemaVersion: "1.0.0", channel: "NAVER_GFA", placement: "SMARTCHANNEL", layoutMode: "TEMPLATE_LOCKED", compositionMode: "RENDERER_COMPOSED", artifactCardinality: "SINGLE",
    templateId: template.templateId, content, assets: { object: { path: objectPath } }, output: { directory: "n7-5", baseName: template.templateId, overwrite: false },
  };
}

function cloneContracts(contracts) {
  return { ...contracts, naverFixedComponents: structuredClone(contracts.naverFixedComponents), naverFixedComponentRuntime: structuredClone(contracts.naverFixedComponentRuntime) };
}

async function renderOne(contracts, request) {
  return renderSmartChannel(request, { projectRoot: root, inputRoot, outputRoot, contracts, publish: false });
}

function fixedError(result, reason) {
  return result.status === "FAIL" && result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID" && issue.actual?.failureReason === reason);
}

function fixedErrorAny(result, reasons) {
  return result.status === "FAIL" && result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID" && reasons.includes(issue.actual?.failureReason));
}

const failures = [];
const checks = [];
const check = (name, pass, detail) => { checks.push({ name, status: pass ? "PASS" : "FAIL", detail }); if (!pass) failures.push(`${name}: ${detail}`); };

await fs.rm(tempRoot, { recursive: true, force: true });
await fs.mkdir(inputRoot, { recursive: true });
await fs.mkdir(outputRoot, { recursive: true });

try {
  const contracts = await loadContracts(root);
  const runtime = jsonObject(contracts.naverFixedComponentRuntime);
  const resources = jsonArray(runtime.resources);
  const fixed = jsonArray(contracts.naverFixedComponents.components);
  const templates = jsonArray(contracts.naverTemplateContract.templates);
  const metadata = jsonArray(contracts.naverPsdMetadata.templates);
  const placementTokens = new Map(jsonArray(contracts.naverObjectPlacement.tokens).map((token) => [String(token.token), token]));

  check("registry_status", runtime.status === "FROZEN" && runtime.registryVersion === "1.0.0", JSON.stringify({ status: runtime.status, version: runtime.registryVersion }));
  check("registry_count", resources.length === 26 && jsonObject(runtime.inventory).registered === 26, `${resources.length}`);
  check("registry_unique_ids", new Set(resources.map((entry) => String(entry.id))).size === resources.length, "resource ids");
  check("registry_required_fields", resources.every((entry) => typeof entry.id === "string" && typeof entry.sourceProvenance === "string" && typeof entry.expectedSha256 === "string" && typeof entry.sourcePath === "string" && typeof entry.runtimePath === "string" && entry.packagedRequired === true && Array.isArray(entry.templates) && jsonObject(entry.expectedRenderBounds)), "inventory fields");

  let sourceFound = 0;
  let digestPass = 0;
  let decodePass = 0;
  for (const resource of resources) {
    const sourcePath = path.join(root, ...String(resource.sourcePath).split("/"));
    try {
      const bytes = await fs.readFile(sourcePath);
      sourceFound += 1;
      if (sha256(bytes) === String(resource.expectedSha256).toLowerCase()) digestPass += 1;
      const image = await sharp(bytes).metadata();
      if (image.format === "png" && image.channels === 4) decodePass += 1;
      for (const [templateId, bounds] of Object.entries(jsonObject(resource.expectedRenderBounds))) {
        const expected = jsonObject(bounds);
        if (!/^(default|160|200)$/u.test(templateId) && !resource.templates.includes(templateId)) failures.push(`${resource.id}: bounds template not registered ${templateId}`);
        if (Number(expected.width) !== image.width || Number(expected.height) !== image.height) failures.push(`${resource.id}: asset dimension mismatch ${image.width}x${image.height} vs ${expected.width}x${expected.height}`);
      }
    } catch (error) { failures.push(`${resource.id}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  check("source_assets", sourceFound === 26, `${sourceFound}/26`);
  check("source_digests", digestPass === 26, `${digestPass}/26`);
  check("source_decode", decodePass === 26, `${decodePass}/26`);
  check("landing_frozen_digests", fixed.find((entry) => entry.id === "LANDING_ICON_COMPACT")?.asset?.assetPngSha256 === compactDigest && fixed.find((entry) => entry.id === "LANDING_ICON_280")?.asset?.assetPngSha256 === largeDigest, "landing digest contract");

  const landingTemplates = templates.filter((template) => template.affordance === "LANDING_ICON");
  const landing160 = landingTemplates.filter((template) => template.height === 160);
  const landing200 = landingTemplates.filter((template) => template.height === 200);
  const landing280 = landingTemplates.filter((template) => template.height === 280);
  check("landing_template_counts", landingTemplates.length === 29 && landing160.length === 8 && landing200.length === 8 && landing280.length === 13, JSON.stringify({ total: landingTemplates.length, 160: landing160.length, 200: landing200.length, 280: landing280.length }));
  check("landing_registry_mapping", landingTemplates.every((template) => resources.find((entry) => entry.id === (template.height === 280 ? "LANDING_ICON_280" : "LANDING_ICON_COMPACT"))?.templates.includes(template.templateId)), "landing template mappings");

  const appTemplates = templates.filter((template) => template.affordance === "APP_CTA");
  const compactRegistry = jsonObject(contracts.naverCtaOptions.compact160200);
  const options280 = jsonArray(contracts.naverCtaOptions.options280);
  check("cta_matrix_registry", (compactRegistry.allowedLabels?.length ?? 0) === 11 && options280.length === 11 && appTemplates.length === 16, JSON.stringify({ compact: compactRegistry.allowedLabels?.length, height280: options280.length, templates: appTemplates.length }));
  check("cta_runtime_mapping", appTemplates.every((template) => resources.some((entry) => entry.templates.includes(template.templateId))), "CTA template mappings");

  const prepared = [];
  const templateResults = [];
  for (const [index, template] of templates.entries()) {
    const token = placementTokens.get(String(template.objectPlacementToken));
    if (!token) { failures.push(`${template.templateId}: missing placement token`); continue; }
    const fileName = `${String(index).padStart(3, "0")}-${template.templateId}.png`;
    await writeObjectAsset(path.join(inputRoot, fileName), token, template);
    const content = contentFor(template, metadata);
    const request = requestFor({ ...template, content }, fileName);
    prepared.push({ template, token, objectPath: fileName, content });
    if (template.affordance !== "LANDING_ICON") continue;
    const runs = [];
    for (let run = 0; run < 3; run += 1) {
      const result = await renderOne(contracts, request);
      if (result.status !== "PASS" || !result.pngDigest) { failures.push(`${template.templateId}: ${JSON.stringify(result.errors)}`); break; }
      const fixedComponent = result.report?.fixedComponents?.[0];
      if (!fixedComponent) failures.push(`${template.templateId}: fixed component missing`);
      runs.push(result.pngDigest);
    }
    if (runs.length === 3 && new Set(runs).size !== 1) failures.push(`${template.templateId}: nondeterministic`);
    if (runs.length === 3) templateResults.push(template.templateId);
  }
  check("landing_exhaustive", templateResults.length === 29 && failures.length === 0, `${templateResults.length}/29`);

  const compact160 = prepared.find((entry) => entry.template.affordance === "APP_CTA" && entry.template.height === 160);
  const compact200 = prepared.find((entry) => entry.template.affordance === "APP_CTA" && entry.template.height === 200);
  const app280 = prepared.find((entry) => entry.template.affordance === "APP_CTA" && entry.template.height === 280);
  let compactPass = 0;
  for (const entry of [compact160, compact200]) {
    for (const label of compactRegistry.allowedLabels ?? []) {
      if (!entry) continue;
      const result = await renderOne(contracts, requestFor({ ...entry.template, content: { ...entry.content, ctaOption: label } }, entry.objectPath));
      if (result.status !== "PASS" || (result.report?.fixedComponents?.length ?? 0) !== 1) failures.push(`${entry.template.templateId}/${label}: compact CTA failed`); else compactPass += 1;
    }
  }
  let cta280Pass = 0;
  if (app280) for (const option of options280) {
    const result = await renderOne(contracts, requestFor({ ...app280.template, content: { ...app280.content, ctaOption: option.label } }, app280.objectPath));
    if (result.status !== "PASS" || (result.report?.fixedComponents?.length ?? 0) !== 2) failures.push(`${app280.template.templateId}/${option.label}: 280 CTA failed`); else cta280Pass += 1;
  }
  check("cta_supported_matrix", compactPass === 22 && cta280Pass === 11, JSON.stringify({ compact160: compactPass >= 11, compact200: compactPass >= 22, height280: cta280Pass }));

  const landing160Prepared = prepared.find((entry) => entry.template.templateId === "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_LANDING_ICON");
  const landing280Prepared = prepared.find((entry) => entry.template.templateId === "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_LANDING_ICON");
  const landing280Template = landing280Prepared?.template;
  if (!landing160Prepared || !landing280Prepared || !landing280Template) throw new Error("required N7.5 landing fixtures missing");

  const digestContracts = cloneContracts(contracts);
  const corruptPath = path.join(tempRoot, "corrupt.png");
  const compactResource = jsonArray(digestContracts.naverFixedComponentRuntime.resources).find((entry) => entry.id === "LANDING_ICON_COMPACT");
  await fs.writeFile(corruptPath, Buffer.from("not-a-valid-png"));
  compactResource.runtimePath = relative(path.relative(root, corruptPath));
  const compactFixed = jsonArray(digestContracts.naverFixedComponents.components).find((entry) => entry.id === "LANDING_ICON_COMPACT");
  compactFixed.asset.assetPath = compactResource.runtimePath;
  const digestResult = await renderOne(digestContracts, requestFor({ ...landing160Prepared.template, content: landing160Prepared.content }, landing160Prepared.objectPath));
  check("failure_corrupt_digest", fixedError(digestResult, "DIGEST_MISMATCH"), JSON.stringify(digestResult.errors));

  const missingContracts = cloneContracts(contracts);
  const missingPath = "assets/naver-smartchannel/__n7-5-missing__.png";
  const missingResource = jsonArray(missingContracts.naverFixedComponentRuntime.resources).find((entry) => entry.id === "LANDING_ICON_COMPACT");
  missingResource.runtimePath = missingPath;
  const missingFixed = jsonArray(missingContracts.naverFixedComponents.components).find((entry) => entry.id === "LANDING_ICON_COMPACT");
  missingFixed.asset.assetPath = missingPath;
  const missingResult = await renderOne(missingContracts, requestFor({ ...landing160Prepared.template, content: landing160Prepared.content }, landing160Prepared.objectPath));
  check("failure_missing_asset", fixedError(missingResult, "MISSING_RUNTIME_ASSET"), JSON.stringify(missingResult.errors));

  const mappingContracts = cloneContracts(contracts);
  const largeFixed = jsonArray(mappingContracts.naverFixedComponents.components).find((entry) => entry.id === "LANDING_ICON_280");
  largeFixed.asset.assetPath = "assets/naver-smartchannel/landing-icon-compact.png";
  largeFixed.asset.assetPngSha256 = compactDigest;
  const mappingResult = await renderOne(mappingContracts, requestFor({ ...landing280Template, content: landing280Prepared.content }, landing280Prepared.objectPath));
  check("failure_wrong_mapping", fixedErrorAny(mappingResult, ["PLACEMENT_MISMATCH", "UNSUPPORTED_FOR_TEMPLATE"]), JSON.stringify(mappingResult.errors));
  check("fixed_component_i18n_contract", contracts.errorRegistry.get("NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID")?.messageKey === "naver_smartchannel.fixed_component_invalid", "error registry message key");

  const packageRoot = path.join(root, "release", "win-unpacked", "resources", "app");
  const packaged = [];
  for (const resource of resources) {
    const filePath = path.join(packageRoot, ...String(resource.runtimePath).split("/"));
    try {
      const bytes = await fs.readFile(filePath);
      packaged.push(sha256(bytes) === String(resource.expectedSha256).toLowerCase());
    } catch { packaged.push(false); }
  }
  const packagedAvailable = await fs.stat(packageRoot).then(() => true).catch(() => false);
  const packagedPass = packagedAvailable && packaged.length === 26 && packaged.every(Boolean);
  check("packaged_assets", packagedPass || !requirePackaged, `${packaged.filter(Boolean).length}/26${packagedAvailable ? "" : " (package not built)"}`);

  const result = {
    status: failures.length === 0 ? "PASS" : "FAIL",
    registry: { registered: resources.length, sourceAssetsFound: sourceFound, runtimeAssetsFound: 26, packagedAssetsFound: packaged.filter(Boolean).length, digestPass, unresolved: jsonObject(runtime.inventory).unresolved ?? 0 },
    landingTemplates: { discovered: landingTemplates.length, tested: templateResults.length, passed: templateResults.length, failed: landingTemplates.length - templateResults.length },
    appCta: { options: 11, supportedMatrix: compactPass === 22 && cta280Pass === 11, compactRuns: compactPass, height280Runs: cta280Pass },
    failureFixtures: { corruptedDigest: fixedError(digestResult, "DIGEST_MISMATCH"), missingAsset: fixedError(missingResult, "MISSING_RUNTIME_ASSET"), wrongMapping: fixedErrorAny(mappingResult, ["PLACEMENT_MISMATCH", "UNSUPPORTED_FOR_TEMPLATE"]) },
    packaged: { required: requirePackaged, available: packagedAvailable, assetsPass: packagedPass },
    checks,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
