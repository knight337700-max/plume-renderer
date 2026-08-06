import { z } from "zod";

const token = z.uuid();
const boundedText = z.string().max(1_000);
const jobName = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9._-]+$/u);

export const previewRequestSchema = z.strictObject({
  assetToken: token,
  advertiser: boundedText,
  headline: boundedText,
  subcopy: boundedText,
  jobName,
  requestSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  template: z.enum(["OBJECT_RIGHT", "THUMBNAIL_BOX_RIGHT"]).optional(),
  placementPlan: z.unknown().optional(),
  cropCandidates: z.array(z.unknown()).optional(),
});

export const exportRequestSchema = z.strictObject({
  assetToken: token,
  advertiser: boundedText,
  headline: boundedText,
  subcopy: boundedText,
  jobName,
  previewToken: token,
  outputDirectoryToken: token,
  template: z.enum(["OBJECT_RIGHT", "THUMBNAIL_BOX_RIGHT"]).optional(),
  placementPlan: z.unknown().optional(),
  cropCandidates: z.array(z.unknown()).optional(),
});

export const revealRequestSchema = token;

export function parseIpcPayload<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("DESKTOP-IPC-001:malformed_payload");
  return parsed.data;
}
