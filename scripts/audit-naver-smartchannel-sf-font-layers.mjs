import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const metadata = JSON.parse(readFileSync(path.join(root, "contracts/naver-smartchannel-psd-metadata.json"), "utf8"));
const sourceRevision = JSON.parse(readFileSync(path.join(root, "contracts/naver-smartchannel-source-revision.json"), "utf8"));
const expected = new Map([
  ["SFProDisplay-Bold", 56],
  ["SFUIDisplay-Bold", 64],
]);

function isGuideLayer(layer) {
  const text = `${layer.layerPath ?? ""}/${layer.name ?? ""}`;
  return layer.guideLayer === true || /^\*?GUIDE/iu.test(text) || /가이드|샘플 PSD|저장시/iu.test(text);
}

function effectiveVisibility(layer) {
  const ancestorVisible = Array.isArray(layer.ancestorVisibility) ? layer.ancestorVisibility.every((value) => value !== false) : layer.ancestorVisible !== false;
  const layerCompVisible = layer.layerCompVisible !== false;
  const clippingVisible = layer.clippingBaseVisible !== false;
  return layer.visible === true && ancestorVisible && layerCompVisible && clippingVisible;
}

function classify(rows) {
  const contributing = rows.filter((row) => row.compositeContribution);
  if (contributing.length > 0 && contributing.length === rows.length) return "EXPORT_CONTRIBUTING";
  if (contributing.length > 0) return "MIXED";
  if (rows.every((row) => row.guideLayer || row.guideSignal)) return "GUIDE_OR_INSTRUCTION";
  if (rows.every((row) => row.effectiveVisible === false && row.role === "HEADLINE")) return "HIDDEN_SOURCE_TEXT";
  if (rows.every((row) => row.effectiveVisible === false)) return "NON_EXPORT_REFERENCE";
  return "UNRESOLVED";
}

const fonts = [];
for (const [postScriptName, sourcePsdCount] of expected) {
  const rows = [];
  for (const template of metadata.templates ?? []) {
    for (const layer of template.textLayers ?? []) {
      if (!(layer.fontNames ?? []).includes(postScriptName)) continue;
      const pathValue = String(layer.layerPath ?? "");
      const guideSignal = isGuideLayer(layer);
      const ancestorVisible = Array.isArray(layer.ancestorVisibility) ? layer.ancestorVisibility.every((value) => value !== false) : layer.ancestorVisible !== false;
      const layerCompVisible = layer.layerCompVisible !== false;
      const clippingBaseVisible = layer.clippingBaseVisible !== false;
      const effectiveVisible = effectiveVisibility(layer);
      const compositeContribution = effectiveVisible && !guideSignal && Number(layer.opacity ?? 255) > 0 && Number(layer.fillOpacity ?? 255) > 0;
      rows.push({
        templateId: template.templateId,
        layerId: layer.layerId,
        layerName: layer.name,
        parentGroup: pathValue.split("/")[0] ?? "",
        layerPath: pathValue,
        visible: layer.visible === true,
        ancestorVisible,
        layerCompVisible,
        clippingBaseVisible,
        effectiveVisible,
        compositeContribution,
        guideLayer: layer.guideLayer === true,
        guideSignal,
        role: layer.role ?? null,
        text: layer.text ?? "",
        typographyTokenId: layer.typographyTokenId ?? null,
        finalTemplateOutputIncluded: compositeContribution,
      });
    }
  }
  const classification = classify(rows);
  fonts.push({
    postScriptName,
    sourcePsdCount,
    textLayerCount: rows.length,
    visibleLayerCount: rows.filter((row) => row.visible).length,
    guideLayerCount: rows.filter((row) => row.guideSignal).length,
    parentGroups: [...new Set(rows.map((row) => row.parentGroup))].sort(),
    roles: [...new Set(rows.map((row) => row.role))].sort(),
    classification,
    effectiveVisibility: {
      visibleLayerCount: rows.filter((row) => row.effectiveVisible).length,
      compositeContributionCount: rows.filter((row) => row.compositeContribution).length,
      hiddenSourceTextCount: rows.filter((row) => row.effectiveVisible === false && !row.guideSignal).length,
    },
    outputInclusion: {
      defaultVisibleLayerCount: rows.filter((row) => row.finalTemplateOutputIncluded).length,
      sourceSelectableHiddenVariantCount: rows.filter((row) => !row.visible && !row.guideSignal).length,
      guideOnlyNonExport: classification === "GUIDE_OR_INSTRUCTION",
      nonExport: ["HIDDEN_SOURCE_TEXT", "GUIDE_OR_INSTRUCTION", "NON_EXPORT_REFERENCE"].includes(classification),
    },
    layers: rows,
  });
}

const sfFontsAreNonExport = fonts.every((font) => ["HIDDEN_SOURCE_TEXT", "GUIDE_OR_INSTRUCTION", "NON_EXPORT_REFERENCE"].includes(font.classification));
const audit = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-sf-font-audit-v1.1.0.json",
  registryVersion: "1.1.0",
  status: "SOURCE_AUDITED",
  sourceMetadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  sourceRevision: sourceRevision.sourceRevision,
  requiredFontsAudited: [...expected.keys()],
  fonts,
  runtimeDecision: sfFontsAreNonExport ? "SF_SOURCE_ONLY_NON_RUNTIME" : "SF_EXACT_RUNTIME_REQUIRED",
  sourceOnlyNonRuntime: sfFontsAreNonExport ? [...expected.keys()] : [],
  exportContributingFonts: fonts.filter((font) => font.effectiveVisibility.compositeContributionCount > 0).map((font) => font.postScriptName),
  classificationRule: "effective visibility is layer visibility AND ancestor visibility AND layer-comp visibility AND clipping-base visibility; only effective visible non-guide opaque text contributes to the final composite",
};
writeFileSync(path.join(root, "contracts/naver-smartchannel-sf-font-audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: audit.status, classifications: Object.fromEntries(fonts.map((font) => [font.postScriptName, font.classification])), runtimeDecision: audit.runtimeDecision }));
