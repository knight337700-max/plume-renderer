import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const templateContract = readJson("contracts/naver-smartchannel-template-contract.json");

const sourceMasks = {
  "160_LEFT": {
    maskToken: "NAVER_SC_MASK_160_LEFT",
    frame: { x: 40, y: 15, width: 195, height: 130 },
    vectorMaskBboxNormalizedVariants: [[0.0533333420753479, 0.09375, 0.31333333253860474, 0.90625]],
    pathDigests: ["61b992cbac39b56b70909a024d293428e91343748a44298021bb87be95cb0c45"],
    sourceLayerBounds: [39, 14, 236, 146],
    sourceLayerPath: "Root/썸네일영역_사용할 이미지를 마스킹 해주세요.",
    sourceTemplateIds: ["NAVER_SMARTCHANNEL_160_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_NONE"],
  },
  "160_RIGHT": {
    maskToken: "NAVER_SC_MASK_160_RIGHT",
    frame: { x: 515, y: 15, width: 195, height: 130 },
    vectorMaskBboxNormalizedVariants: [[0.6866666674613953, 0.09375, 0.9466666579246521, 0.90625]],
    pathDigests: ["6fd3bec272fd6540555ce9946c8fbdf9f8592533ba036b872dfdbf848ee6bfb9"],
    sourceLayerBounds: [514, 14, 711, 146],
    sourceLayerPath: "Root/썸네일영역_사용할 이미지를 마스킹 해주세요.",
    sourceTemplateIds: ["NAVER_SMARTCHANNEL_160_EMPHASIS_THUMBNAIL_RIGHT_THREE_LINE_NONE"],
  },
  "200_LEFT": {
    maskToken: "NAVER_SC_MASK_200_LEFT",
    frame: { x: 40, y: 30, width: 210, height: 140 },
    vectorMaskBboxNormalizedVariants: [[0.0533333420753479, 0.1485276222229004, 0.33258897066116333, 0.8500000238418579]],
    pathDigests: ["868306e1b6d26e1a52c0cdff8d7ba5b206ab3bd3547cc8223d1c5d17e5ef8c39"],
    sourceLayerBounds: [39, 28, 251, 172],
    sourceLayerPath: "Root/썸네일영역_사용할 이미지를 마스킹 해주세요.",
    sourceTemplateIds: ["NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_NONE"],
  },
  "200_RIGHT": {
    maskToken: "NAVER_SC_MASK_200_RIGHT",
    frame: { x: 500, y: 30, width: 210, height: 140 },
    vectorMaskBboxNormalizedVariants: [
      [0.6666666865348816, 0.1485276222229004, 0.9459222555160522, 0.8500000238418579],
      [0.6666666865348816, 0.1485276222229004, 0.945922315120697, 0.8500000238418579],
    ],
    pathDigests: [
      "c84036a7284f70949a09908c3e77b28e9232116746a03dec1e286cbfc719efcf",
      "d4cb9f6fd28e32e7b4e9e81013be2b9199ebcb813b6ac3051d1359de083156d2",
    ],
    sourceLayerBounds: [499, 28, 711, 172],
    sourceLayerPath: "Root/썸네일영역_사용할 이미지를 마스킹 해주세요.",
    sourceTemplateIds: [
      "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_RIGHT_ONE_LINE_NONE",
      "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_RIGHT_MAIN_SUB_NONE",
      "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_RIGHT_THREE_LINE_NONE",
    ],
    sourceVariantNote: "The 2-line source stores an equivalent vector mask with a sub-pixel path-coordinate difference; no mirror or tolerance rule is introduced.",
  },
  "280_LEFT": {
    maskToken: "NAVER_SC_MASK_280_LEFT",
    frame: { x: 40, y: 40, width: 200, height: 200 },
    vectorMaskBboxNormalizedVariants: [[0.0533333420753479, 0.1428571343421936, 0.3199999928474426, 0.8571428656578064]],
    pathDigests: ["6f028a3912651d233099c5f102fab2f2976a6e0f34df7a243177782631bc9e93"],
    sourceLayerBounds: [39, 38, 242, 242],
    sourceLayerPath: "Root/썸네일영역_사용할 이미지를 마스킹 해주세요.",
    sourceTemplateIds: ["NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_FOUR_LINE_NONE"],
  },
  "280_RIGHT": {
    maskToken: "NAVER_SC_MASK_280_RIGHT",
    frame: { x: 510, y: 40, width: 200, height: 200 },
    vectorMaskBboxNormalizedVariants: [[0.6800000071525574, 0.1428571343421936, 0.9466666579246521, 0.8571428656578064]],
    pathDigests: ["8fa425b985f9b7b1aab331be126d319ae577c0d6e24fdfb6f7586429208c4089"],
    sourceLayerBounds: [509, 38, 712, 242],
    sourceLayerPath: "Root/썸네일영역_사용할 이미지를 마스킹 해주세요.",
    sourceTemplateIds: ["NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_RIGHT_FOUR_LINE_NONE"],
  },
};

