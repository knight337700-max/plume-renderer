import defaultPlacementRegistry from "../../../../contracts/google/default-placement-plans.g3.0.4.json" with { type: "json" };
import { INTEGRATION_SCHEMA_VERSION, normalizedRectToPixelRect } from "../../../../packages/renderer-contract/src/index.js";
import type {
  GoogleStaticPlacementTransform,
  GoogleStaticPlacementPlan,
  GoogleStaticUiRequest,
} from "./types.js";

type GoogleProfileLike = Readonly<{
  profileId: string;
  role: string;
  projectOutputPreset: Readonly<{ width: number; height: number }>;
}>;

type GoogleAssetLike = Readonly<{
  checksumSha256: string;
  detectedMimeType?: "image/png" | "image/jpeg";
  width: number;
  height: number;
}>;

type DefaultEntry = (typeof defaultPlacementRegistry.entries)[number];

export const GOOGLE_STATIC_PRIMARY_SLOT_ID = "GOOGLE_STATIC_PRIMARY" as const;
export const GOOGLE_STATIC_DEFAULT_TRANSFORM: GoogleStaticPlacementTransform = Object.freeze({ x: 0.5, y: 0.5, scale: 1 });

export function resolveGoogleStaticDefaultPlacement(profileId: string): DefaultEntry | undefined {
  return defaultPlacementRegistry.entries.find((entry) => entry.profileId === profileId);
}

