import { describe, expect, it } from "vitest";

import {
  NAVER_PLATFORM_SOURCE_SCHEMA_VERSION,
  normalizePlatformComposedSource,
  validatePlatformComposedSource,
  type PlatformComposedProfile,
  type PlatformComposedSourceSpec,
} from "../../src/core/naver-platform-composed.js";

const mobileProfile: PlatformComposedProfile = {
  id: "NAVER_MOBILE_NATIVE_SOURCE_V1",
  placement: "MOBILE_NATIVE",
  artifactCardinality: "SINGLE",
  fields: [
    { id: "advertiserName", type: "STRING", required: true, minLength: 1, maxLength: 14, countingUnit: "CHARACTER" },
    { id: "headline", type: "STRING", required: true, minLength: 1, maxLength: 20, countingUnit: "CHARACTER" },
    { id: "description", type: "STRING", required: true, minLength: 1, maxLength: 12, countingUnit: "CHARACTER" },
    { id: "profileName", type: "STRING", required: true, minLength: 1, maxLength: 14, countingUnit: "CHARACTER" },
    { id: "landingButton", type: "ENUM", required: true, allowedValues: ["LEARN_MORE", "NONE"] },
    { id: "adMute", type: "BOOLEAN", required: false, allowedValues: [true] },
  ],
  assets: [
    { id: "NAVER_NATIVE_THUMBNAIL_342X228", assetRole: "thumbnail", required: true, canvas: { width: 342, height: 228 }, mime: ["image/png", "image/jpeg"], fileSize: { minimumBytes: 10000, maximumBytes: 130000 } },
    { id: "NAVER_NATIVE_PROFILE_300X300", assetRole: "profileImage", required: true, canvas: { width: 300, height: 300 }, mime: ["image/png", "image/jpeg"], fileSize: { maximumBytes: 200000 } },
  ],
  runtimeStatus: "CONTRACT_ONLY",
};

const validSpec = (): PlatformComposedSourceSpec => ({
  schemaVersion: NAVER_PLATFORM_SOURCE_SCHEMA_VERSION,
  channel: "NAVER_GFA",
  placement: "MOBILE_NATIVE",
  compositionMode: "PLATFORM_COMPOSED",
  artifactCardinality: "SINGLE",
  sourceProfileId: mobileProfile.id,
  fields: { advertiserName: "광고주", headline: "새로운 소식", description: "지금 확인", profileName: "광고주", landingButton: "LEARN_MORE", adMute: true },
  assets: [
    { assetId: "thumb", assetRole: "thumbnail", sourceProfileId: "NAVER_NATIVE_THUMBNAIL_342X228", mime: "image/jpeg", width: 342, height: 228, bytes: 10000 },
    { assetId: "profile", assetRole: "profileImage", sourceProfileId: "NAVER_NATIVE_PROFILE_300X300", mime: "image/png", width: 300, height: 300, bytes: 200000 },
  ],
});

describe("NAVER Platform-Composed source contract", () => {
  it("validates source fields/assets without creating final UI output", () => {
    const result = validatePlatformComposedSource(validSpec(), mobileProfile);
    expect(result.status).toBe("WARNING");
    expect(result.errors).toHaveLength(0);
    expect(result.finalUiRendered).toBe(false);
    expect(result.pixelFingerprint).toBeNull();
    expect(result.warnings[0]?.code).toBe("KBR-NAVER-SOURCE-RUNTIME-DEFERRED");
  });

  it("sorts and reports deterministic source errors", () => {
    const invalid = { ...validSpec(), fields: { ...validSpec().fields, headline: "가나다라마바사아자차카타파하가나다라마바사아자차카타파하" }, finalCanvas: { width: 1, height: 1 } } as PlatformComposedSourceSpec & { finalCanvas: unknown };
    const result = validatePlatformComposedSource(invalid, mobileProfile);
    expect(result.status).toBe("ERROR");
    expect(result.errors.map((entry) => entry.code)).toEqual([
      "KBR-NAVER-SOURCE-FIELD-LENGTH",
      "KBR-NAVER-SOURCE-FINAL-GEOMETRY-FORBIDDEN",
    ]);
  });

  it("normalizes Unicode NFC but preserves user copy and array order", () => {
    const source = validSpec();
    const normalized = normalizePlatformComposedSource({ ...source, fields: { ...source.fields, headline: "가" }, assets: [...source.assets].reverse() });
    expect(normalized.fields.headline).toBe("가");
    expect(normalized.assets.map((asset) => asset.assetId)).toEqual(["profile", "thumb"]);
  });

  it("treats an exact source canvas as authoritative when a guide ratio label is rounded", () => {
    const profile: PlatformComposedProfile = {
      id: "NAVER_FEED_IMAGE_SOURCE_V1",
      placement: "MOBILE_DA_FEED",
      artifactCardinality: "SINGLE",
      fields: [],
      assets: [{
        id: "NAVER_FEED_IMAGE_16_9",
        assetRole: "adImage",
        required: true,
        canvas: { width: 1200, height: 628 },
        aspectRatio: "16:9",
        mime: ["image/jpeg"],
      }],
      runtimeStatus: "CONTRACT_ONLY",
    };
    const result = validatePlatformComposedSource({
      schemaVersion: NAVER_PLATFORM_SOURCE_SCHEMA_VERSION,
      channel: "NAVER_GFA",
      placement: "MOBILE_DA_FEED",
      compositionMode: "PLATFORM_COMPOSED",
      artifactCardinality: "SINGLE",
      sourceProfileId: profile.id,
      fields: {},
      assets: [{ assetId: "wide", assetRole: "adImage", sourceProfileId: "NAVER_FEED_IMAGE_16_9", mime: "image/jpeg", width: 1200, height: 628, bytes: 100000 }],
    }, profile);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.map((entry) => entry.code)).toEqual(["KBR-NAVER-SOURCE-RUNTIME-DEFERRED"]);
  });
});
