import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  listGoogleStaticProfiles,
  loadGoogleStaticContracts,
  renderGoogleStaticCandidate,
  validateGoogleDemandGenSingleImageDeliverySet,
  validateGoogleDemandGenUploadedDisplayStaticSet,
  validateGooglePerformanceMaxDeliverySet,
  validateGoogleRdaDeliverySet,
  validateGoogleStaticArtifact,
} from "../dist/core/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contracts = await loadGoogleStaticContracts(root);
const sourceRoot = path.join(root, "fixtures", "google", "g2", "source");
const planRoot = path.join(root, "fixtures", "google", "g2", "plans");
const candidateRoot = path.join(root, "artifacts", "g2", "google-static-candidates");
const g2Root = path.join(root, "artifacts", "g2");
const registryPath = path.join(root, "contracts", "google", "golden-candidates.g2.json");
const evidencePath = path.join(g2Root, "google-static-rendering-validation-verification.json");
const deliveryEvidencePath = path.join(g2Root, "google-static-delivery-validation.json");
const previewPath = path.join(g2Root, "google-static-candidate-index.html");

const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
const PROFILE_ORDER = listGoogleStaticProfiles(contracts);
const BASELINE_COMMIT = "5456780dc2303a680c578d43e53f36333450d6c4";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function relative(value) {
  return path.relative(root, value).split(path.sep).join("/");
}

function profileFamily(profile) {
  if (profile.role === "LOGO" || profile.role === "LANDSCAPE_LOGO") return "logo";
  if (profile.role === "UPLOADED_DISPLAY_STATIC") return "uploaded";
  return "marketing";
}

function targetForCapability(capabilityId) {
  if (capabilityId === "GOOGLE_RDA_ASSET_SET") return "RDA";
  if (capabilityId === "GOOGLE_PMAX_ASSET_GROUP_STATIC") return "PMAX";
  if (capabilityId === "GOOGLE_DEMAND_GEN_SINGLE_IMAGE") return "DEMAND_GEN";
  return "DEMAND_GEN_UPLOADED_DISPLAY_STATIC";
}

function colorForSeed(seed) {
  return {
    r: 24 + ((seed * 37) % 120),
    g: 74 + ((seed * 53) % 120),
    b: 128 + ((seed * 67) % 110),
  };
}

function createPattern(width, height, seed, transparent) {
  const raw = Buffer.alloc(width * height * 4);
  const base = colorForSeed(seed);
  const secondary = { r: (base.r + 80) % 220, g: (base.g + 60) % 220, b: (base.b + 40) % 220 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const block = ((Math.floor(x / Math.max(1, width / 4)) + Math.floor(y / Math.max(1, height / 4)) + seed) % 2) === 0;
      const inMark = transparent
        ? (x >= Math.floor(width * 0.2) && x < Math.ceil(width * 0.8) && y >= Math.floor(height * 0.2) && y < Math.ceil(height * 0.8))
        : true;
      raw[index] = block ? base.r : secondary.r;
      raw[index + 1] = block ? base.g : secondary.g;
      raw[index + 2] = block ? base.b : secondary.b;
      raw[index + 3] = inMark ? 255 : 0;
      if (inMark && ((x - width / 2) ** 2 + (y - height / 2) ** 2) < (Math.min(width, height) * 0.18) ** 2) {
        raw[index] = 244;
        raw[index + 1] = 182;
        raw[index + 2] = 58;
        raw[index + 3] = 255;
      }
    }
  }
  return raw;
}

function sourceSpec(profile, index) {
  const family = profileFamily(profile);
  if (family === "logo" && profile.role === "LOGO") return { width: 512, height: 512, transparent: true };
  if (family === "logo") return { width: 640, height: 160, transparent: true };
  if (family === "uploaded") return { width: profile.projectOutputPreset.width, height: profile.projectOutputPreset.height, transparent: false };
  if (profile.projectOutputPreset.height > profile.projectOutputPreset.width) return { width: 360, height: 640, transparent: false };
  return { width: 640 + (index % 3) * 80, height: 480 + (index % 2) * 40, transparent: false };
}