const personTransforms = {
  "200_LEFT": { sourceSize: { width: 272, height: 234 }, canvasTransform: [44, 13, 316, 13, 316, 247, 44, 247] },
  "200_RIGHT": { sourceSize: { width: 272, height: 234 }, canvasTransform: [434, 13, 706, 13, 706, 247, 434, 247] },
  "280_LEFT": { sourceSize: { width: 425, height: 370 }, canvasTransform: [40.81234237582396, 22.794402261632964, 337.8848487647566, 22.794402261632964, 337.8848487647566, 281.4222313531743, 40.81234237582396, 281.4222313531743] },
  "280_RIGHT": { sourceSize: { width: 425, height: 370 }, canvasTransform: [410.81234237582396, 22.794402261632964, 707.8848487647566, 22.794402261632964, 707.8848487647566, 281.4222313531743, 410.81234237582396, 281.4222313531743] },
};

const geometryKey = (entry) => [entry.height, entry.family, entry.objectKind, entry.side, entry.affordance].join("|");
const primitiveByKey = new Map((templateContract.geometry?.placementPrimitives ?? []).map((entry) => [geometryKey(entry), entry]));
const templateGroups = new Map();
for (const template of templateContract.templates) {
  const key = geometryKey(template);
  if (!templateGroups.has(key)) templateGroups.set(key, []);
  templateGroups.get(key).push(template);
}

function fallbackPrimitive(template) {
  const exact = primitiveByKey.get(geometryKey(template));
  if (exact?.objectRegion) return { primitive: exact, sharedWithNone: false };
  const noneKey = [template.height, template.family, template.objectKind, template.side, "NONE"].join("|");
  const none = primitiveByKey.get(noneKey);
  return { primitive: none, sharedWithNone: true };
}

function sourceRuleFor(template) {
  if (template.objectKind === "THUMBNAIL") return "NAVER_SC_THUMBNAIL_SLOT_LOCAL_SOURCE";
  if (template.objectKind === "PERSON_MOVIE" && template.height >= 200) return "NAVER_SC_PERSON_MOVIE_SMART_OBJECT_FRAME_SOURCE";
  if (template.objectKind === "PERSON_MOVIE") return "NAVER_SC_PERSON_MOVIE_160_FULL_CANVAS_SOURCE";
  return "NAVER_SC_STANDARD_FULL_CANVAS_SOURCE";
}

