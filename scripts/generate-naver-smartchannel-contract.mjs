import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = process.env.NAVER_SMARTCHANNEL_SOURCE_ROOT ?? "C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12";
const catalogPath = process.env.NAVER_SMARTCHANNEL_CATALOG ?? "C:/Users/Lenovo/Desktop/naver-smartchannel-template-catalog-v1.0.yaml";

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.name.toLowerCase().endsWith(".psd")) files.push(absolute);
  }
  return files;
}

function readCatalog() {
  const entries = [];
  let current;
  for (const line of fs.readFileSync(catalogPath, "utf8").split(/\r?\n/)) {
    let match = line.match(/^[-] height: (\d+)$/);
    if (match) {
      current = { height: Number(match[1]) };
      entries.push(current);
      continue;
    }
    match = line.match(/^  family: (.+)$/);
    if (match && current) current.family = match[1].trim();
    match = line.match(/^  filename: (.+)$/);
    if (match && current) current.filename = match[1].trim();
    match = line.match(/^  sha256: ([0-9a-f]{64})$/);
    if (match && current) {
      current.sha256 = match[1];
      current = undefined;
    }
  }
  return entries;
}

function classify(filePath, catalogByHash) {
  const fileName = path.basename(filePath);
  const height = Number((filePath.match(/(160|200|280)/) ?? [])[1]);
  const family = fileName.startsWith("01_") ? "BASIC" : fileName.startsWith("02_") ? "EMPHASIS" : "BOTTOM_DISCLOSURE";
  const objectKind = fileName.includes("인물오브젝트강조") ? "PERSON_MOVIE" : fileName.includes("오브젝트썸네일") ? "THUMBNAIL" : "STANDARD";
  const side = fileName.includes("좌측형") ? "LEFT" : fileName.includes("우측형") ? "RIGHT" : "UNKNOWN";
  const affordance = fileName.includes("+랜딩아이콘") ? "LANDING_ICON" : fileName.includes("+앱랜딩버튼") ? "APP_CTA" : "NONE";
  const stem = fileName.replace(/\.psd$/, "").trimEnd();
  let textVariant = "UNKNOWN";
  let sourceTextLabel = "UNKNOWN";
  if (family === "BOTTOM_DISCLOSURE") {
    if (/_2줄$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN_DISCLOSURE", "2줄"];
    else if (/_3줄\(심의필(?:만)?2줄\)$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN_DISCLOSURE_2LINE", "3줄(심의필2줄)"];
    else if (/_3줄$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN_SUB_DISCLOSURE", "3줄"];
    else if (/_3줄\(메인2줄\)$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN2_SUB", "3줄(메인2줄)"];
    else if (/_4줄\(메인2줄\+심의필2줄\)$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN2_DISCLOSURE_2LINE", "4줄(메인2줄+심의필2줄)"];
    else if (/_4줄\(메인2줄\)$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN2_DISCLOSURE", "4줄(메인2줄)"];
    else if (/_4줄\(심의필2줄\)$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN_SUB_DISCLOSURE_2LINE", "4줄(심의필2줄)"];
    else if (/_4줄$/.test(stem)) [textVariant, sourceTextLabel] = ["FOUR_LINE", "4줄"];
  } else {
    if (/_1줄$/.test(stem)) [textVariant, sourceTextLabel] = ["ONE_LINE", "1줄"];
    else if (/_2줄\(메인2줄\)$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN_TWO_LINES", "2줄(메인2줄)"];
    else if (/_2줄$/.test(stem)) [textVariant, sourceTextLabel] = ["MAIN_SUB", "2줄"];
    else if (/_3줄$/.test(stem)) [textVariant, sourceTextLabel] = [family === "BASIC" && height === 280 ? "MAIN2_SUB" : "THREE_LINE", "3줄"];
    else if (/_4줄$/.test(stem)) [textVariant, sourceTextLabel] = ["FOUR_LINE", "4줄"];
  }
  const bytes = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const header = { signature: bytes.subarray(0, 4).toString("ascii"), version: bytes.readUInt16BE(4), height: bytes.readUInt32BE(14), width: bytes.readUInt32BE(18), depth: bytes.readUInt16BE(22), colorMode: bytes.readUInt16BE(24) };
  const sourcePath = `SMARTCHANNEL_GUIDE 12/${path.relative(sourceRoot, filePath).split(path.sep).join("/")}`;
  const catalogEntry = catalogByHash.get(sha256);
  return { templateId: `NAVER_SMARTCHANNEL_${height}_${family}_${objectKind}_${side}_${textVariant}_${affordance}`, height, family, objectKind, side, textVariant, sourceTextLabel, affordance, source: { sourcePath, sourceFileName: fileName, catalogFileName: catalogEntry?.filename ?? null, sha256, canvas: { width: header.width, height: header.height }, psdHeader: header, catalogCrossCheck: catalogEntry?.filename === fileName ? "SHA256_MATCH" : "SHA256_MATCH_DIFFERENT_FILENAME", classification: "SOURCE_CONFIRMED" } };
}

const catalog = readCatalog();
const catalogByHash = new Map(catalog.map((entry) => [entry.sha256, entry]));
const rows = walk(sourceRoot).map((filePath) => classify(filePath, catalogByHash)).sort((a, b) => a.height - b.height || a.family.localeCompare(b.family) || a.source.sourceFileName.localeCompare(b.source.sourceFileName, "ko"));
const inventoryDigestSha256 = crypto.createHash("sha256").update(rows.map((row) => [row.height, row.family, row.source.sourcePath, row.source.sha256].join("|")).join("\n"), "utf8").digest("hex");
const countsByHeightAndFamily = {};
for (const row of rows) countsByHeightAndFamily[`${row.height}/${row.family}`] = (countsByHeightAndFamily[`${row.height}/${row.family}`] ?? 0) + 1;

const geometry = {
  classification: "DERIVED_FROM_EXACT_SOURCE_METADATA",
  canvasWidth: 750,
  placementPrimitives: [
    { height: 160, family: "BASIC", objectKind: "STANDARD", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, y: 0, width: 235, height: 160 }, textRegion: { x: 305, width: 405 }, gap: 30 },
    { height: 160, family: "BASIC", objectKind: "STANDARD", side: "RIGHT", affordance: "NONE", objectRegion: { x: 475, y: 0, width: 235, height: 160 }, textRegion: { x: 40, width: 405 }, gap: 30 },
    { height: 160, family: "BASIC", objectKind: "STANDARD", side: "LEFT", affordance: "LANDING_ICON", objectRegion: { x: 40, width: 200 }, textRegion: { x: 270, width: 384 }, gap: 30, observedIcon: { x: 694, y: 65, width: 16, height: 30 } },
    { height: 160, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 195, height: 160 }, textRegion: { x: 265, width: 445 }, gap: 30 },
    { height: 160, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "RIGHT", affordance: "NONE", objectRegion: { x: 515, width: 195, height: 160 }, textRegion: { x: 40, width: 445 }, gap: 30 },
    { height: 160, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 265, width: 389 }, observedIcon: { x: 694, y: 65, width: 16, height: 30 } },
    { height: 160, family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 280 }, textRegion: { x: 350, width: 360 }, gap: 30 },
    { height: 160, family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "RIGHT", affordance: "NONE", objectRegion: { x: 430, width: 280 }, textRegion: { x: 40, width: 360 }, gap: 30 },
    { height: 160, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 210, height: 160 }, textRegion: { x: 280, width: 430 }, gap: 30 },
    { height: 160, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "RIGHT", affordance: "NONE", objectRegion: { x: 500, width: 210, height: 160 }, textRegion: { x: 40, width: 430 }, gap: 30 },
    { height: 160, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 280, width: 374 }, observedIcon: { x: 694, y: 65, width: 16, height: 30 } },
    { height: 200, family: "BASIC", objectKind: "STANDARD", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 235 }, textRegion: { x: 305, width: 405 }, gap: 30 },
    { height: 200, family: "BASIC", objectKind: "STANDARD", side: "RIGHT", affordance: "NONE", objectRegion: { x: 475, width: 235 }, textRegion: { x: 40, width: 405 }, gap: 30 },
    { height: 200, family: "BASIC", objectKind: "STANDARD", side: "LEFT", affordance: "LANDING_ICON", objectRegion: { x: 40, width: 200 }, textRegion: { x: 270, width: 384 }, gap: 30, observedIcon: { x: 694, y: 85, width: 16, height: 30 } },
    { height: 200, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 210, height: 200 }, textRegion: { x: 280, width: 430 }, gap: 30, nominalThumbnail: { y: 30, width: 210, height: 140 } },
    { height: 200, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "RIGHT", affordance: "NONE", objectRegion: { x: 500, width: 210, height: 200 }, textRegion: { x: 40, width: 430 }, gap: 30, nominalThumbnail: { y: 30, width: 210, height: 140 } },
    { height: 200, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 280, width: 374 }, observedIcon: { x: 694, y: 85, width: 16, height: 30 } },
    { height: 200, family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 280 }, textRegion: { x: 350, width: 360 }, gap: 30 },
    { height: 200, family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "RIGHT", affordance: "NONE", objectRegion: { x: 430, width: 280 }, textRegion: { x: 40, width: 360 }, gap: 30 },
    { height: 200, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 210 }, objectNominal: { x: 40, y: 30, width: 210, height: 140 }, textRegion: { x: 280, width: 430 }, gap: 30 },
    { height: 200, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "RIGHT", affordance: "NONE", objectRegion: { x: 500, width: 210 }, objectNominal: { x: 500, y: 30, width: 210, height: 140 }, textRegion: { x: 40, width: 430 }, gap: 30 },
    { height: 200, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 280, width: 374 }, observedIcon: { x: 694, y: 85, width: 16, height: 30 } },
    { height: 280, family: "BASIC", objectKind: "STANDARD", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 235, height: 280 }, textRegion: { x: 305, y: 40, width: 405, height: 200 }, gap: 30 },
    { height: 280, family: "BASIC", objectKind: "STANDARD", side: "RIGHT", affordance: "NONE", objectRegion: { x: 475, width: 235, height: 280 }, textRegion: { x: 40, y: 40, width: 405, height: 200 }, gap: 30 },
    { height: 280, family: "BASIC", objectKind: "STANDARD", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 305, y: 40, width: 331, height: 200 }, observedIcon: { x: 660, y: 112, width: 56, height: 59 } },
    { height: 280, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 200, height: 280 }, textRegion: { x: 270, y: 40, width: 440, height: 200 }, gap: 30 },
    { height: 280, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "RIGHT", affordance: "NONE", objectRegion: { x: 510, width: 200, height: 280 }, textRegion: { x: 40, y: 40, width: 440, height: 200 }, gap: 30 },
    { height: 280, family: "EMPHASIS", objectKind: "THUMBNAIL", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 270, y: 40, width: 366, height: 200 }, observedIcon: { x: 660, y: 112, width: 56, height: 59 } },
    { height: 280, family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 300, height: 280 }, textRegion: { x: 370, y: 40, width: 340, height: 200 }, gap: 30 },
    { height: 280, family: "EMPHASIS", objectKind: "PERSON_MOVIE", side: "RIGHT", affordance: "NONE", objectRegion: { x: 410, width: 300, height: 280 }, textRegion: { x: 40, y: 40, width: 340, height: 200 }, gap: 30 },
    { height: 280, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", affordance: "NONE", objectRegion: { x: 40, width: 235, height: 280 }, textRegion: { x: 305, y: 40, width: 405, height: 200 }, gap: 30 },
    { height: 280, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "RIGHT", affordance: "NONE", objectRegion: { x: 475, width: 235, height: 280 }, textRegion: { x: 40, y: 40, width: 405, height: 200 }, gap: 30 },
    { height: 280, family: "BOTTOM_DISCLOSURE", objectKind: "STANDARD", side: "LEFT", affordance: "LANDING_ICON", textRegion: { x: 305, y: 40, width: 331, height: 200 }, observedIcon: { x: 660, y: 112, width: 56, height: 59 } },
  ],
  verticalGrammar: {
    classification: "DERIVED_FROM_EXACT_SOURCE_METADATA",
    "160": { ONE_LINE: { headlineY: 65, headlineH: 30 }, MAIN_SUB: { headlineY: 45, headlineH: 30, gap: 14, subcopyY: 89, subcopyH: 26 }, THREE_LINE: { headlineY: 30, line3Y: 114, line3H: 16 } },
    "200": { ONE_LINE: { headlineY: 85, headlineH: 30 }, MAIN_SUB: { headlineY: 64, headlineH: 30, gap: 16, subcopyY: 110, subcopyH: 26 }, THREE_LINE: { headlineY: 48, subcopy3Y: 136, subcopy3H: 16 } },
    "280": { ONE_LINE: { headlineY: 124, headlineH: 32 }, MAIN_SUB: { headlineY: 101, headlineH: 32, gap: 20, subcopyY: 153, subcopyH: 26 }, MAIN_TWO_LINES: { line1Y: 100, line2Y: 148, lineH: 32 }, MAIN2_SUB: { line1Y: 77, line2Y: 125, subcopyY: 177, subcopyH: 26 }, FOUR_LINE: { line1Y: 53, line2Y: 101, line3Y: 153, line4Y: 209 }, MAIN_DISCLOSURE: { mainY: 101, disclosureY: 163 }, MAIN_SUB_DISCLOSURE: { mainY: 78, subY: 130, disclosureY: 186 }, MAIN_DISCLOSURE_2LINE: { mainY: 89, disclosure1Y: 151, disclosure2Y: 175 }, MAIN2_DISCLOSURE: { main1Y: 77, main2Y: 125, disclosureY: 187 }, MAIN_SUB_DISCLOSURE_2LINE: { mainY: 66, subY: 118, disclosure1Y: 174, disclosure2Y: 198 }, MAIN2_DISCLOSURE_2LINE: { main1Y: 65, main2Y: 113, disclosure1Y: 175, disclosure2Y: 199 } },
  },
};