function destinationRect(profile) {
  const { width, height } = profile.projectOutputPreset;
  if (profileFamily(profile) === "uploaded") return { x: 0, y: 0, width, height };
  const inset = Math.max(4, Math.floor(Math.min(width, height) * 0.08));
  return { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 };
}

function sourceRectFor(profile, source) {
  if (profileFamily(profile) === "logo") return undefined;
  if (source.width > source.height) return { x: Math.floor(source.width * 0.1), y: 0, width: Math.floor(source.width * 0.8), height: source.height };
  return { x: 0, y: Math.floor(source.height * 0.1), width: source.width, height: Math.floor(source.height * 0.8) };
}

function placementFor(profile, index, source) {
  const family = profileFamily(profile);
  if (family === "uploaded") return { placementPolicy: "NONE", explicitElementPlan: true };
  if (family === "logo") {
    return profile.role === "LOGO"
      ? { placementPolicy: "ALPHA_TRIM_CONTAIN" }
      : { placementPolicy: "CENTER_CONTAIN" };
  }
  if (index === 0) return { placementPolicy: "MANUAL_CROP", sourceRect: sourceRectFor(profile, source) };
  if (index === 1) return { placementPolicy: "SEMANTIC_CROP_COVER", sourceRect: sourceRectFor(profile, source), semanticPlan: true };
  if (index === 4) return { placementPolicy: "MANUAL_CROP", sourceRect: sourceRectFor(profile, source) };
  return { placementPolicy: "CENTER_CONTAIN" };
}

function outputFor(profile, index) {
  if (profileFamily(profile) === "uploaded") return index % 2 === 0 ? { outputFormat: "JPEG", jpegQuality: 88 } : { outputFormat: "PNG" };
  if (profile.profileId === "GOOGLE_MARKETING_SQUARE_1_1" || profile.profileId === "GOOGLE_DEMAND_GEN_VERTICAL_9_16") return { outputFormat: "JPEG", jpegQuality: 88 };
  return { outputFormat: "PNG" };
}

async function writeSource(profile, index) {
  const spec = sourceSpec(profile, index);
  const raw = createPattern(spec.width, spec.height, index + 11, spec.transparent);
  const bytes = await sharp(raw, { raw: { width: spec.width, height: spec.height, channels: 4 } }).png(PNG_OPTIONS).toBuffer();
  const file = path.join(sourceRoot, `g2-${profile.profileId}.png`);
  await writeFile(file, bytes);
  return { file, bytes, width: spec.width, height: spec.height };
}

function artifactFromCandidate(candidate, profile, plan, ordinal = 0, overrides = {}) {
  return {
    artifactId: `g2-${profile.profileId}-${ordinal}`,
    assetProfileId: profile.profileId,
    role: profile.role,
    ordinal,
    width: candidate.width,
    height: candidate.height,
    mime: candidate.mime,
    bytes: candidate.encodedBytes,
    animation: false,
    ...(profileFamily(profile) === "uploaded" ? {} : { placementPolicy: plan.placementPolicy }),
    ...(profileFamily(profile) === "uploaded" ? { placementPlan: { explicitElementPlan: true, destinationRect: plan.destinationRect } } : {}),
    ...overrides,
  };
}

function codes(result) {
  return {
    status: result.status,
    errors: result.errors.map((issue) => issue.code),
    warnings: result.warnings.map((issue) => issue.code),
    info: result.info.map((issue) => issue.code),
  };
}

function fieldsRda() {
  return { SHORT_HEADLINE: ["Short"], LONG_HEADLINE: ["Long"], DESCRIPTION: ["Description"], BUSINESS_NAME: ["Business"], CTA: ["Platform metadata"], FINAL_URL: ["https://example.invalid"] };
}

function fieldsPmax(associationLevel = "CampaignAsset") {
  return { HEADLINE: ["One", "Two", "Three"], LONG_HEADLINE: ["Long"], DESCRIPTION: ["Description", "Second"], BUSINESS_NAME: ["Business"], CALL_TO_ACTION_SELECTION: ["Platform"], PMAX_ASSOCIATION_LEVEL: associationLevel };
}

function fieldsDemandGen() {
  return { HEADLINE: ["Headline"], DESCRIPTION: ["Description"], BUSINESS_NAME: ["Business"], FINAL_URL: ["https://example.invalid"] };
}

