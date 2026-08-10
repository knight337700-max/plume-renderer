import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

import {
  loadContracts,
  renderSmartChannel,
} from "../dist/core/index.js";

const root = process.cwd();
const tempRoot = path.join(root, ".tmp-n3-smartchannel-exhaustive");
const inputRoot = path.join(tempRoot, "input");
const outputRoot = path.join(tempRoot, "output");
const roleNames = new Set(["HEADLINE", "SUBCOPY", "DISCLOSURE"]);

function jsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function jsonArray(value) {
  return Array.isArray(value) ? value.filter((entry) => entry !== null && typeof entry === "object" && !Array.isArray(entry)) : [];
}

function normalizedFrame(token, height) {
  const frame = jsonObject(token.placementFrame);
  const canvas = jsonObject(token.coordinateSpace).canvas;
  return {
    x: Number(frame.x),
    y: Number(frame.y ?? 0),
    width: Number(frame.width),
    height: Number(frame.height ?? jsonObject(canvas).height ?? height),
  };
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
  let x = 3;
  let y = 3;
  let width = Math.max(1, dimensions.width - 6);
  let height = Math.max(1, dimensions.height - 6);
  if (jsonObject(token.coordinateSpace).type === "FULL_CANVAS_SOURCE") {
    x = frame.x + 3;
    y = frame.y + 3;
    width = Math.max(1, frame.width - 6);
    height = Math.max(1, frame.height - 6);
  } else if (jsonObject(token.coordinateSpace).type === "SLOT_LOCAL_SOURCE") {
    width = Math.max(1, frame.width - 6);
    height = Math.max(1, frame.height - 6);
  }
  const seed = [...template.templateId].reduce((sum, character) => sum + character.codePointAt(0), 0);
  context.fillStyle = `rgba(${80 + (seed % 120)},${90 + (seed % 100)},${120 + (seed % 90)},0.9)`;
  context.fillRect(x, y, width, height);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
}

function contentFor(template, metadata) {
  const entry = metadata.find((item) => item.templateId === template.templateId);
  const layers = jsonArray(entry?.textLayers)
    .filter((layer) => layer.visible !== false && roleNames.has(layer.role))
    .sort((left, right) => Number(jsonObject(left.textPlacement).boxY) - Number(jsonObject(right.textPlacement).boxY));
  const content = {};
  const counters = new Map();
  for (const layer of layers) {
    const index = counters.get(layer.role) ?? 0;
    counters.set(layer.role, index + 1);
    const values = {
      HEADLINE: ["테스트", "둘째"],
      SUBCOPY: ["안내", "추가"],
      DISCLOSURE: ["고지", "추가"],
    }[layer.role];
    const keys = {
      HEADLINE: ["headline", "headlineLine2"],
      SUBCOPY: ["subcopy", "subcopyLine4"],
      DISCLOSURE: ["disclosureLine1", "disclosureLine2"],
    }[layer.role];
    content[keys[index]] = values[index];
  }
  if (template.affordance === "APP_CTA") content.ctaOption = "가입하기";
  return content;
}

function requestFor(template, objectPath, ctaOption) {
  const content = { ...template.content };
  if (ctaOption !== undefined) content.ctaOption = ctaOption;
  return {
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    artifactCardinality: "SINGLE",
    templateId: template.templateId,
    content,
    assets: { object: { path: objectPath } },
    output: { directory: "n3", baseName: template.templateId, overwrite: false },
  };
}

function expectedFixedCount(template) {
  if (template.affordance === "NONE") return 0;
  if (template.affordance === "LANDING_ICON") return 1;
  return template.height === 280 ? 2 : 1;
}

async function renderOne(contracts, request) {
  return renderSmartChannel(request, {
    projectRoot: root,
    inputRoot,
    outputRoot,
    contracts,
    publish: false,
  });
}

await fs.rm(tempRoot, { recursive: true, force: true });
await fs.mkdir(inputRoot, { recursive: true });
await fs.mkdir(outputRoot, { recursive: true });