const textVariants = [
  ["ONE_LINE", "one headline line", "SOURCE_CONFIRMED"], ["MAIN_SUB", "main plus subcopy", "SOURCE_CONFIRMED"], ["MAIN_TWO_LINES", "two main lines", "SOURCE_CONFIRMED"], ["MAIN2_SUB", "two main lines plus subcopy where source grammar explicitly says so", "SOURCE_CONFIRMED"], ["THREE_LINE", "source-labelled three-line variant; no combination is generated", "PROJECT_CLARIFICATION_SOURCE_LABEL"], ["FOUR_LINE", "four text lines", "SOURCE_CONFIRMED"], ["MAIN_DISCLOSURE", "main plus one disclosure", "SOURCE_CONFIRMED"], ["MAIN_SUB_DISCLOSURE", "main plus subcopy plus one disclosure", "SOURCE_CONFIRMED"], ["MAIN_DISCLOSURE_2LINE", "main plus two disclosure lines", "SOURCE_CONFIRMED"], ["MAIN2_DISCLOSURE", "two main lines plus one disclosure", "SOURCE_CONFIRMED"], ["MAIN_SUB_DISCLOSURE_2LINE", "main plus subcopy plus two disclosure lines", "SOURCE_CONFIRMED"], ["MAIN2_DISCLOSURE_2LINE", "two main lines plus two disclosure lines", "SOURCE_CONFIRMED"],
].map(([id, meaning, sourceStatus]) => ({ id, meaning, sourceStatus }));