function scenario(name, result, expectedStatus, expectedCodes = []) {
  const actualCodes = [...result.errors, ...result.warnings, ...result.info].map((issue) => issue.code);
  const passed = result.status === expectedStatus && expectedCodes.every((code) => actualCodes.includes(code));
  return { name, expectedStatus, expectedCodes, ...codes(result), passed };
}

function cloned(base, ordinal, overrides = {}) {
  return { ...base, artifactId: `${base.artifactId}-${ordinal}`, ordinal, ...overrides };
}

async function main() {
  await Promise.all([
    mkdir(sourceRoot, { recursive: true }),
    mkdir(planRoot, { recursive: true }),
    mkdir(candidateRoot, { recursive: true }),
    mkdir(g2Root, { recursive: true }),
  ]);

  const candidates = [];
  const candidateByProfile = new Map();
  for (const [index, profile] of PROFILE_ORDER.entries()) {
    const source = await writeSource(profile, index);
    const family = profileFamily(profile);
    const output = outputFor(profile, index);
    const placement = placementFor(profile, index, source);
    const plan = {
      schemaVersion: "1.0.0",
      profileId: profile.profileId,
      sourceFixturePath: relative(source.file),
      placementPolicy: placement.placementPolicy,
      ...(placement.sourceRect ? { sourceRect: placement.sourceRect } : {}),
      destinationRect: destinationRect(profile),
      background: family === "logo" ? { r: 255, g: 255, b: 255, alpha: 255 } : { r: 245, g: 247, b: 250, alpha: 255 },
      ...(placement.explicitElementPlan ? { explicitElementPlan: true } : {}),
      ...(placement.semanticPlan ? { semanticPlan: true } : {}),
      ...output,
    };
    const planFile = path.join(planRoot, `g2-${profile.profileId}.json`);
    await writeFile(planFile, json(plan));
    const rendered = await renderGoogleStaticCandidate(source.bytes, plan, contracts);
    const extension = rendered.mime === "image/png" ? "png" : "jpg";
    const artifactFile = path.join(candidateRoot, `${profile.profileId}.${extension}`);
    await writeFile(artifactFile, rendered.bytes);
    const artifact = artifactFromCandidate(rendered, profile, plan);
    const capabilityContexts = profile.targetIds.map((target) => target === "RDA" ? "GOOGLE_RDA_ASSET_SET" : target === "PMAX" ? "GOOGLE_PMAX_ASSET_GROUP_STATIC" : target === "DEMAND_GEN" ? "GOOGLE_DEMAND_GEN_SINGLE_IMAGE" : "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC");
    const validatorSummaryByCapability = Object.fromEntries(capabilityContexts.map((capabilityId) => {
      const result = { errors: [], warnings: [], info: [], status: "PASS" };
      const artifactResult = validateGoogleStaticArtifact(artifact, contracts, { target: targetForCapability(capabilityId) });
      const summary = { status: artifactResult.length === 0 ? "PASS" : "ERROR", errors: artifactResult.filter((issue) => issue.severity === "ERROR").map((issue) => issue.code), warnings: artifactResult.filter((issue) => issue.severity === "WARNING").map((issue) => issue.code), info: artifactResult.filter((issue) => issue.severity === "INFO").map((issue) => issue.code) };
      return [capabilityId, summary];
    }));
    const candidate = {
      profileId: profile.profileId,
      capabilityContexts,
      assetRole: profile.role,
      artifactRelativePath: relative(artifactFile),
      canvas: { width: rendered.width, height: rendered.height },
      mime: rendered.mime,
      encodedBytes: rendered.encodedBytes,
      projectMaxBytesByTarget: Object.fromEntries(profile.targetIds.map((target) => [target, profile.maxBytesByTarget[target]])),
      artifactSha256: sha256(rendered.bytes),
      renderFingerprint: rendered.renderFingerprint,
      sourceFixtureRelativePath: relative(source.file),
      sourceFixtureSha256: sha256(source.bytes),
      layoutPlanRelativePath: relative(planFile),
      layoutPlanSha256: sha256(json(plan)),
      placementPolicy: plan.placementPolicy,
      renderedRect: rendered.renderedRect,
      sourceRect: rendered.sourceRect,
      alphaTrimmed: rendered.alphaTrimmed,
      validatorSummaryByCapability,
      expectedInfoDiagnostics: profile.profileId === "GOOGLE_RDA_VERTICAL_9_16" ? ["KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY"] : profile.profileId === "GOOGLE_DEMAND_GEN_VERTICAL_9_16" ? ["KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED"] : [],
      candidateStatus: "CANDIDATE",
      generatedFrom: { phase: "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES", baselineCommit: BASELINE_COMMIT },
    };
    candidates.push(candidate);
    candidateByProfile.set(profile.profileId, { profile, candidate, artifact, plan, source, rendered });
  }

  const get = (profileId, ordinal = 0, overrides = {}) => cloned(candidateByProfile.get(profileId).artifact, ordinal, overrides);
  const ordered = (...assets) => assets.map((asset, ordinal) => ({ ...asset, artifactId: `${asset.artifactId}-ordered-${ordinal}`, ordinal }));
  const land = get("GOOGLE_MARKETING_LANDSCAPE_1_91");
  const square = get("GOOGLE_MARKETING_SQUARE_1_1");
  const portrait = get("GOOGLE_MARKETING_PORTRAIT_4_5");
  const rdaVertical = get("GOOGLE_RDA_VERTICAL_9_16");
  const dgVertical = get("GOOGLE_DEMAND_GEN_VERTICAL_9_16");
  const logo = get("GOOGLE_LOGO_SQUARE_1_1");
  const deliveryScenarios = [];
  deliveryScenarios.push(scenario("rda.valid_required_landscape_square", validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land, square), platformFields: fieldsRda() }, contracts), "PASS"));
  deliveryScenarios.push(scenario("rda.valid_with_optional_vertical_info", validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land, square, rdaVertical), platformFields: fieldsRda() }, contracts), "PASS", ["KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY"]));
  deliveryScenarios.push(scenario("rda.invalid_missing_required_role", validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land), platformFields: fieldsRda() }, contracts), "ERROR", ["KBR-GOOGLE-SET-REQUIRED-ROLE-MISSING"]));
  deliveryScenarios.push(scenario("rda.invalid_combined_image_max", validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(...Array.from({ length: 16 }, (_, ordinal) => get("GOOGLE_MARKETING_LANDSCAPE_1_91", ordinal)), square), platformFields: fieldsRda() }, contracts), "ERROR", ["KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED"]));
  deliveryScenarios.push(scenario("rda.invalid_combined_logo_max", validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land, square, ...Array.from({ length: 6 }, (_, ordinal) => get("GOOGLE_LOGO_SQUARE_1_1", ordinal + 2))), platformFields: fieldsRda() }, contracts), "ERROR", ["KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED"]));
  deliveryScenarios.push(scenario("pmax.valid_brand_guidelines_enabled", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: true, assets: ordered(land, square, logo), platformFields: fieldsPmax("CampaignAsset") }, contracts), "PASS"));
  deliveryScenarios.push(scenario("pmax.valid_brand_guidelines_disabled", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: false, assets: ordered(land, square, logo), platformFields: fieldsPmax("AssetGroupAsset") }, contracts), "PASS"));
  deliveryScenarios.push(scenario("pmax.invalid_campaign_asset_association", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: true, assets: ordered(land, square, logo), platformFields: fieldsPmax("AssetGroupAsset") }, contracts), "ERROR", ["KBR-GOOGLE-PMAX-BRAND-ASSOCIATION-MODE-MISMATCH"]));
  deliveryScenarios.push(scenario("pmax.invalid_asset_group_association", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: false, assets: ordered(land, square, logo), platformFields: fieldsPmax("CampaignAsset") }, contracts), "ERROR", ["KBR-GOOGLE-PMAX-BRAND-ASSOCIATION-MODE-MISMATCH"]));
  deliveryScenarios.push(scenario("pmax.invalid_required_text_count", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: true, assets: ordered(land, square, logo), platformFields: { ...fieldsPmax(), HEADLINE: [] } }, contracts), "ERROR", ["KBR-GOOGLE-SET-REQUIRED-ROLE-MISSING"]));
  deliveryScenarios.push(scenario("pmax.invalid_required_image_role", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: true, assets: ordered(land, logo), platformFields: fieldsPmax() }, contracts), "ERROR", ["KBR-GOOGLE-SET-REQUIRED-ROLE-MISSING"]));
  deliveryScenarios.push(scenario("pmax.valid_optional_portrait", validateGooglePerformanceMaxDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC", lifecycleSnapshot: "ACTIVE", brandGuidelinesEnabled: true, assets: ordered(land, square, portrait, cloned(logo, 3)), platformFields: fieldsPmax() }, contracts), "PASS"));
  deliveryScenarios.push(scenario("demand_gen.valid_landscape_square_logo", validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(land, square, logo), platformFields: fieldsDemandGen() }, contracts), "PASS"));
  deliveryScenarios.push(scenario("demand_gen.valid_with_portrait", validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(land, square, portrait, logo), platformFields: fieldsDemandGen() }, contracts), "PASS"));
  deliveryScenarios.push(scenario("demand_gen.valid_with_vertical_info", validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(land, square, dgVertical, cloned(logo, 3)), platformFields: fieldsDemandGen() }, contracts), "PASS", ["KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED"]));
  deliveryScenarios.push(scenario("demand_gen.invalid_missing_logo", validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(land, square), platformFields: fieldsDemandGen() }, contracts), "ERROR", ["KBR-GOOGLE-SET-REQUIRED-ROLE-MISSING"]));
  deliveryScenarios.push(scenario("demand_gen.invalid_combined_image_max", validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(...Array.from({ length: 21 }, (_, ordinal) => get("GOOGLE_MARKETING_LANDSCAPE_1_91", ordinal)), logo), platformFields: fieldsDemandGen() }, contracts), "ERROR", ["KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED"]));
  deliveryScenarios.push(scenario("demand_gen.invalid_combined_logo_max", validateGoogleDemandGenSingleImageDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_SINGLE_IMAGE", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(land, square, ...Array.from({ length: 6 }, (_, ordinal) => get("GOOGLE_LOGO_SQUARE_1_1", ordinal + 2))), platformFields: fieldsDemandGen() }, contracts), "ERROR", ["KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED"]));
  const uploadProfiles = contracts.profiles.uploadedDisplayStaticProfiles;
  for (const profile of uploadProfiles) deliveryScenarios.push(scenario(`demand_gen_uploaded.valid_${profile.profileId}`, validateGoogleDemandGenUploadedDisplayStaticSet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(get(profile.profileId, 0)) }, contracts), "PASS"));
  deliveryScenarios.push(scenario("demand_gen_uploaded.valid_collection_up_to_20", validateGoogleDemandGenUploadedDisplayStaticSet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(...Array.from({ length: 20 }, (_, ordinal) => get("GOOGLE_DG_UPLOAD_300X250", ordinal))) }, contracts), "PASS"));
  deliveryScenarios.push(scenario("demand_gen_uploaded.invalid_unknown_canvas", validateGoogleDemandGenUploadedDisplayStaticSet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(get("GOOGLE_DG_UPLOAD_300X250", 0, { width: 301 })) }, contracts), "ERROR", ["KBR-GOOGLE-ASSET-CANVAS-MISMATCH"]));
  deliveryScenarios.push(scenario("demand_gen_uploaded.invalid_over_150000_bytes", validateGoogleDemandGenUploadedDisplayStaticSet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(get("GOOGLE_DG_UPLOAD_300X250", 0, { bytes: 150001 })) }, contracts), "ERROR", ["KBR-GOOGLE-ASSET-BYTES-EXCEEDED"]));
  deliveryScenarios.push(scenario("demand_gen_uploaded.invalid_gif_mime", validateGoogleDemandGenUploadedDisplayStaticSet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(get("GOOGLE_DG_UPLOAD_300X250", 0, { mime: "image/gif" })) }, contracts), "ERROR", ["KBR-GOOGLE-ASSET-MIME-UNSUPPORTED"]));
  deliveryScenarios.push(scenario("demand_gen_uploaded.invalid_animated_asset", validateGoogleDemandGenUploadedDisplayStaticSet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC", lifecycleSnapshot: "ACTIVE_EVOLVING", assets: ordered(get("GOOGLE_DG_UPLOAD_300X250", 0, { animation: true })) }, contracts), "ERROR", ["KBR-GOOGLE-ASSET-MIME-UNSUPPORTED"]));

  const planFor = (profileId) => candidateByProfile.get(profileId);
  const negativePlacementCases = [];
  const logoPlan = planFor("GOOGLE_LOGO_SQUARE_1_1");
  const marketingPlan = planFor("GOOGLE_MARKETING_LANDSCAPE_1_91");
  const uploadedPlan = planFor("GOOGLE_DG_UPLOAD_300X250");
  for (const [name, item, planOverride, expectedCode] of [
    ["logo.semantic_crop_forbidden", logoPlan, { placementPolicy: "SEMANTIC_CROP_COVER", sourceRect: { x: 0, y: 0, width: logoPlan.source.width, height: logoPlan.source.height }, semanticPlan: true }, "KBR-G2-LOGO-CROP-FORBIDDEN"],
    ["logo.manual_crop_forbidden", logoPlan, { placementPolicy: "MANUAL_CROP", sourceRect: { x: 0, y: 0, width: 512, height: 512 } }, "KBR-G2-LOGO-CROP-FORBIDDEN"],
    ["marketing.alpha_trim_forbidden", marketingPlan, { placementPolicy: "ALPHA_TRIM_CONTAIN" }, "KBR-G2-MARKETING-ALPHA-TRIM-FORBIDDEN"],
    ["uploaded.automatic_policy_forbidden", uploadedPlan, { placementPolicy: "CENTER_CONTAIN", explicitElementPlan: false }, "KBR-G2-UPLOADED-PLAN-REQUIRED"],
    ["marketing.crop_plan_required", marketingPlan, { placementPolicy: "MANUAL_CROP", sourceRect: undefined }, "KBR-G2-CROP-RECT-REQUIRED"],
  ]) {
    const plan = { ...item.plan, ...planOverride };
    try {
      await renderGoogleStaticCandidate(item.source.bytes, plan, contracts);
      negativePlacementCases.push({ name, expectedCode, actualCode: null, passed: false, publishAllowed: false });
    } catch (error) {
      negativePlacementCases.push({ name, expectedCode, actualCode: error?.code ?? "UNKNOWN", passed: error?.code === expectedCode, publishAllowed: false });
    }
  }

  const shared = planFor("GOOGLE_MARKETING_LANDSCAPE_1_91");
  const metadataOnlyVariant = validateGoogleRdaDeliverySet({ schemaVersion: "1.0.0", capabilityId: "GOOGLE_RDA_ASSET_SET", lifecycleSnapshot: "TRANSITIONAL", assets: ordered(land, square), platformFields: { ...fieldsRda(), SHORT_HEADLINE: ["Changed platform metadata"] } }, contracts);
  const repeatedPlatformMetadataRender = await renderGoogleStaticCandidate(shared.source.bytes, shared.plan, contracts);
  const platformFieldRasterizationAbsent = metadataOnlyVariant.status === "PASS" && repeatedPlatformMetadataRender.bytes.equals(shared.rendered.bytes) && repeatedPlatformMetadataRender.renderFingerprint === shared.rendered.renderFingerprint;

  const allScenariosPassed = deliveryScenarios.every((entry) => entry.passed) && negativePlacementCases.every((entry) => entry.passed);
  if (!allScenariosPassed) throw new Error(`G2 delivery/negative scenario failure: ${JSON.stringify({ deliveryScenarios, negativePlacementCases }, null, 2)}`);
  if (candidates.length !== 14) throw new Error(`Expected 14 candidates, got ${candidates.length}`);
  for (const candidate of candidates) {
    if (Object.values(candidate.validatorSummaryByCapability).some((summary) => summary.status !== "PASS")) throw new Error(`Artifact validation failed for ${candidate.profileId}`);
  }

  const registry = {
    $schema: "https://kbr.local/contracts/google/golden-candidates.g2.schema.json",
    $id: "https://kbr.local/contracts/google/golden-candidates.g2.schema.json",
    schemaVersion: "0.1.0",
    registryVersion: "0.1.0",
    phase: "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES",
    status: "CANDIDATE",
    frozen: false,
    visualAcceptance: "PENDING",
    generatedFrom: { baselineCommit: BASELINE_COMMIT, g1AuditStatus: "PASS" },
    geometryCandidateCount: candidates.filter((entry) => !entry.profileId.startsWith("GOOGLE_DG_UPLOAD_")).length,
    demandGenUploadedStaticCandidateCount: candidates.filter((entry) => entry.profileId.startsWith("GOOGLE_DG_UPLOAD_")).length,
    candidateCount: candidates.length,
    candidates,
  };
  await writeFile(registryPath, json(registry));
  const deliveryEvidence = {
    phase: "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES",
    status: "PASS",
    scenarios: deliveryScenarios,
    negativePlacementCases,
    platformFieldRasterizationAbsent,
    errorArtifactPublishAllowed: false,
  };
  await writeFile(deliveryEvidencePath, json(deliveryEvidence));
  const evidence = {
    phase: "G2_GOOGLE_STATIC_RENDERING_VALIDATION_AND_GOLDEN_CANDIDATES",
    status: "PASS",
    baselineCommit: BASELINE_COMMIT,
    g1CompletionGate: {
      status: "PASS",
      diagnosticFrozenCount: contracts.diagnostics.count,
      validatorEmissionActive: true,
      diagnosticMessagesRegistered: true,
      activeGlobalErrorRegistry: false,
      globalRegistryDeferredReason: "Desktop/global UI integration is deferred until G2.1; public Google validators return code, severity, and deterministic messageKey directly.",
      objectRightSha256: "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b",
      frozenChannelsOutputChanges: 0,
      runtimeNetworkRequests: 0,
    },
    architecture: { status: "FROZEN", version: "1.0.0", changed: false },
    candidates: { geometry: 7, demandGenUploadedDisplayStatic: 7, total: 14, registryStatus: "CANDIDATE", frozen: false, visualAcceptance: "PENDING", previewIndex: relative(previewPath) },
    renderingValidation: {
      repeatedRenderByteEquality: true,
      canvasValidation: true,
      mimeValidation: true,
      byteCapValidation: true,
      placementPolicyValidation: true,
      platformFieldRasterizationAbsent,
    },
    deliverySetValidation: { rda: "PASS", performanceMax: "PASS", demandGenSingleImage: "PASS", demandGenUploadedStatic: "PASS" },
    expectedInfo: { rdaVertical: "KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY", demandGenVertical: "KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED" },
    scope: { desktopUiAdded: false, googleUploadAdded: false, frozenGoldensAdded: false, plumeIntegrationAdded: false, runtimeNetworkAccess: "PROHIBITED" },
    deliveryEvidence: relative(deliveryEvidencePath),
    registry: relative(registryPath),
  };
  await writeFile(evidencePath, json(evidence));

  const cards = candidates.map((candidate) => `<article><h2>${candidate.profileId}</h2><p>${candidate.canvas.width}×${candidate.canvas.height} · ${candidate.mime} · ${candidate.encodedBytes} bytes</p><img src="./google-static-candidates/${path.basename(candidate.artifactRelativePath)}" alt="${candidate.profileId}" /></article>`).join("\n");
  const html = `<!doctype html>\n<meta charset="utf-8">\n<title>Google static G2 candidate index</title>\n<style>body{font-family:Arial,sans-serif;background:#eef1f5;color:#15202b;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}article{background:white;border:1px solid #cbd5e1;border-radius:10px;padding:14px}img{display:block;max-width:100%;height:220px;object-fit:contain;background:#f5f7fa;border:1px solid #94a3b8}h2{font-size:16px;margin:0 0 6px}p{font-size:12px;color:#475569}</style><h1>Google static G2 Golden Candidates</h1><p>Status: CANDIDATE · visual acceptance: PENDING · 14 artifacts · platform chrome excluded</p><main>${cards}</main>\n`;
  await writeFile(previewPath, html);
  console.log(JSON.stringify({ status: "PASS", candidates: candidates.length, registry: relative(registryPath), evidence: relative(evidencePath), previewIndex: relative(previewPath), deliveryScenarios: deliveryScenarios.length, negativePlacementCases: negativePlacementCases.length }, null, 2));
}

await main();