function policyFor(template, primitive) {
  const base = {
    coordinateSpace: {
      type: template.objectKind === "THUMBNAIL" ? "SLOT_LOCAL_SOURCE" : template.objectKind === "PERSON_MOVIE" && template.height >= 200 ? "SMART_OBJECT_FRAME_SOURCE" : "FULL_CANVAS_SOURCE",
      canvas: { width: 750, height: template.height },
    },
    fitMode: "NONE",
    fit: { mode: "NONE" },
    anchor: { mode: "SOURCE_DEFINED", sourceBasis: "PSD_LAYER_OR_FRAME" },
    clip: { mode: "NO_CLIP" },
    mask: { mode: "NO_CLIP" },
    autoDesign: {
      trim: "FORBIDDEN",
      crop: "FORBIDDEN",
      resize: "FORBIDDEN",
      backgroundRemoval: "FORBIDDEN",
      semanticFocalCrop: "FORBIDDEN",
      padding: "FORBIDDEN",
    },
    placementFrame: primitive?.objectRegion ?? null,
  };
  if (template.objectKind === "THUMBNAIL") {
    const mask = sourceMasks[`${template.height}_${template.side}`];
    return {
      ...base,
      coordinateSpace: { type: "SLOT_LOCAL_SOURCE", width: mask.frame.width, height: mask.frame.height },
      fitMode: "FIXED_FRAME",
      fit: { mode: "FIXED_FRAME" },
      placementPolicy: "FIXED_SOURCE_MASK_FRAME_1_TO_1",
      placementFrame: mask.frame,
      clip: { mode: "SOURCE_MASK", maskToken: mask.maskToken },
      mask: { mode: "SOURCE_MASK", maskToken: mask.maskToken },
    };
  }
  if (template.objectKind === "PERSON_MOVIE" && template.height >= 200) {
    const transform = personTransforms[`${template.height}_${template.side}`];
    return {
      ...base,
      fitMode: "SOURCE_TRANSFORM",
      fit: { mode: "SOURCE_TRANSFORM" },
      placementPolicy: "SMART_OBJECT_SOURCE_TRANSFORM_NO_RESIZE",
      sourceFrame: { width: transform.sourceSize.width, height: transform.sourceSize.height, canvasTransform: transform.canvasTransform },
    };
  }
  return {
    ...base,
    placementPolicy: "PRECOMPOSED_CANVAS_1_TO_1",
    sourceInput: "FULL_CANVAS_SOURCE_ASSET",
  };
}

const tokens = [];
const mappings = [];
for (const [key, templates] of templateGroups) {
  const template = templates[0];
  const { primitive, sharedWithNone } = fallbackPrimitive(template);
  const token = `NAVER_SC_${template.height}_${template.family}_${template.objectKind}_${template.side}_${template.affordance}`;
  const policy = policyFor(template, primitive);
  const placement = {
    token,
    runtimeEnabled: true,
    height: template.height,
    family: template.family,
    objectKind: template.objectKind,
    side: template.side,
    affordance: template.affordance,
    geometrySourceRef: primitive ? `contracts/naver-smartchannel-template-contract.json#/geometry/placementPrimitives/${templateContract.geometry.placementPrimitives.indexOf(primitive)}` : null,
    objectRegionSharedWithAffordanceNone: sharedWithNone,
    sourceAssetRuleId: sourceRuleFor(template),
    sourceAssetRuleRefs: [sourceRuleFor(template)],
    sourceClassification: "DERIVED_FROM_EXACT_PSD_LAYER_STRUCTURE_AND_PROJECT_INPUT_BOUNDARY",
    ...policy,
  };
  tokens.push(placement);
  for (const entry of templates) mappings.push({ templateId: entry.templateId, objectPlacementToken: token, sourceClassification: "DERIVED_FROM_EXACT_SOURCE_METADATA" });
}