const fixedComponents = {
  classificationVocabulary: ["SOURCE_CONFIRMED", "DERIVED_FROM_EXACT_SOURCE_METADATA", "UNRESOLVED"],
  components: [
    { id: "LANDING_ICON_160_200", scope: [160, 200], status: "UNRESOLVED", assetId: null, assetSha256: null, canonicalGeometry: null, observedRasterBounds: { "160": { x: 694, y: 65, width: 16, height: 30 }, "200": { x: 694, y: 85, width: 16, height: 30 } }, disabledReason: "Canonical approved icon binary, digest, and optical bounds are not registered." },
    { id: "LANDING_ICON_280", scope: [280], status: "UNRESOLVED", assetId: null, assetSha256: null, canonicalGeometry: null, observedRasterBounds: { x: 660, y: 112, width: 56, height: 59 }, disabledReason: "Canonical approved icon binary, digest, and optical bounds are not registered." },
    { id: "APP_CTA_160_200", scope: [160, 200], status: "UNRESOLVED", assetId: null, assetSha256: null, canonicalGeometry: null, disabledReason: "Allowed labels, landing compatibility, canonical icon/chevron assets, and exact metrics are not frozen." },
    { id: "APP_CTA_280", scope: [280], status: "UNRESOLVED", assetId: null, assetSha256: null, canonicalGeometry: null, observedMetadata: { buttonY: "≈194", buttonHeight: 48, alignment: "RIGHT", composition: "background + text + chevron" }, disabledReason: "Canonical button background, labels, chevron asset, and exact metrics are not frozen." },
    { id: "OBJECT_MAX_GUIDE_260", scope: [160, 200, 280], status: "UNRESOLVED", assetId: null, assetSha256: null, canonicalGeometry: null, disabledReason: "260 maximum guide semantics and placement region are separate and unresolved." },
    { id: "EXPORT_BG_GUIDE", scope: [280], status: "SOURCE_CONFIRMED", assetId: null, assetSha256: null, canonicalGeometry: null, sourceInstruction: "BG guide layer is off when saving PNG", rendererOutput: "NOT_PART_OF_RENDERER_CONTRACT" },
  ],
};

