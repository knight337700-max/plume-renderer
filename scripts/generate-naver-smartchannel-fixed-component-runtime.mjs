import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function templatesFor(templates, predicate) {
  return templates.filter(predicate).map((entry) => entry.templateId).sort((left, right) => left.localeCompare(right, "en"));
}

function boundsFromPixels(bounds) {
  if (!Array.isArray(bounds) || bounds.length < 4) return null;
  const [x1, y1, x2, y2] = bounds.map(Number);
  if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function resourceId(prefix, assetPath) {
  const stem = path.basename(assetPath, path.extname(assetPath));
  return `${prefix}_${stem.replace(/[^A-Za-z0-9]+/gu, "_").toUpperCase()}`;
}

const fixed = await readJson("contracts/naver-smartchannel-fixed-components.json");
const cta = await readJson("contracts/naver-smartchannel-cta-options.json");
const templateContract = await readJson("contracts/naver-smartchannel-template-contract.json");
const templates = templateContract.templates ?? [];
const resources = [];

function addResource(resource) {
  resources.push({
    id: resource.id,
    scope: resource.scope,
    componentFamily: resource.componentFamily,
    sourceProvenance: resource.sourceProvenance,
    expectedSha256: resource.expectedSha256,
    sourcePath: resource.sourcePath,
    runtimePath: resource.runtimePath,
    packagedRequired: true,
    templates: [...new Set(resource.templates)].sort((left, right) => left.localeCompare(right, "en")),
    expectedRenderBounds: resource.expectedRenderBounds,
    ...(resource.labels ? { labels: [...new Set(resource.labels)] } : {}),
    assetFormat: "RGBA_PNG",
  });
}

const compact = fixed.components.find((entry) => entry.id === "LANDING_ICON_COMPACT");
const compactAsset = compact?.asset;
addResource({
  id: "LANDING_ICON_COMPACT",
  scope: "SMARTCHANNEL_LANDING_ICON",
  componentFamily: "LANDING_ICON_COMPACT",
  sourceProvenance: "contracts/naver-smartchannel-fixed-components.json#/components/LANDING_ICON_COMPACT",
  expectedSha256: compactAsset?.assetPngSha256,
  sourcePath: compactAsset?.assetPath,
  runtimePath: compactAsset?.assetPath,
  templates: templatesFor(templates, (entry) => entry.affordance === "LANDING_ICON" && entry.height !== 280),
  expectedRenderBounds: Object.fromEntries(Object.entries(compact?.heightPlacements ?? {}).map(([height, placement]) => [height, {
    x: Number(placement.x), y: Number(placement.y), width: Number(placement.width), height: Number(placement.height),
  }])),
});

const landing280 = fixed.components.find((entry) => entry.id === "LANDING_ICON_280");
const landing280Asset = landing280?.asset;
addResource({
  id: "LANDING_ICON_280",
  scope: "SMARTCHANNEL_LANDING_ICON",
  componentFamily: "LANDING_ICON_280",
  sourceProvenance: "contracts/naver-smartchannel-fixed-components.json#/components/LANDING_ICON_280",
  expectedSha256: landing280Asset?.assetPngSha256,
  sourcePath: landing280Asset?.assetPath,
  runtimePath: landing280Asset?.assetPath,
  templates: templatesFor(templates, (entry) => entry.affordance === "LANDING_ICON" && entry.height === 280),
  expectedRenderBounds: { default: {
    x: Number(landing280?.placement?.x), y: Number(landing280?.placement?.y), width: Number(landing280?.placement?.width), height: Number(landing280?.placement?.height),
  } },
});

const compactCtaTemplates = templatesFor(templates, (entry) => entry.affordance === "APP_CTA" && entry.height !== 280);
for (const [label, asset] of Object.entries(cta.compact160200?.labelAssets ?? {})) {
  const bounds = boundsFromPixels(asset.sourcePixelBounds);
  const expectedRenderBounds = Object.fromEntries(compactCtaTemplates.map((templateId) => {
    const template = templates.find((entry) => entry.templateId === templateId);
    const y = cta.compact160200.placements[String(template.height)].y;
    return [templateId, { x: bounds.x, y: Number(y), width: bounds.width, height: bounds.height }];
  }));
  addResource({
    id: resourceId("APP_CTA_COMPACT_LABEL", asset.assetPath),
    scope: "SMARTCHANNEL_APP_CTA_COMPACT",
    componentFamily: "APP_CTA_160_200",
    sourceProvenance: `contracts/naver-smartchannel-cta-options.json#/compact160200/labelAssets/${label}`,
    expectedSha256: asset.assetPngSha256,
    sourcePath: asset.assetPath,
    runtimePath: asset.assetPath,
    templates: compactCtaTemplates,
    expectedRenderBounds,
    labels: [label],
  });
}

const compactChevron = cta.compact160200?.chevron;
if (compactChevron?.assetPath) {
  const bounds = boundsFromPixels(compactChevron.sourcePixelBounds);
  const expectedRenderBounds = Object.fromEntries(Object.entries(cta.compact160200.placements ?? {}).map(([height, placement]) => [height, {
    x: bounds.x, y: bounds.y + Number(placement.y) - Number(cta.compact160200.placements["160"].y), width: bounds.width, height: bounds.height,
  }]));
  addResource({
    id: "APP_CTA_COMPACT_CHEVRON",
    scope: "SMARTCHANNEL_APP_CTA_COMPACT",
    componentFamily: "APP_CTA_160_200",
    sourceProvenance: "contracts/naver-smartchannel-cta-options.json#/compact160200/chevron",
    expectedSha256: compactChevron.assetPngSha256,
    sourcePath: compactChevron.assetPath,
    runtimePath: compactChevron.assetPath,
    templates: compactCtaTemplates,
    expectedRenderBounds,
  });
}

for (const option of cta.options280 ?? []) {
  const occurrences = option.sourceOccurrences ?? [];
  const first = occurrences[0];
  const asset = first?.button?.asset;
  if (!asset?.assetPath) continue;
  const expectedRenderBounds = Object.fromEntries(occurrences.map((occurrence) => [occurrence.templateId, boundsFromPixels(occurrence.button.visibleBounds)]));
  addResource({
    id: resourceId("APP_CTA_280_BUTTON", asset.assetPath),
    scope: "SMARTCHANNEL_APP_CTA_280",
    componentFamily: "APP_CTA_280",
    sourceProvenance: `contracts/naver-smartchannel-cta-options.json#/options280/${option.id}/button`,
    expectedSha256: asset.assetPngSha256,
    sourcePath: asset.assetPath,
    runtimePath: asset.assetPath,
    templates: occurrences.map((occurrence) => occurrence.templateId),
    expectedRenderBounds,
    labels: [option.label],
  });
}

const chevron280 = cta.chevron280;
if (chevron280?.assetPath) {
  const expectedRenderBounds = Object.fromEntries((cta.options280 ?? []).flatMap((option) => option.sourceOccurrences ?? []).map((occurrence) => [occurrence.templateId, boundsFromPixels(occurrence.chevron?.visibleBounds ?? chevron280.visibleBounds)]));
  addResource({
    id: "APP_CTA_280_CHEVRON",
    scope: "SMARTCHANNEL_APP_CTA_280",
    componentFamily: "APP_CTA_280",
    sourceProvenance: "contracts/naver-smartchannel-cta-options.json#/chevron280",
    expectedSha256: chevron280.assetPngSha256,
    sourcePath: chevron280.assetPath,
    runtimePath: chevron280.assetPath,
    templates: Object.keys(expectedRenderBounds),
    expectedRenderBounds,
  });
}

const families = [
  { id: "LANDING_ICON_COMPACT", scope: "SMARTCHANNEL_LANDING_ICON", resourceIds: resources.filter((entry) => entry.componentFamily === "LANDING_ICON_COMPACT").map((entry) => entry.id) },
  { id: "LANDING_ICON_280", scope: "SMARTCHANNEL_LANDING_ICON", resourceIds: resources.filter((entry) => entry.componentFamily === "LANDING_ICON_280").map((entry) => entry.id) },
  { id: "APP_CTA_160_200", scope: "SMARTCHANNEL_APP_CTA_COMPACT", resourceIds: resources.filter((entry) => entry.componentFamily === "APP_CTA_160_200").map((entry) => entry.id) },
  { id: "APP_CTA_280", scope: "SMARTCHANNEL_APP_CTA_280", resourceIds: resources.filter((entry) => entry.componentFamily === "APP_CTA_280").map((entry) => entry.id) },
].map((family) => ({ ...family, resourceCount: family.resourceIds.length, status: "FROZEN", packagedRequired: true }));

const registry = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://kbr.local/contracts/naver-smartchannel-fixed-component-runtime-v1.0.0.json",
  registryVersion: "1.0.0",
  status: "FROZEN",
  sourceContractRefs: ["contracts/naver-smartchannel-fixed-components.json", "contracts/naver-smartchannel-cta-options.json", "contracts/naver-smartchannel-template-contract.json"],
  componentFamilies: families,
  resources,
  inventory: {
    registered: resources.length,
    sourceAssetsRequired: resources.length,
    runtimeAssetsRequired: resources.length,
    packagedAssetsRequired: resources.length,
    unresolved: 0,
  },
};

await writeFile(path.join(root, "contracts/naver-smartchannel-fixed-component-runtime.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", registered: resources.length, families: families.map((family) => ({ id: family.id, resourceCount: family.resourceCount })) }, null, 2));
