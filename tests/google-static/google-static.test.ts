import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadGoogleStaticContracts,
  listGoogleStaticProfiles,
  resolveGoogleStaticProfile,
  validateGoogleCreativeAssetSetManifest,
  validateGoogleDemandGenUploadedDisplayStaticSet,
  validateGooglePerformanceMaxDeliverySet,
  validateGoogleRdaDeliverySet,
  type CreativeAssetSetManifest,
  type GoogleAssetArtifact,
} from "../../src/core/index.js";

const projectRoot = path.resolve(process.cwd());

function artifact(profileId: string, role: string, ordinal: number, bytes = 1000): GoogleAssetArtifact {
  const dimensions: Record<string, [number, number]> = {
    GOOGLE_MARKETING_LANDSCAPE_1_91: [1200, 628],
    GOOGLE_MARKETING_SQUARE_1_1: [1200, 1200],
    GOOGLE_MARKETING_PORTRAIT_4_5: [960, 1200],
    GOOGLE_LOGO_SQUARE_1_1: [1200, 1200],
    GOOGLE_DG_UPLOAD_300X250: [300, 250],
  };
  const [width, height] = dimensions[profileId] ?? [900, 1600];
  return { artifactId: `${profileId}-${ordinal}`, assetProfileId: profileId, role, ordinal, width, height, mime: "image/png", bytes };
}

describe("Google G1 static contracts", () => {
  it("loads fourteen deterministic profiles and no legacy runtime profiles", async () => {
    const contracts = await loadGoogleStaticContracts(projectRoot);
    expect(listGoogleStaticProfiles(contracts)).toHaveLength(14);
    expect(contracts.profiles.geometryProfiles).toHaveLength(7);
    expect(contracts.profiles.uploadedDisplayStaticProfiles).toHaveLength(7);
    expect(contracts.profiles.legacyDisplayRuntimeProfiles).toHaveLength(0);
    expect(resolveGoogleStaticProfile("GOOGLE_MARKETING_LANDSCAPE_1_91", contracts)?.projectOutputPreset).toEqual({ width: 1200, height: 628 });
  });

  it("passes a minimal RDA collection and keeps platform fields as metadata", async () => {
    const contracts = await loadGoogleStaticContracts(projectRoot);
    const manifest: CreativeAssetSetManifest = {
      schemaVersion: "1.0.0",
      capabilityId: "GOOGLE_RDA_ASSET_SET",
      lifecycleSnapshot: "TRANSITIONAL",
      assets: [
        artifact("GOOGLE_MARKETING_LANDSCAPE_1_91", "LANDSCAPE_MARKETING_IMAGE", 0),
        artifact("GOOGLE_MARKETING_SQUARE_1_1", "SQUARE_MARKETING_IMAGE", 1),
      ],
      platformFields: {
        SHORT_HEADLINE: ["Short"],
        LONG_HEADLINE: ["A long headline"],
        DESCRIPTION: ["Description"],
        BUSINESS_NAME: ["Business"],
        CTA: "GOOGLE_PLATFORM",
        FINAL_URL: "https://example.invalid",
      },
    };
    const result = validateGoogleRdaDeliverySet(manifest, contracts);
    expect(result.status).toBe("PASS");
    expect(result.errors).toHaveLength(0);
    expect(result.info).toHaveLength(0);
    expect(manifest.platformFields?.CTA).toBe("GOOGLE_PLATFORM");
  });

  it("fails deterministically for unknown profile, canvas, MIME, and byte cap", async () => {
    const contracts = await loadGoogleStaticContracts(projectRoot);
    const manifest: CreativeAssetSetManifest = {
      schemaVersion: "1.0.0",
      capabilityId: "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC",
      lifecycleSnapshot: "ACTIVE_EVOLVING",
      assets: [
        { ...artifact("GOOGLE_DG_UPLOAD_300X250", "UPLOADED_DISPLAY_STATIC", 0, 150001), width: 301, mime: "image/gif" },
        { ...artifact("UNKNOWN_PROFILE", "UPLOADED_DISPLAY_STATIC", 1), width: 300, height: 250 },
      ],
    };
    const result = validateGoogleDemandGenUploadedDisplayStaticSet(manifest, contracts);
    expect(result.status).toBe("ERROR");
    expect(result.errors.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "KBR-GOOGLE-ASSET-CANVAS-MISMATCH",
      "KBR-GOOGLE-ASSET-MIME-UNSUPPORTED",
      "KBR-GOOGLE-ASSET-BYTES-EXCEEDED",
      "KBR-GOOGLE-ASSET-PROFILE-UNKNOWN",
    ]));
    expect(result.errors).toEqual([...result.errors].sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code) || left.messageKey.localeCompare(right.messageKey)));
  });

  it("enforces PMax non-retail copy counts and brand association discriminator", async () => {
    const contracts = await loadGoogleStaticContracts(projectRoot);
    const manifest: CreativeAssetSetManifest = {
      schemaVersion: "1.0.0",
      capabilityId: "GOOGLE_PMAX_ASSET_GROUP_STATIC",
      lifecycleSnapshot: "ACTIVE",
      brandGuidelinesEnabled: true,
      assets: [
        artifact("GOOGLE_MARKETING_LANDSCAPE_1_91", "MARKETING_IMAGE", 0),
        artifact("GOOGLE_MARKETING_SQUARE_1_1", "SQUARE_MARKETING_IMAGE", 1),
        artifact("GOOGLE_LOGO_SQUARE_1_1", "SQUARE_LOGO", 2),
      ],
      platformFields: {
        HEADLINE: ["One", "Two", "Three"],
        LONG_HEADLINE: ["Long"],
        DESCRIPTION: ["One", "Two"],
        BUSINESS_NAME: ["Business"],
      },
    };
    expect(validateGooglePerformanceMaxDeliverySet(manifest, contracts).status).toBe("PASS");
    const mismatch = validateGooglePerformanceMaxDeliverySet({ ...manifest, brandGuidelinesEnabled: false, assets: manifest.assets.slice(0, 2) }, contracts);
    expect(mismatch.errors.some((issue) => issue.code === "KBR-GOOGLE-PMAX-BRAND-ASSOCIATION-MODE-MISMATCH")).toBe(true);
  });

  it("rejects non-deterministic ordinals and preserves transitional INFO", async () => {
    const contracts = await loadGoogleStaticContracts(projectRoot);
    const manifest: CreativeAssetSetManifest = {
      schemaVersion: "1.0.0",
      capabilityId: "GOOGLE_LEGACY_UPLOADED_DISPLAY_STATIC",
      lifecycleSnapshot: "TRANSITIONAL",
      assets: [artifact("GOOGLE_MARKETING_LANDSCAPE_1_91", "UPLOADED_DISPLAY_STATIC", 2)],
    };
    const result = validateGoogleCreativeAssetSetManifest(manifest, contracts);
    expect(result.errors.some((issue) => issue.code === "KBR-GOOGLE-SET-ROLE-CARDINALITY-EXCEEDED")).toBe(true);
    expect(result.info.some((issue) => issue.code === "KBR-GOOGLE-LIFECYCLE-TRANSITIONAL")).toBe(true);
  });
});
