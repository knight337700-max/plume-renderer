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

function classify(rows) {
  const guide = rows.filter((row) => row.guideLayer || row.guideSignal);
  const exportRows = rows.filter((row) => !row.guideLayer && !row.guideSignal && row.parentGroup.trim().startsWith("TEXT") && row.role === "HEADLINE");
  if (guide.length === rows.length) return "GUIDE_ONLY_NON_EXPORT";
  if (exportRows.length === rows.length) return "EXPORT_RENDERED_TEXT";
  return "MIXED";
}

const fonts = [];
for (const [postScriptName, sourcePsdCount] of expected) {
  const rows = [];
  for (const template of metadata.templates ?? []) {
    for (const layer of template.textLayers ?? []) {
      if (!(layer.fontNames ?? []).includes(postScriptName)) continue;
      const pathValue = String(layer.layerPath ?? "");
      const guideSignal = isGuideLayer(layer);
      rows.push({
        templateId: template.templateId,
        layerId: layer.layerId,
        layerName: layer.name,
        parentGroup: pathValue.split("/")[0] ?? "",
        layerPath: pathValue,
        visible: layer.visible === true,
        guideLayer: layer.guideLayer === true,
        guideSignal,
        role: layer.role ?? null,
        text: layer.text ?? "",
        typographyTokenId: layer.typographyTokenId ?? null,
        finalTemplateOutputIncluded: layer.visible === true && !guideSignal,
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
    outputInclusion: {
      defaultVisibleLayerCount: rows.filter((row) => row.finalTemplateOutputIncluded).length,
      sourceSelectableHiddenVariantCount: rows.filter((row) => !row.visible && !row.guideSignal).length,
      guideOnlyNonExport: classification === "GUIDE_ONLY_NON_EXPORT",
    },
    layers: rows,
  });
}

const sfFontsAreGuideOnly = fonts.every((font) => font.classification === "GUIDE_ONLY_NON_EXPORT");
const audit = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kbr.local/contracts/naver-smartchannel-sf-font-audit-v1.0.0.json",
  registryVersion: "1.0.0",
  status: "SOURCE_AUDITED",
  sourceMetadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  sourceRevision: sourceRevision.sourceRevision,
  requiredFontsAudited: [...expected.keys()],
  fonts,
  runtimeDecision: sfFontsAreGuideOnly ? "SF_SOURCE_ONLY_NON_RUNTIME" : "SF_EXACT_RUNTIME_REQUIRED",
  sourceOnlyNonRuntime: sfFontsAreGuideOnly ? [...expected.keys()] : [],
  classificationRule: "TEXT parent + HEADLINE role + non-guide is treated as an export-capable source text variant even when hidden in the default PSD view",
};
writeFileSync(path.join(root, "contracts/naver-smartchannel-sf-font-audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: audit.status, classifications: Object.fromEntries(fonts.map((font) => [font.postScriptName, font.classification])), runtimeDecision: audit.runtimeDecision }));