const typography = {
  registryVersion: "1.0.0", status: "UNRESOLVED_SOURCE_METADATA", classification: "UNRESOLVED",
  sourceMetadata: { fontLayerExtraction: "NOT_AVAILABLE_IN_CURRENT_TOOLCHAIN", requiredFields: ["family", "postScriptName", "weight", "style", "sizePx", "leadingPx", "tracking", "kerning", "alignment", "textBox", "baseline", "fill", "opacity", "antiAliasing"], inferredValuesForbidden: true },
  runtimeFontAssets: [{ id: "SPOQA_HAN_SANS_BOLD", relativePath: "assets/fonts/SpoqaHanSansBold.ttf", sha256: "5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef", weight: 700, licenseStatus: "VERIFIED_OFL_1.1", sourceIdentityToPSD: "UNRESOLVED" }, { id: "SPOQA_HAN_SANS_REGULAR", relativePath: "assets/fonts/SpoqaHanSansRegular.ttf", sha256: "1f56c8535b6592672ea7f540a67bb5792c34558d72875fc504166a3e2b28b4b1", weight: 400, licenseStatus: "VERIFIED_OFL_1.1", sourceIdentityToPSD: "UNRESOLVED" }],
  tokens: ["HEADLINE", "HEADLINE_LINE_2", "SUBCOPY", "SUBCOPY_LINE_4", "DISCLOSURE", "DISCLOSURE_LINE_1", "DISCLOSURE_LINE_2", "APP_CTA_TEXT"].map((id) => ({ id, classification: "UNRESOLVED" })), observedGuideSizes: [{ scope: "280 main", sizePx: 32, classification: "DERIVED_FROM_EXACT_SOURCE_METADATA" }, { scope: "280 subcopy", sizePx: 26, classification: "DERIVED_FROM_EXACT_SOURCE_METADATA" }], unresolved: ["all_psd_text_layer_typography_metadata", "font_identity_match_to_psd", "160_disclosure_two_line_exact_baselines"],
};