function quantize(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizedCrop(entry: DefaultEntry): { x: number; y: number; width: number; height: number } | undefined {
  if (!entry.sourceRect) return undefined;
  return {
    x: quantize(entry.sourceRect.x / entry.sourceDimensions.width),
    y: quantize(entry.sourceRect.y / entry.sourceDimensions.height),
    width: quantize(entry.sourceRect.width / entry.sourceDimensions.width),
    height: quantize(entry.sourceRect.height / entry.sourceDimensions.height),
  };
}

function capabilityFor(profile: GoogleProfileLike): string {
  if (profile.role === "UPLOADED_DISPLAY_STATIC") return "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC";
  if (profile.profileId === "GOOGLE_RDA_VERTICAL_9_16") return "GOOGLE_RDA_ASSET_SET";
  if (profile.profileId.includes("LOGO")) return "GOOGLE_RDA_ASSET_SET";
  return "GOOGLE_DEMAND_GEN_SINGLE_IMAGE";
}

function planFor(entry: DefaultEntry, assetId: string, cropRect: ReturnType<typeof normalizedCrop>): GoogleStaticPlacementPlan {
  const isCrop = entry.placementPolicy === "MANUAL_CROP" || entry.placementPolicy === "SEMANTIC_CROP_COVER";
  return {
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    imageSlotId: GOOGLE_STATIC_PRIMARY_SLOT_ID,
    assetId,
    policy: entry.placementPolicy as GoogleStaticPlacementPlan["policy"],
    source: entry.placementPolicy === "MANUAL_CROP" ? "MANUAL" : "DETERMINISTIC",
    fitMode: isCrop ? "COVER" : "CONTAIN",
    ...(isCrop && cropRect ? { cropRect } : {}),
    anchor: "CENTER",
    subjectProtection: "NONE",
  };
}

export function defaultGoogleStaticRequest(
  profile: GoogleProfileLike,
  asset?: GoogleAssetLike,
): GoogleStaticUiRequest {
  const entry = resolveGoogleStaticDefaultPlacement(profile.profileId);
  if (!entry) throw new Error(`KBR-G3-0-4-DEFAULT-PLAN-MISSING: ${profile.profileId}`);
  const dimensions = asset ?? { checksumSha256: "UNBOUND_ASSET", width: entry.sourceDimensions.width, height: entry.sourceDimensions.height };
  const cropRect = normalizedCrop(entry);
  const outputFormat = entry.outputFormat;
  const sourceRect = cropRect ? normalizedRectToPixelRect(cropRect, dimensions.width, dimensions.height) : undefined;
  return {
    profileId: profile.profileId,
    capabilityId: capabilityFor(profile),
    placementPolicy: entry.placementPolicy as GoogleStaticUiRequest["placementPolicy"],
    ...(asset ? {
      sourceAsset: {
        id: GOOGLE_STATIC_PRIMARY_SLOT_ID,
        mime: asset.detectedMimeType ?? "image/png",
        width: asset.width,
        height: asset.height,
        sha256: asset.checksumSha256,
      },
    } : {}),
    placementPlan: planFor(entry, dimensions.checksumSha256, cropRect),
    ...(sourceRect ? { sourceRect } : {}),
    destinationRect: entry.destinationRect,
    background: entry.background,
    ...(entry.explicitElementPlan ? { explicitElementPlan: true } : {}),
    ...(entry.semanticPlan ? { semanticPlan: true } : {}),
    placementTransform: GOOGLE_STATIC_DEFAULT_TRANSFORM,
    outputFormat: outputFormat as "PNG" | "JPEG",
    ...(entry.jpegQuality ? { jpegQuality: entry.jpegQuality } : {}),
  };
}

function clampedCenter(center: number, size: number): number {
  return Math.min(1 - size, Math.max(0, center - size / 2));
}

function transformCrop(entry: DefaultEntry, values: GoogleStaticPlacementTransform): { cropRect: { x: number; y: number; width: number; height: number }; sourceRect: { x: number; y: number; width: number; height: number } } {
  const base = normalizedCrop(entry);
  if (!base) throw new Error(`KBR-G3-0-4-DEFAULT-PLAN-CROP-MISSING: ${entry.profileId}`);
  const width = Math.min(1, base.width / values.scale);
  const height = Math.min(1, base.height / values.scale);
  const cropRect = {
    x: quantize(clampedCenter(values.x, width)),
    y: quantize(clampedCenter(values.y, height)),
    width: quantize(width),
    height: quantize(height),
  };
  return { cropRect, sourceRect: normalizedRectToPixelRect(cropRect, entry.sourceDimensions.width, entry.sourceDimensions.height) };
}

function transformDestination(profile: GoogleProfileLike, entry: DefaultEntry, values: GoogleStaticPlacementTransform): { x: number; y: number; width: number; height: number } {
  const canvas = profile.projectOutputPreset;
  const width = Math.min(canvas.width, Math.max(1, Math.round(entry.destinationRect.width * values.scale)));
  const height = Math.min(canvas.height, Math.max(1, Math.round(entry.destinationRect.height * values.scale)));
  return {
    x: Math.min(canvas.width - width, Math.max(0, Math.round(values.x * canvas.width - width / 2))),
    y: Math.min(canvas.height - height, Math.max(0, Math.round(values.y * canvas.height - height / 2))),
    width,
    height,
  };
}

export function applyGoogleStaticPlacementTransform(
  profile: GoogleProfileLike,
  asset: GoogleAssetLike,
  values: GoogleStaticPlacementTransform,
  current?: GoogleStaticUiRequest,
): GoogleStaticUiRequest {
  const base = defaultGoogleStaticRequest(profile, asset);
  const entry = resolveGoogleStaticDefaultPlacement(profile.profileId);
  if (!entry) throw new Error(`KBR-G3-0-4-DEFAULT-PLAN-MISSING: ${profile.profileId}`);
  const basePlan = base.placementPlan;
  if (!basePlan) throw new Error(`KBR-G3-0-4-DEFAULT-PLAN-MISSING: ${profile.profileId}`);
  const isCrop = entry.placementPolicy === "MANUAL_CROP" || entry.placementPolicy === "SEMANTIC_CROP_COVER";
  const transformed = isCrop ? transformCrop(entry, values) : null;
  const placementPlan = transformed
    ? {
        ...basePlan,
        cropRect: transformed.cropRect,
        assetId: asset.checksumSha256,
      }
    : { ...basePlan, assetId: asset.checksumSha256 };
  return {
    ...base,
    ...(current?.capabilityId ? { capabilityId: current.capabilityId } : {}),
    ...(current?.deliveryMetadata ? { deliveryMetadata: current.deliveryMetadata } : {}),
    ...(transformed ? { sourceRect: normalizedRectToPixelRect(transformed.cropRect, asset.width, asset.height) } : {}),
    ...(!transformed && entry.placementPolicy !== "NONE" ? { destinationRect: transformDestination(profile, entry, values) } : {}),
    placementPlan,
    placementTransform: {
      x: quantize(values.x),
      y: quantize(values.y),
      scale: quantize(values.scale),
    },
    outputFormat: current?.outputFormat ?? base.outputFormat,
    ...(current?.outputFormat === "JPEG" || base.outputFormat === "JPEG" ? { jpegQuality: current?.jpegQuality ?? base.jpegQuality ?? 88 } : {}),
  };
}

export function defaultPlacementRegistryForVerification(): typeof defaultPlacementRegistry {
  return defaultPlacementRegistry;
}