const candidateProof = [
  {
    templateId: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_NONE",
    sourceLayerEvidence: { activeObjectLayerPath: "Root/오브젝트/오브젝트", kind: "PixelLayer", bounds: [41, 13, 271, 141], clipping: false, vectorMask: false, guideObjectRegion: [40, 0, 275, 160] },
    placementToken: "NAVER_SC_160_BASIC_STANDARD_LEFT_NONE",
  },
  {
    templateId: "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_RIGHT_THREE_LINE_NONE",
    sourceLayerEvidence: { activeMaskLayerPath: "Root/썸네일 오브젝트 샘플_예시/썸네일영역_사용할 이미지를 마스킹 해주세요.", kind: "ShapeLayer", bounds: [499, 28, 711, 172], vectorMask: "NAVER_SC_MASK_200_RIGHT", clippedSampleLayer: true, guideObjectRegion: [500, 0, 710, 200], nominalFrame: [500, 30, 210, 140] },
    placementToken: "NAVER_SC_200_EMPHASIS_THUMBNAIL_RIGHT_NONE",
  },
  {
    templateId: "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_LANDING_ICON",
    sourceLayerEvidence: { activeObjectLayerPath: "Root/오브젝트/오브젝트", kind: "PixelLayer", bounds: [41, 56, 271, 204], clipping: false, vectorMask: false, guideObjectRegion: [40, 0, 275, 280] },
    placementToken: "NAVER_SC_280_BASIC_STANDARD_LEFT_LANDING_ICON",
  },
  {
    templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_APP_CTA",
    sourceLayerEvidence: { activeMaskLayerPath: "Root/썸네일 오브젝트 샘플_예시/썸네일영역_사용할 이미지를 마스킹 해주세요.", kind: "ShapeLayer", bounds: [39, 38, 242, 242], vectorMask: "NAVER_SC_MASK_280_LEFT", clippedSampleLayer: true, guideObjectRegion: [40, 0, 240, 280], nominalFrame: [40, 40, 200, 200] },
    placementToken: "NAVER_SC_280_EMPHASIS_THUMBNAIL_LEFT_APP_CTA",
  },
  {
    templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE",
    sourceLayerEvidence: { activeObjectLayerPath: "Root/오브젝트강조(영화소재)샘플_예시/레이어 4", kind: "SmartObjectLayer", bounds: [411, 23, 708, 281], clipping: false, vectorMask: false, smartObjectSourceSize: [425, 370], canvasTransform: personTransforms["280_RIGHT"].canvasTransform, guideObjectRegion: [410, 0, 710, 280] },
    placementToken: "NAVER_SC_280_EMPHASIS_PERSON_MOVIE_RIGHT_NONE",
  },
  {
    templateId: "NAVER_SMARTCHANNEL_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_MAIN2_DISCLOSURE_2LINE_NONE",
    sourceLayerEvidence: { activeObjectLayerPath: "Root/오브젝트/오브젝트", kind: "PixelLayer", bounds: [46, 30, 270, 216], clipping: false, vectorMask: false, guideObjectRegion: [40, 0, 275, 280] },
    placementToken: "NAVER_SC_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_NONE",
  },
];