const failures = [];
try {
  const contracts = await loadContracts(root);
  const templates = jsonArray(contracts.naverTemplateContract.templates);
  const placementTokens = new Map(jsonArray(contracts.naverObjectPlacement.tokens).map((token) => [String(token.token), token]));
  const metadata = jsonArray(contracts.naverPsdMetadata.templates);
  const prepared = [];
  let templatesPassed = 0;

  const runtimeFontPolicy = jsonObject(contracts.naverRuntimeFontPolicy);
  if (runtimeFontPolicy.runtimeStatus === "BLOCKED_UNRESOLVED_OFFICIAL_ASSET") {
    for (let index = 0; index < templates.length; index += 1) {
      const template = templates[index];
      const token = placementTokens.get(String(template.objectPlacementToken));
      if (!token) throw new Error(`${template.templateId}: missing placement token`);
      const fileName = `${String(index).padStart(3, "0")}-${template.templateId}.png`;
      await writeObjectAsset(path.join(inputRoot, fileName), token, template);
      const content = contentFor(template, metadata);
      const result = await renderOne(contracts, requestFor({ ...template, content }, fileName));
      if (result.status !== "FAIL" || result.downloadAllowed || result.pngPath !== null || !result.errors.some((issue) => issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE")) throw new Error(`${template.templateId}: unresolved official font did not fail closed`);
    }
    console.log(JSON.stringify({ status: "BLOCKED_EXPECTED", templatesAttempted: templates.length, templatesPassed: 0, threeRunDeterminism: false, reason: "OFFICIAL_SMARTCHANNEL_FONT_ASSETS_UNRESOLVED", failures: [] }, null, 2));
    process.exitCode = 0;
    process.exit(0);
  }

  for (let index = 0; index < templates.length; index += 1) {
    const failureCountBeforeTemplate = failures.length;
    const template = templates[index];
    const token = placementTokens.get(String(template.objectPlacementToken));
    if (!token) {
      failures.push(`${template.templateId}: missing placement token`);
      continue;
    }
    const fileName = `${String(index).padStart(3, "0")}-${template.templateId}.png`;
    await writeObjectAsset(path.join(inputRoot, fileName), token, template);
    const content = contentFor(template, metadata);
    const base = { ...template, content };
    const request = requestFor(base, fileName);
    const runs = [];
    const pixelFingerprints = [];
    const requestFingerprints = [];
    for (let run = 0; run < 3; run += 1) {
      const result = await renderOne(contracts, request);
      if (result.status !== "PASS" || !result.png || !result.pngDigest) {
        failures.push(`${template.templateId}: render ${run + 1} failed ${JSON.stringify(result.errors)}`);
        break;
      }
      if (result.report?.textRoles.some((role) => role.overflow)) failures.push(`${template.templateId}: text overflow`);
      if ((result.report?.fixedComponents.length ?? 0) !== expectedFixedCount(template)) failures.push(`${template.templateId}: fixed component count mismatch`);
      if (result.report?.object.placementToken !== template.objectPlacementToken) failures.push(`${template.templateId}: placement token mismatch`);
      if ((result.report?.fonts.length ?? 0) !== 4) failures.push(`${template.templateId}: runtime font set is incomplete`);
      const pngInfo = await sharp(result.png).metadata();
      if (pngInfo.width !== 750 || pngInfo.height !== template.height || pngInfo.format !== "png" || pngInfo.hasAlpha !== true) failures.push(`${template.templateId}: RGBA PNG dimensions/alpha mismatch`);
      runs.push(result.pngDigest);
      pixelFingerprints.push(result.pixelFingerprint);
      requestFingerprints.push(result.requestFingerprint);
    }
    if (runs.length === 3 && new Set(runs).size !== 1) failures.push(`${template.templateId}: three-run PNG digest is not deterministic`);
    if (pixelFingerprints.length === 3 && new Set(pixelFingerprints).size !== 1) failures.push(`${template.templateId}: three-run pixel fingerprint is not deterministic`);
    if (requestFingerprints.length === 3 && new Set(requestFingerprints).size !== 1) failures.push(`${template.templateId}: three-run request fingerprint is not deterministic`);
    if (runs.length === 3 && failures.length === failureCountBeforeTemplate) templatesPassed += 1;
    prepared.push({ template, token, objectPath: fileName, content });
  }

  const compactTemplate = prepared.find((entry) => entry.template.affordance === "APP_CTA" && entry.template.height === 160);
  const compact200Template = prepared.find((entry) => entry.template.affordance === "APP_CTA" && entry.template.height === 200);
  const app280Template = prepared.find((entry) => entry.template.affordance === "APP_CTA" && entry.template.height === 280);
  const compactRegistry = jsonObject(contracts.naverCtaOptions.compact160200);
  for (const entry of [compactTemplate, compact200Template]) {
    for (const label of compactRegistry.allowedLabels ?? []) {
      if (!entry) continue;
      const result = await renderOne(contracts, requestFor({ ...entry.template, content: entry.content }, entry.objectPath, label));
      if (result.status !== "PASS" || !result.pngDigest || (result.report?.fixedComponents.length ?? 0) !== 1) failures.push(`${entry.template.templateId}/${label}: compact CTA option failed ${JSON.stringify(result.errors)}`);
    }
  }
  const options280 = jsonArray(contracts.naverCtaOptions.options280);
  for (const option of options280) {
    if (!app280Template) break;
    const label = String(option.label);
    const result = await renderOne(contracts, requestFor({ ...app280Template.template, content: app280Template.content }, app280Template.objectPath, label));
    if (result.status !== "PASS" || !result.pngDigest || (result.report?.fixedComponents.length ?? 0) !== 2) failures.push(`${app280Template.template.templateId}/${label}: 280 CTA option failed ${JSON.stringify(result.errors)}`);
  }

  const result = {
    status: failures.length === 0 ? "PASS" : "FAIL",
    templatesAttempted: templates.length,
    templatesPassed,
    threeRunDeterminism: failures.length === 0,
    ctaOptionCoverage: {
      compact160: compactRegistry.allowedLabels?.length ?? 0,
      compact200: compactRegistry.allowedLabels?.length ?? 0,
      height280: options280.length,
    },
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
