import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const templateContract = readJson("contracts/naver-smartchannel-template-contract.json");
const placement = readJson("contracts/naver-smartchannel-object-placement.json");
const typography = readJson("contracts/naver-smartchannel-typography.json");
const metadata = readJson("contracts/naver-smartchannel-psd-metadata.json");
const fixed = readJson("contracts/naver-smartchannel-fixed-components.json");
const cta = readJson("contracts/naver-smartchannel-cta-options.json");
const compatibility = readJson("contracts/naver-smartchannel-font-compatibility.json");
const runtimeStatus = readJson("contracts/naver-smartchannel-n3-runtime-status.json");

const templates = templateContract.templates ?? [];
const mappings = placement.templateMappings ?? [];
const tokens = placement.tokens ?? [];
const metadataById = new Map((metadata.templates ?? []).map((entry) => [entry.templateId, entry]));
const tokenById = new Map(tokens.map((entry) => [entry.token, entry]));
const typographyIds = new Set((typography.tokens ?? []).map((entry) => entry.id));
const fixedById = new Map((fixed.components ?? []).map((entry) => [entry.id, entry]));

const expectedCounts = {
  "160/BASIC": 8,
  "160/EMPHASIS": 15,
  "160/BOTTOM_DISCLOSURE": 9,
  "200/BASIC": 8,
  "200/EMPHASIS": 15,
  "200/BOTTOM_DISCLOSURE": 9,
  "280/BASIC": 16,
  "280/EMPHASIS": 25,
  "280/BOTTOM_DISCLOSURE": 15,
};
const counts = Object.fromEntries(Object.keys(expectedCounts).map((key) => [key, 0]));
const byAffordance = { NONE: 0, LANDING_ICON: 0, APP_CTA: 0 };
const roleNames = new Set(["HEADLINE", "SUBCOPY", "DISCLOSURE"]);

expect(templateContract.sourceCatalog?.catalogStatus === "SOURCE_CATALOG_COMPLETE", "source catalog is not complete");
expect(runtimeStatus.phase === "N3_SMARTCHANNEL_120_VARIANT_EXPANSION" && runtimeStatus.status === "IMPLEMENTED" && runtimeStatus.sourceWhitelistOnly === true, "N3 runtime status is not implemented/source-whitelist-only");
expect(runtimeStatus.contractKnownTemplates === 120 && runtimeStatus.runtimeEnabledTemplates === 120 && runtimeStatus.disabledKnownTemplates === 0, "N3 runtime enablement status is not 120/120/0");
expect(runtimeStatus.objectPlacementTokens === 39 && runtimeStatus.templateMappings === 120 && runtimeStatus.fontFallbacks === 0 && runtimeStatus.placementFallbacks === 0, "N3 runtime status has unresolved fallback counts");
expect(templateContract.sourceCatalog?.sourcePsdCount === 120 && templateContract.sourceCatalog?.actualPsdCount === 120, "source PSD inventory is not 120/120");
expect(templates.length === 120, `expected 120 source templates, got ${templates.length}`);
expect(new Set(templates.map((entry) => entry.templateId)).size === templates.length, "template IDs are not unique");
expect(new Set(mappings.map((entry) => entry.templateId)).size === mappings.length && mappings.length === 120, "template placement mapping is not a unique 120-entry set");
expect(tokens.length === 39 && tokens.every((entry) => entry.runtimeEnabled === true), "all 39 placement tokens must be runtime-enabled");
expect(metadataById.size === 120, "PSD metadata is not complete for all 120 templates");
expect(typographyIds.size === 25, "typography token inventory is not 25");
expect((compatibility.fonts ?? []).length === 4, "runtime font compatibility inventory is not four local fonts");