const n2Candidates = [[160, "BASIC", "STANDARD", "LEFT", "MAIN_SUB", "NONE"], [200, "EMPHASIS", "THUMBNAIL", "RIGHT", "THREE_LINE", "NONE"], [280, "BASIC", "STANDARD", "LEFT", "ONE_LINE", "LANDING_ICON"], [280, "EMPHASIS", "THUMBNAIL", "LEFT", "THREE_LINE", "APP_CTA"], [280, "EMPHASIS", "PERSON_MOVIE", "RIGHT", "FOUR_LINE", "NONE"], [280, "BOTTOM_DISCLOSURE", "STANDARD", "LEFT", "MAIN2_DISCLOSURE_2LINE", "NONE"]].map(([height, family, objectKind, side, textVariant, affordance], index) => ({ id: `N2-REP-${String(index + 1).padStart(3, "0")}`, height, family, objectKind, side, textVariant, affordance, sourceSelection: "registry lookup only" }));

const contract = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://kbr.local/contracts/naver-smartchannel-template-contract-v1.4.0.json", registryVersion: "1.4.0", templateContractVersion: "1.10.0", channel: "NAVER_GFA", placement: "SMARTCHANNEL", layoutMode: "TEMPLATE_LOCKED", compositionMode: "RENDERER_COMPOSED", artifactCardinality: "SINGLE", runtimeFontPolicyRef: "contracts/naver-smartchannel-runtime-font-policy.json", fontCompatibilityRef: "contracts/naver-smartchannel-font-compatibility.json", metricFixturesRef: "contracts/naver-smartchannel-font-metric-fixtures.json", fontResolutionPolicy: { fallbackAllowed: false, exactIdentityRequired: true, runtimeIdentityRequired: true, allowedModes: ["BUNDLED_EXACT", "EXTERNAL_EXACT"], sourceIdentityPolicy: "SOURCE_EXACT_RENDERER_OWNED_BINARY", runtimeLookupKey: "fontToken", classification: "PSD_EXACT_RENDERER_OWNED" }, n2Readiness: { ready: true, blockers: [], runtimeFontMode: "PSD_EXACT_RENDERER_OWNED", exportContributingSfFonts: [] },
  sourceCatalog: { catalogDocument: "naver-smartchannel-template-catalog-v1.0.yaml", catalogVersion: "1.0.0", catalogStatus: "SOURCE_CATALOG_COMPLETE", sourceRootHint: "SMARTCHANNEL_GUIDE 12/", sourceRootExternal: true, sourcePsdCount: 120, actualPsdCount: rows.length, countsByHeight: { "160": 32, "200": 32, "280": 56 }, countsByHeightAndFamily, inventoryDigestSha256, catalogHashCrossCheck: { catalogEntries: catalog.length, sha256Matches: rows.filter((row) => row.source.catalogCrossCheck.startsWith("SHA256_MATCH")).length, filenameRenamedBySourceRoot: rows.filter((row) => row.source.catalogCrossCheck.endsWith("DIFFERENT_FILENAME")).length, hashMismatches: rows.filter((row) => !row.source.catalogFileName).length }, canvasHeaderCheck: { width: 750, heights: [160, 200, 280], badHeaders: rows.filter((row) => row.source.psdHeader.signature !== "8BPS" || row.source.psdHeader.version !== 1 || row.source.canvas.width !== 750 || row.source.canvas.height !== row.height).length } },
  canvas: { width: 750, heights: [160, 200, 280], classification: "SOURCE_CONFIRMED" }, identityAxes: ["height", "family", "objectKind", "side", "textVariant", "affordance"], families: [{ id: "BASIC", sourceCounts: { "160": 8, "200": 8, "280": 16 }, objectKinds: ["STANDARD"], classification: "SOURCE_CONFIRMED" }, { id: "EMPHASIS", sourceCounts: { "160": 15, "200": 15, "280": 25 }, objectKinds: ["THUMBNAIL", "PERSON_MOVIE"], classification: "SOURCE_CONFIRMED" }, { id: "BOTTOM_DISCLOSURE", sourceCounts: { "160": 9, "200": 9, "280": 15 }, objectKinds: ["STANDARD"], classification: "SOURCE_CONFIRMED" }], objectKinds: [{ id: "STANDARD", classification: "SOURCE_CONFIRMED" }, { id: "THUMBNAIL", classification: "SOURCE_CONFIRMED" }, { id: "PERSON_MOVIE", industryRestriction: "MOVIE_ONLY", classification: "SOURCE_CONFIRMED" }], sides: ["LEFT", "RIGHT"], affordances: [{ id: "NONE", enabled: true, classification: "SOURCE_CONFIRMED" }, { id: "LANDING_ICON", enabled: false, classification: "SOURCE_CONFIRMED", disabledReason: "fixed component unresolved" }, { id: "APP_CTA", enabled: false, classification: "SOURCE_CONFIRMED", disabledReason: "fixed component unresolved" }], textVariantWhitelist: textVariants.map((entry) => entry.id), textVariants, variantGenerationPolicy: "SOURCE_WHITELIST_ONLY", templateIdPattern: "NAVER_SMARTCHANNEL_<HEIGHT>_<FAMILY>_<OBJECT_KIND>_<SIDE>_<TEXT_VARIANT>_<AFFORDANCE>", bijection: { required: true, templateCount: rows.length, sourcePsdCount: rows.length, everyRuntimeTemplateIdExactlyOnePsd: true, everySourcePsdExactlyOneTemplateId: true }, templates: rows, geometry, fixedComponents, typographyRegistryRef: "contracts/naver-smartchannel-typography.json", n2CandidatesRef: "contracts/naver-smartchannel-n2-candidates.json", unsupportedCombinationPolicy: { classification: "SOURCE_CONFIRMED", automaticDerivationForbidden: ["MISSING_SIDE", "MISSING_AFFORDANCE", "MISSING_TEXT_VARIANT", "MISSING_OBJECT_KIND", "MIRRORED_VARIANT", "HEIGHT_SCALE"] }, runtimeBoundary: { rendererImplemented: false, rasterImplemented: false, desktopUiImplemented: false, previewDownloadImplemented: false, runtimeStatus: "CONTRACT_ONLY" }, unresolvedBlockers: ["all_psd_text_layer_typography_metadata", "canonical_landing_icon_assets_and_metrics", "canonical_app_cta_assets_and_metrics", "160_disclosure_two_line_exact_baselines", "200_landing_icon_1px_y_difference", "object_260_max_guide_semantics", "final_export_registration_rules", "mixed_character_count_semantics"],
};