const sourceAssetRules = [
  {
    id: "NAVER_SC_STANDARD_FULL_CANVAS_SOURCE",
    appliesTo: ["STANDARD"],
    coordinateModel: "FULL_CANVAS_SOURCE",
    acceptedMime: ["image/png"],
    alphaAllowed: true,
    alphaRequired: false,
    dimensionRule: "EXACT_TEMPLATE_CANVAS",
    preprocessing: "NONE",
    trim: "FORBIDDEN",
    crop: "FORBIDDEN",
    resize: "FORBIDDEN",
    background: "PRESERVE_AS_PROVIDED",
    maxFileSize: "DEFERRED_TO_CHANNEL_VALIDATOR",
    classification: "PROJECT_CONTRACT_DERIVED_FROM_EXACT_PSD_LAYER_PLACEMENT",
    provenance: ["120 PSD active STANDARD object layers are absolute-canvas PixelLayer content with no clipping/vector mask; runtime input is explicitly pre-composed and 1:1."],
  },
  {
    id: "NAVER_SC_THUMBNAIL_SLOT_LOCAL_SOURCE",
    appliesTo: ["THUMBNAIL"],
    coordinateModel: "SLOT_LOCAL_SOURCE",
    acceptedMime: ["image/png", "image/jpeg"],
    alphaAllowed: true,
    alphaRequired: false,
    dimensionRule: "EXACT_SOURCE_MASK_FRAME",
    preprocessing: "NONE",
    trim: "FORBIDDEN",
    crop: "FORBIDDEN",
    resize: "FORBIDDEN",
    background: "PRESERVE_AS_PROVIDED",
    maxFileSize: "DEFERRED_TO_CHANNEL_VALIDATOR",
    classification: "DERIVED_FROM_EXACT_PSD_VECTOR_MASK_AND_GUIDE_FRAME",
    provenance: ["All 41 THUMBNAIL sources contain a ShapeLayer vector mask and a clipping sample pixel layer; frame dimensions are 195x130, 210x140, or 200x200 by source height."],
  },
  {
    id: "NAVER_SC_PERSON_MOVIE_160_FULL_CANVAS_SOURCE",
    appliesTo: ["PERSON_MOVIE"],
    height: 160,
    coordinateModel: "FULL_CANVAS_SOURCE",
    acceptedMime: ["image/png"],
    alphaAllowed: true,
    alphaRequired: false,
    dimensionRule: "EXACT_TEMPLATE_CANVAS",
    preprocessing: "NONE",
    trim: "FORBIDDEN",
    crop: "FORBIDDEN",
    resize: "FORBIDDEN",
    background: "PRESERVE_AS_PROVIDED",
    maxFileSize: "DEFERRED_TO_CHANNEL_VALIDATOR",
    classification: "PROJECT_CONTRACT_DERIVED_FROM_PIXEL_LAYER_WITHOUT_SMART_OBJECT_FRAME",
    provenance: ["Four 160 PERSON_MOVIE sources contain a positioned PixelLayer and no Smart Object, vector mask, or clipping mask; no transform heuristic is added."],
  },
  {
    id: "NAVER_SC_PERSON_MOVIE_SMART_OBJECT_FRAME_SOURCE",
    appliesTo: ["PERSON_MOVIE"],
    height: [200, 280],
    coordinateModel: "SMART_OBJECT_FRAME_SOURCE",
    acceptedMime: ["image/png"],
    alphaAllowed: true,
    alphaRequired: false,
    dimensionRule: "EXACT_SOURCE_SMART_OBJECT_FRAME",
    preprocessing: "NONE",
    trim: "FORBIDDEN",
    crop: "FORBIDDEN",
    resize: "FORBIDDEN",
    background: "PRESERVE_AS_PROVIDED",
    maxFileSize: "DEFERRED_TO_CHANNEL_VALIDATOR",
    classification: "DERIVED_FROM_EXACT_PSD_SMART_OBJECT_FRAME_AND_TRANSFORM",
    provenance: ["Eight 200/280 PERSON_MOVIE sources expose a SmartObjectLayer with a deterministic canvas transform and source frame size; runtime must apply only that source transform."],
  },
];

const sourceAudit = {
  psdCount: 120,
  sourceRevisionRef: "contracts/naver-smartchannel-source-revision.json#/sourceRevision",
  metadataRef: "contracts/naver-smartchannel-psd-metadata.json",
  extractionTool: "psd-tools==1.18.0",
  auditStatus: "SOURCE_AUDIT_COMPLETE",
  auditedDimensions: [160, 200, 280],
  layerStructureSummary: {
    STANDARD: { "160": 17, "200": 17, "280": 31, activeLayerKind: "PixelLayer", vectorMask: false, clippingMask: false },
    THUMBNAIL: { "160": 11, "200": 11, "280": 19, activeLayerKind: "ShapeLayer+PixelLayer", vectorMask: true, clippingMask: true },
    PERSON_MOVIE: { "160": 4, "200": 4, "280": 6, pixelLayerWithoutSmartObject160: true, smartObject200And280: true, vectorMask: false, clippingMask: false },
  },
  candidateProof,
};

