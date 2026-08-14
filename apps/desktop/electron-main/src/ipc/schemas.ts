import { z } from "zod";

const token = z.uuid();
const boundedText = z.string().max(1_000);
const diagnosticText = z.string().max(16_000);
const jobName = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._-]+$/u);

const metaPlatformCopySchema = z.strictObject({
  primaryText: boundedText.optional(),
  headline: boundedText.optional(),
  description: boundedText.optional(),
  callToAction: boundedText.optional(),
  destinationUrl: boundedText.optional(),
});

const metaStaticSchema = z.strictObject({
  mode: z.enum(["SINGLE", "PLACEMENT_SET"]).optional(),
  placementContext: boundedText.optional(),
  conceptId: z.string().min(1).max(200).optional(),
  platformCopy: metaPlatformCopySchema.optional(),
  variants: z.record(z.string().min(1).max(200), z.unknown()).optional(),
});

const freeformRequestSchema = z.strictObject({
  formatProfileId: z.string().min(1).max(200),
  creativeLayoutPlan: z.unknown(),
  placementContext: boundedText.optional(),
  assetTokens: z.record(z.string().min(1).max(200), token),
  outputFormat: z.enum(["PNG", "JPEG"]),
  outputQuality: z.union([z.number().finite().min(1).max(100), z.literal("AUTO_FIT")]).optional(),
  outputMode: z.enum(["SINGLE", "PLACEMENT_SET"]).optional(),
  metaStatic: metaStaticSchema.optional(),
});

const googleStaticRectSchema = z.strictObject({
  x: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  y: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  width: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  height: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});

const googleStaticBackgroundSchema = z.strictObject({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  alpha: z.number().int().min(0).max(255),
});

const googleStaticRequestSchema = z.strictObject({
  profileId: z.string().min(1).max(200),
  capabilityId: z.string().min(1).max(200).optional(),
  placementPolicy: z.enum(["NONE", "CENTER_CONTAIN", "MANUAL_CROP", "SEMANTIC_CROP_COVER", "ALPHA_TRIM_CONTAIN"]),
  sourceRect: googleStaticRectSchema.optional(),
  destinationRect: googleStaticRectSchema,
  background: googleStaticBackgroundSchema,
  explicitElementPlan: z.boolean().optional(),
  semanticPlan: z.boolean().optional(),
  outputFormat: z.enum(["PNG", "JPEG"]),
  jpegQuality: z.number().int().min(1).max(100).optional(),
  deliveryMetadata: z.record(z.string().min(1).max(200), z.unknown()).optional(),
});

const naverSmartChannelRequestSchema = z.strictObject({
  kind: z.literal("SMARTCHANNEL"),
  templateId: z.string().min(1).max(240),
  content: z.record(z.string().min(1).max(80), boundedText),
  objectAssetToken: token,
  advertiserLogoAssetToken: token.optional(),
  jobName,
});

const naverSourceAssetRequestSchema = z.strictObject({
  assetId: z.string().min(1).max(160),
  assetRole: z.string().min(1).max(160),
  sourceProfileId: z.string().min(1).max(200),
  assetToken: token,
});

const naverCollectionItemRequestSchema = z.strictObject({
  id: z.string().min(1).max(120),
  assetId: z.string().min(1).max(160),
  sourceProfileId: z.string().min(1).max(200),
  assetToken: token,
  fields: z.record(z.string().min(1).max(80), z.unknown()),
});

const naverPlatformSourceRequestSchema = z.strictObject({
  kind: z.literal("PLATFORM_SOURCE"),
  placement: z.enum(["MOBILE_NATIVE", "PC_NATIVE", "SHOPPING_NEWS", "COMMUNICATION_AD", "MOBILE_DA_FEED"]),
  sourceProfileId: z.string().min(1).max(200),
  fields: z.record(z.string().min(1).max(80), z.unknown()),
  assets: z.array(naverSourceAssetRequestSchema).max(32),
  collectionItems: z.array(naverCollectionItemRequestSchema).max(10).optional(),
  jobName,
});

const naverRequestSchema = z.union([naverSmartChannelRequestSchema, naverPlatformSourceRequestSchema]);

export const naverPreviewRequestSchema = z.strictObject({
  requestSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  request: naverRequestSchema,
});

export const naverExportRequestSchema = z.strictObject({
  request: naverRequestSchema,
  previewToken: token.optional(),
  previewFingerprint: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  outputDirectoryToken: token,
});

export const previewRequestSchema = z.strictObject({
  assetToken: token,
  secondaryAssetToken: token.optional(),
  logoAssetToken: token.optional(),
  advertiser: boundedText,
  headline: boundedText,
  subcopy: boundedText,
  jobName,
  requestSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  layoutMode: z.enum(["TEMPLATE_LOCKED", "FREEFORM"]).optional(),
  template: z.enum(["OBJECT_RIGHT", "THUMBNAIL_BOX_RIGHT", "THUMBNAIL_MULTI_RIGHT", "MASK_SEMICIRCLE_RIGHT"]).optional(),
  freeform: freeformRequestSchema.optional(),
  placementPlan: z.unknown().optional(),
  placementPlans: z.array(z.unknown()).optional(),
  cropCandidates: z.array(z.unknown()).optional(),
  googleStatic: googleStaticRequestSchema.optional(),
});

export const exportRequestSchema = z.strictObject({
  assetToken: token,
  secondaryAssetToken: token.optional(),
  logoAssetToken: token.optional(),
  advertiser: boundedText,
  headline: boundedText,
  subcopy: boundedText,
  jobName,
  previewToken: token,
  outputDirectoryToken: token,
  layoutMode: z.enum(["TEMPLATE_LOCKED", "FREEFORM"]).optional(),
  template: z.enum(["OBJECT_RIGHT", "THUMBNAIL_BOX_RIGHT", "THUMBNAIL_MULTI_RIGHT", "MASK_SEMICIRCLE_RIGHT"]).optional(),
  freeform: freeformRequestSchema.optional(),
  placementPlan: z.unknown().optional(),
  placementPlans: z.array(z.unknown()).optional(),
  cropCandidates: z.array(z.unknown()).optional(),
  googleStatic: googleStaticRequestSchema.optional(),
});

export const revealRequestSchema = token;

export const rendererDiagnosticSchema = z.strictObject({
  kind: z.enum(["window_error", "unhandled_rejection", "react_error_boundary", "console_error", "renderer_crash", "renderer_unresponsive"]),
  timestamp: z.string().datetime().optional(),
  channel: z.enum(["KAKAO", "NAVER", "META", "GOOGLE"]).optional(),
  placement: z.string().max(200).optional(),
  subtype: z.string().max(100).optional(),
  templateId: z.string().max(240).optional(),
  selectedDimensions: z.strictObject({
    height: z.union([z.number().finite(), z.string().max(100)]).optional(),
    family: z.string().max(100).optional(),
    objectKind: z.string().max(100).optional(),
    side: z.string().max(100).optional(),
    textVariant: z.string().max(100).optional(),
    affordance: z.string().max(100).optional(),
  }).optional(),
  name: diagnosticText.optional(),
  message: diagnosticText,
  stack: diagnosticText.optional(),
  componentStack: diagnosticText.optional(),
  source: z.enum(["renderer", "electron-main"]).optional(),
});

export function parseIpcPayload<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("DESKTOP-IPC-001:malformed_payload");
  return parsed.data;
}