for (const template of templates) {
  const key = `${template.height}/${template.family}`;
  counts[key] = (counts[key] ?? 0) + 1;
  byAffordance[template.affordance] = (byAffordance[template.affordance] ?? 0) + 1;
  expect(tokenById.has(template.objectPlacementToken), `${template.templateId} references an unknown object placement token`);
  const mapping = mappings.find((entry) => entry.templateId === template.templateId);
  expect(mapping?.objectPlacementToken === template.objectPlacementToken, `${template.templateId} placement mapping disagrees with source template`);
  const source = template.source ?? {};
  expect(source.classification === "SOURCE_CONFIRMED" && typeof source.sha256 === "string", `${template.templateId} is not source-confirmed`);

  const metadataTemplate = metadataById.get(template.templateId);
  const visibleTextLayers = (metadataTemplate?.textLayers ?? []).filter((layer) => layer.visible !== false && roleNames.has(layer.role));
  expect(visibleTextLayers.length > 0 && visibleTextLayers.every((layer) => typeof layer.typographyTokenId === "string" && typographyIds.has(layer.typographyTokenId)), `${template.templateId} has an unresolved visible typography token`);
  const roleCounts = Object.fromEntries([...roleNames].map((role) => [role, visibleTextLayers.filter((layer) => layer.role === role).length]));
  expect(Object.values(roleCounts).every((count) => count <= 2), `${template.templateId} has an unsupported text-role multiplicity`);

  if (template.affordance === "LANDING_ICON") {
    expect(fixedById.has(template.height === 280 ? "LANDING_ICON_280" : "LANDING_ICON_COMPACT"), `${template.templateId} has no approved landing icon component`);
  }
  if (template.affordance === "APP_CTA") {
    if (template.height === 280) {
      const occurrenceCounts = (cta.options280 ?? []).map((option) => (option.sourceOccurrences ?? []).filter((occurrence) => occurrence.templateId === template.templateId).length);
      expect(occurrenceCounts.length === 11 && occurrenceCounts.every((count) => count === 1), `${template.templateId} does not have one exact occurrence for all 11 280 CTA labels`);
      expect(visibleTextLayers.length > 0, `${template.templateId} has no visible source text roles beside CTA`);
    } else {
      expect((cta.compact160200?.allowedLabels ?? []).length === 11, `compact CTA registry does not contain 11 labels for ${template.templateId}`);
      expect(Object.keys(cta.compact160200?.labelAssets ?? {}).length === 11, `compact CTA raster asset inventory is incomplete for ${template.templateId}`);
    }
  }
}

for (const [key, expected] of Object.entries(expectedCounts)) expect(counts[key] === expected, `${key} source count expected ${expected}, got ${counts[key]}`);
expect(JSON.stringify(byAffordance) === JSON.stringify({ NONE: 75, LANDING_ICON: 29, APP_CTA: 16 }), `affordance inventory mismatch: ${JSON.stringify(byAffordance)}`);

const assetRefs = [];
for (const component of fixed.components ?? []) {
  if (component.asset?.assetPath) assetRefs.push(component.asset);
}
for (const asset of Object.values(cta.compact160200?.labelAssets ?? {})) assetRefs.push(asset);
if (cta.compact160200?.chevron?.assetPath) assetRefs.push(cta.compact160200.chevron);
for (const option of cta.options280 ?? []) for (const occurrence of option.sourceOccurrences ?? []) {
  if (occurrence.button?.asset?.assetPath) assetRefs.push(occurrence.button.asset);
  if (occurrence.chevron?.asset?.assetPath) assetRefs.push(occurrence.chevron.asset);
}
if (cta.chevron280?.assetPath) assetRefs.push(cta.chevron280);
for (const asset of assetRefs) {
  const assetPath = path.join(root, asset.assetPath);
  expect(fs.existsSync(assetPath), `missing approved Naver fixed asset ${asset.assetPath}`);
  if (fs.existsSync(assetPath) && asset.assetPngSha256) expect(sha256(assetPath) === asset.assetPngSha256, `approved Naver fixed asset digest mismatch ${asset.assetPath}`);
}

const result = {
  status: failures.length === 0 ? "PASS" : "FAIL",
  sourceWhitelistTemplates: templates.length,
  placementTokens: tokens.length,
  mappedTemplates: mappings.length,
  counts,
  affordances: byAffordance,
  ctaLabels: {
    compact160200: cta.compact160200?.allowedLabels?.length ?? 0,
    options280: cta.options280?.length ?? 0,
  },
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