const contract = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://kbr.local/contracts/naver-smartchannel-object-placement-v1.0.0.json",
  registryVersion: "1.0.0",
  status: "SOURCE_RESOLVED_PROJECT_CONTRACT",
  channel: "NAVER_GFA",
  placement: "SMARTCHANNEL",
  templateContractVersion: "1.10.0",
  sourceRevisionRef: sourceAudit.sourceRevisionRef,
  templateContractRef: "contracts/naver-smartchannel-template-contract.json",
  coordinateModels: ["FULL_CANVAS_SOURCE", "SLOT_LOCAL_SOURCE", "TRIMMED_OBJECT_SOURCE", "SMART_OBJECT_FRAME_SOURCE", "UNRESOLVED"],
  fitModes: ["NONE", "CONTAIN", "COVER", "STRETCH", "FIXED_FRAME", "SOURCE_TRANSFORM", "UNRESOLVED"],
  anchorModes: ["TOP_LEFT", "CENTER", "CENTER_LEFT", "CENTER_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT", "SOURCE_DEFINED", "UNRESOLVED"],
  clipModes: ["NO_CLIP", "RECT_CLIP", "ROUNDED_RECT_CLIP", "ELLIPSE_CLIP", "CUSTOM_MASK", "SOURCE_MASK", "UNRESOLVED"],
  globalRules: {
    inheritedKakaoOrFreeformPlacementSemantics: false,
    mirrorGeneration: "FORBIDDEN",
    autoTrim: "FORBIDDEN",
    autoCrop: "FORBIDDEN",
    autoResize: "FORBIDDEN",
    autoBackgroundRemoval: "FORBIDDEN",
    semanticFocalCrop: "FORBIDDEN",
    sourceUnknownPolicy: "UNRESOLVED_AND_REJECT_RUNTIME_START",
  },
  sourceAssetRules,
  maskGeometry: Object.values(sourceMasks).map((mask) => ({
    maskToken: mask.maskToken,
    mode: "SOURCE_MASK",
    frame: mask.frame,
    vectorMaskBboxNormalized: mask.vectorMaskBboxNormalizedVariants[0],
    vectorMaskBboxNormalizedVariants: mask.vectorMaskBboxNormalizedVariants,
    pathDigest: mask.pathDigests[0],
    pathDigests: mask.pathDigests,
    sourceLayerBounds: mask.sourceLayerBounds,
    sourceLayerPath: mask.sourceLayerPath,
    sourceTemplateIds: mask.sourceTemplateIds,
    sourceVariantNote: mask.sourceVariantNote,
    classification: "DERIVED_FROM_EXACT_SOURCE_METADATA",
  })),
  tokens,
  templateMappings: mappings,
  sourceAudit,
  n2Gate: {
    candidateTemplatesResolved: candidateProof.every((entry) => Boolean(entry.placementToken)),
    unresolvedCandidateCount: 0,
    anchor: "FROZEN_SOURCE_DEFINED",
    fit: "FROZEN_SOURCE_BACKED",
    maskClip: "FROZEN_SOURCE_BACKED",
    sourceAssetRules: "FROZEN_OR_NON_BLOCKING_DEFERRED",
    rendererImplemented: false,
    goldenPngCreated: false,
    desktopUiImplemented: false,
    nextPhase: "N2_SMARTCHANNEL_TEMPLATE_ENGINE_REPRESENTATIVE_GOLDENS",
    ready: true,
    blockers: [],
  },
};

const outputPath = path.join(root, "contracts/naver-smartchannel-object-placement.json");
fs.writeFileSync(outputPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, tokens: tokens.length, templatesMapped: mappings.length, candidateTemplatesResolved: candidateProof.length }, null, 2));