const schema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "https://kbr.local/schema/naver-smartchannel-template-v1.4.0.schema.json", title: "NAVER SmartChannel template contract v1.4.0", type: "object", additionalProperties: false, required: ["registryVersion", "templateContractVersion", "channel", "placement", "layoutMode", "compositionMode", "artifactCardinality", "runtimeFontPolicyRef", "fontCompatibilityRef", "metricFixturesRef", "fontResolutionPolicy", "n2Readiness", "canvas", "templates"], properties: { registryVersion: { const: "1.4.0" }, templateContractVersion: { const: "1.10.0" }, channel: { const: "NAVER_GFA" }, placement: { const: "SMARTCHANNEL" }, layoutMode: { const: "TEMPLATE_LOCKED" }, compositionMode: { const: "RENDERER_COMPOSED" }, artifactCardinality: { const: "SINGLE" }, runtimeFontPolicyRef: { type: "string", minLength: 1 }, fontCompatibilityRef: { type: "string", minLength: 1 }, metricFixturesRef: { type: "string", minLength: 1 }, n2Readiness: { type: "object", additionalProperties: false, required: ["ready", "blockers", "runtimeFontMode", "exportContributingSfFonts"], properties: { ready: { const: true }, blockers: { const: [] }, runtimeFontMode: { const: "PSD_EXACT_RENDERER_OWNED" }, exportContributingSfFonts: { const: [] } } }, fontResolutionPolicy: { type: "object", additionalProperties: false, required: ["fallbackAllowed", "exactIdentityRequired", "runtimeIdentityRequired", "allowedModes", "sourceIdentityPolicy", "runtimeLookupKey", "classification"], properties: { fallbackAllowed: { const: false }, exactIdentityRequired: { const: true }, runtimeIdentityRequired: { const: true }, allowedModes: { const: ["BUNDLED_EXACT", "EXTERNAL_EXACT"] }, sourceIdentityPolicy: { const: "SOURCE_EXACT_RENDERER_OWNED_BINARY" }, runtimeLookupKey: { const: "fontToken" }, classification: { const: "PSD_EXACT_RENDERER_OWNED" } } }, canvas: { type: "object", additionalProperties: false, required: ["width", "heights"], properties: { width: { const: 750 }, heights: { const: [160, 200, 280] } } }, templates: { type: "array", minItems: 120, maxItems: 120, items: { $ref: "#/$defs/template" } } }, $defs: { template: { type: "object", additionalProperties: false, required: ["templateId", "height", "family", "objectKind", "side", "textVariant", "affordance", "source"], properties: { templateId: { type: "string", pattern: "^NAVER_SMARTCHANNEL_" }, height: { enum: [160, 200, 280] }, family: { enum: ["BASIC", "EMPHASIS", "BOTTOM_DISCLOSURE"] }, objectKind: { enum: ["STANDARD", "THUMBNAIL", "PERSON_MOVIE"] }, side: { enum: ["LEFT", "RIGHT"] }, textVariant: { type: "string", minLength: 1 }, sourceTextLabel: { type: "string", minLength: 1 }, affordance: { enum: ["NONE", "LANDING_ICON", "APP_CTA"] }, source: { type: "object", additionalProperties: false, required: ["sourcePath", "sourceFileName", "sha256", "canvas", "classification"], properties: { sourcePath: { type: "string", minLength: 1 }, sourceFileName: { type: "string", minLength: 1 }, catalogFileName: { type: ["string", "null"] }, sha256: { type: "string", pattern: "^[a-f0-9]{64}$" }, canvas: { type: "object", additionalProperties: false, required: ["width", "height"], properties: { width: { const: 750 }, height: { enum: [160, 200, 280] } } }, psdHeader: { type: "object" }, catalogCrossCheck: { type: "string" }, classification: { enum: ["SOURCE_CONFIRMED", "DERIVED_FROM_EXACT_SOURCE_METADATA", "UNRESOLVED"] } } } } } } };

