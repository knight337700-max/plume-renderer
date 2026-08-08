import { z } from "zod";

const token = z.uuid();
const boundedText = z.string().max(1_000);
const jobName = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._-]+$/u);

const freeformRequestSchema = z.strictObject({
  formatProfileId: z.string().min(1).max(200),
  creativeLayoutPlan: z.unknown(),
  assetTokens: z.record(z.string().min(1).max(200), token),
  outputFormat: z.enum(["PNG", "JPEG"]),
  outputQuality: z.union([z.number().finite().min(1).max(100), z.literal("AUTO_FIT")]).optional(),
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
});

export const revealRequestSchema = token;

export function parseIpcPayload<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("DESKTOP-IPC-001:malformed_payload");
  return parsed.data;
}