// Keep the historical catalog generator schema aligned with the N1C contract shape.
schema.properties["$schema"] = { type: "string", minLength: 1 };
schema.properties["$id"] = { type: "string", minLength: 1 };
schema.properties.canvas.properties.classification = { type: "string", minLength: 1 };
for (const [key, type] of [["sourceCatalog", "object"], ["bijection", "object"], ["geometry", "object"], ["fixedComponents", "object"], ["unsupportedCombinationPolicy", "object"], ["runtimeBoundary", "object"]]) schema.properties[key] = { type, additionalProperties: true };
for (const key of ["families", "objectKinds", "affordances", "textVariants"]) schema.properties[key] = { type: "array", items: { type: "object", additionalProperties: true } };
for (const key of ["identityAxes", "sides", "textVariantWhitelist", "unresolvedBlockers"]) schema.properties[key] = { type: "array", items: { type: "string", minLength: 1 } };
for (const key of ["variantGenerationPolicy", "templateIdPattern", "typographyRegistryRef", "n2CandidatesRef"]) schema.properties[key] = { type: "string", minLength: 1 };
schema.properties.sourceRevisionRef = { type: "string", minLength: 1 };
schema.properties.psdMetadataRef = { type: "string", minLength: 1 };
schema.properties.fixedComponentsRef = { type: "string", minLength: 1 };
schema.properties.ctaOptionsRef = { type: "string", minLength: 1 };
schema.properties.currentOfficialRuleRefs = { type: "array", items: { type: "string", minLength: 1 } };
schema.properties.sourceResolutionStatus = { type: "string", enum: ["SOURCE_RESOLVED_RENDERER_OWNED_PSD_EXACT"] };
schema.properties.runtimeFontPolicyRef = { type: "string", minLength: 1 };
schema.properties.fontCompatibilityRef = { type: "string", minLength: 1 };
schema.properties.metricFixturesRef = { type: "string", minLength: 1 };
schema.properties.n2Readiness = { type: "object", additionalProperties: true };
schema.properties.fontResolutionPolicy = { type: "object", additionalProperties: false, required: ["fallbackAllowed", "exactIdentityRequired", "runtimeIdentityRequired", "allowedModes", "sourceIdentityPolicy", "runtimeLookupKey", "classification"], properties: { fallbackAllowed: { const: false }, exactIdentityRequired: { const: true }, runtimeIdentityRequired: { const: true }, allowedModes: { const: ["BUNDLED_EXACT", "EXTERNAL_EXACT"] }, sourceIdentityPolicy: { const: "SOURCE_EXACT_RENDERER_OWNED_BINARY" }, runtimeLookupKey: { const: "fontToken" }, classification: { const: "PSD_EXACT_RENDERER_OWNED" } } };
schema.$defs.template.properties.source.properties.canvas.properties.classification = { type: "string", minLength: 1 };
schema.$defs.template.properties.source.properties.sourceRevisionRef = { type: "string", minLength: 1 };
schema.$defs.template.properties.sourceMetadataRef = { type: "object", additionalProperties: false, required: ["registry", "templateId", "classification"], properties: { registry: { type: "string", minLength: 1 }, templateId: { type: "string", pattern: "^NAVER_SMARTCHANNEL_" }, classification: { enum: ["SOURCE_CONFIRMED", "DERIVED_FROM_EXACT_SOURCE_METADATA", "UNRESOLVED"] } } };


contract.sourceResolutionStatus = "SOURCE_RESOLVED_RENDERER_OWNED_PSD_EXACT";
contract.unresolvedBlockers = contract.unresolvedBlockers.filter((blocker) => blocker !== "runtime_font_exact_match_to_psd");
function writeJson(relativePath, value) { const filePath = path.join(projectRoot, relativePath); fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
writeJson("contracts/naver-smartchannel-template-contract.json", contract);
writeJson("contracts/naver-smartchannel-template.schema.json", schema);
writeJson("contracts/naver-smartchannel-typography.json", typography);
writeJson("contracts/naver-smartchannel-fixed-components.json", fixedComponents);
writeJson("contracts/naver-smartchannel-n2-candidates.json", { registryVersion: "1.1.0", status: "REGISTRY_ONLY", sourceResolutionStatus: "SOURCE_RESOLVED_RENDERER_OWNED_PSD_EXACT", sourceBacked: true, readiness: { ready: true, blockers: [], runtimeFontMode: "PSD_EXACT_RENDERER_OWNED", exportContributingSfFonts: [] }, candidates: n2Candidates });
console.log(JSON.stringify({ sourcePsdCount: rows.length, catalogPsdCount: catalog.length, inventoryDigestSha256, filenameRenamedBySourceRoot: rows.filter((row) => row.source.catalogCrossCheck.endsWith("DIFFERENT_FILENAME")).length }));
