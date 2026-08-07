import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CreativeLayoutPlan } from "@kbr/renderer-contract";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { encodeFreeformArtifact, renderFreeform, type FreeformRenderRequest } from "../../src/core/index.js";
import { projectRoot } from "../helpers.js";

const imagePath = "fixtures/valid/object-right__product__basic__pass.png";

const implementedProfiles = {
  KAKAO_DISPLAY_NATIVE_2_1: { width: 1200, height: 600, png: "98a20a7feb0d87d4ab54792b8ffa4ab29c3280d6fbbb4b8f001f8b39cea0bf8e" },
  KAKAO_DISPLAY_NATIVE_1_1: { width: 500, height: 500, png: "607f987254e4d90ad64962e9dd14b3513c63b7b0d869c49042d08775b56976ff" },
  KAKAO_DISPLAY_NATIVE_9_16: { width: 720, height: 1280, png: "e2bceb0a4aca157c78beca1d68290746affee079e0a9ac1297f16d8a4668fad2" },
  KAKAO_DISPLAY_NATIVE_4_5: { width: 800, height: 1000, png: "1ed49e4ad02154dc15504f55b6c8d7e12152d305bef5defd68e3f4a7375f8fdb" },
  KAKAO_DISPLAY_CATALOG_SLIDE_1_1: { width: 500, height: 500, png: "607f987254e4d90ad64962e9dd14b3513c63b7b0d869c49042d08775b56976ff" },
  KAKAO_VIDEO_NATIVE_THUMBNAIL_16_9: { width: 1280, height: 720, png: "fceccff9a14b5870ec772f847ec2102659b5b5b6c92b4837b91ae3baf7a9995c" },
  KAKAO_VIDEO_NATIVE_THUMBNAIL_9_16: { width: 720, height: 1280, png: "e2bceb0a4aca157c78beca1d68290746affee079e0a9ac1297f16d8a4668fad2" },
  KAKAO_VIDEO_NATIVE_SLIDE_1_1: { width: 500, height: 500, png: "607f987254e4d90ad64962e9dd14b3513c63b7b0d869c49042d08775b56976ff" },
  KAKAO_BIZBOARD_EXPANDABLE_IMAGE_2_1: { width: 1200, height: 600, png: "98a20a7feb0d87d4ab54792b8ffa4ab29c3280d6fbbb4b8f001f8b39cea0bf8e" },
  KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1: { width: 1080, height: 1080, png: "0d43010a0f8769af417980d758ed161bd30d8e57878779b48df3abced7ddde76" },
  KAKAO_ADVIEW_FULL_IMAGE: { width: 720, height: 1560, png: "2893cdf5f473900b31192f2c9551f3c6d3b4013b8a69353030bbed6b75b1dd34" },
  KAKAO_ADVIEW_COMPACT_IMAGE: { width: 1280, height: 720, png: "fceccff9a14b5870ec772f847ec2102659b5b5b6c92b4837b91ae3baf7a9995c" },
  KAKAO_ADVIEW_CAROUSEL_IMAGE: { width: 1280, height: 720, png: "fceccff9a14b5870ec772f847ec2102659b5b5b6c92b4837b91ae3baf7a9995c" },
  KAKAO_ADVIEW_SHARE_BUBBLE_IMAGE: { width: 1280, height: 720, png: "fceccff9a14b5870ec772f847ec2102659b5b5b6c92b4837b91ae3baf7a9995c" },
} as const;

type ImplementedProfileId = keyof typeof implementedProfiles;

function planFor(formatProfileId: string, elements: CreativeLayoutPlan["elements"] = []): CreativeLayoutPlan {
  return {
    schemaVersion: "1.0.0",
    formatProfileId,
    source: "MANUAL",
    background: { type: "SOLID", color: "#FFFFFFFF" },
    elements: elements.length > 0 ? elements : [{
      id: "image",
      type: "IMAGE",
      assetId: "image",
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      zIndex: 0,
      placement: { policy: "CENTER_CONTAIN", source: "MANUAL", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" },
    }],
  };
}

function requestFor(formatProfileId: string, format: "PNG" | "JPEG" = "PNG", plan = planFor(formatProfileId)): FreeformRenderRequest {
  return {
    layoutMode: "FREEFORM",
    formatProfileId,
    creativeLayoutPlan: plan,
    assets: [{ assetId: "image", path: imagePath, mimeType: "image/png" }],
    output: { format, ...(format === "JPEG" ? { quality: "AUTO_FIT" as const } : {}) },
  };
}

async function render(request: FreeformRenderRequest) {
  return renderFreeform(request, { projectRoot, inputRoot: projectRoot, outputRoot: projectRoot, publish: false });
}

describe("Kakao Moment F3A fixed FREEFORM profiles", () => {
  it("renders deterministic PNG Goldens for every implemented Profile", async () => {
    for (const formatProfileId of Object.keys(implementedProfiles) as ImplementedProfileId[]) {
      const expected = implementedProfiles[formatProfileId];
      const runs = await Promise.all([render(requestFor(formatProfileId)), render(requestFor(formatProfileId)), render(requestFor(formatProfileId))]);
      for (const result of runs) {
        expect(result.status).toBe("PASS");
        expect(result.formatProfileId).toBe(formatProfileId);
        expect(result.pngDigest).toBe(expected.png);
        expect(result.png).toBeInstanceOf(Buffer);
        const metadata = await sharp(result.png as Buffer).metadata();
        expect({ width: metadata.width, height: metadata.height, format: metadata.format }).toEqual({ width: expected.width, height: expected.height, format: "png" });
      }
      expect(new Set(runs.map((result) => result.pngDigest)).size).toBe(1);
    }
  });

  it("renders deterministic JPEG with resolved encoding metadata for every fixed Profile", async () => {
    for (const formatProfileId of Object.keys(implementedProfiles) as ImplementedProfileId[]) {
      const [first, second, third] = await Promise.all([render(requestFor(formatProfileId, "JPEG")), render(requestFor(formatProfileId, "JPEG")), render(requestFor(formatProfileId, "JPEG"))]);
      expect(first.status).toBe("PASS");
      expect(first.pngDigest).toBe(second.pngDigest);
      expect(second.pngDigest).toBe(third.pngDigest);
      expect(first.artifactFormat).toBe("JPEG");
      expect(first.outputEncoding).toMatchObject({ format: "JPEG", qualityRequested: "AUTO_FIT", chromaSubsampling: "4:2:0", progressive: false, metadataStripped: true });
      expect(first.outputEncoding?.qualityResolved).toBeGreaterThanOrEqual(48);
      const metadata = await sharp(first.png as Buffer).metadata();
      expect({ width: metadata.width, height: metadata.height, format: metadata.format }).toEqual({ width: implementedProfiles[formatProfileId].width, height: implementedProfiles[formatProfileId].height, format: "jpeg" });
      expect(metadata.exif).toBeUndefined();
    }
  });

  it("fails closed for transparent JPEG, required safe zones, and catalog-only variable canvas", async () => {
    const transparentPlan = { ...planFor("KAKAO_DISPLAY_NATIVE_1_1"), background: { type: "TRANSPARENT" as const } };
    const transparent = await render(requestFor("KAKAO_DISPLAY_NATIVE_1_1", "JPEG", transparentPlan));
    expect(transparent.status).toBe("BLOCKED");
    expect(transparent.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-JPEG-TRANSPARENT-BACKGROUND-NOT-SUPPORTED");
    const transparentPng = await render(requestFor("KAKAO_DISPLAY_NATIVE_1_1", "PNG", transparentPlan));
    expect(transparentPng.status).toBe("BLOCKED");
    expect(transparentPng.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-OPAQUE-OUTPUT-REQUIRED");

    const requiredZonePlan = planFor("KAKAO_DISPLAY_NATIVE_9_16", [{
      id: "text",
      type: "TEXT",
      text: "safe",
      fontId: "SPOQA_HAN_SANS_BOLD",
      fontSizePx: 24,
      color: "#202020",
      lineHeightPx: 28,
      textAlign: "LEFT",
      verticalAlign: "TOP",
      wrapMode: "NO_WRAP",
      overflowMode: "ERROR",
      bounds: { x: 0, y: 0, width: 0.2, height: 0.1 },
      zIndex: 1,
    }]);
    const zone = await render(requestFor("KAKAO_DISPLAY_NATIVE_9_16", "PNG", requiredZonePlan));
    expect(zone.status).toBe("BLOCKED");
    expect(zone.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-SAFE-ZONE-VIOLATION");

    const scroll = await render(requestFor("KAKAO_ADVIEW_SCROLL_IMAGE"));
    expect(scroll.status).toBe("BLOCKED");
    expect(scroll.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-FORMAT-NOT-IMPLEMENTED");
  });

  it("enforces IMAGE-only Expandable Multi and collection metadata without changing request arrays", async () => {
    const textPlan = planFor("KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1", [{
      id: "text",
      type: "TEXT",
      text: "not allowed",
      fontId: "SPOQA_HAN_SANS_BOLD",
      fontSizePx: 20,
      color: "#202020",
      lineHeightPx: 24,
      textAlign: "LEFT",
      verticalAlign: "TOP",
      wrapMode: "NO_WRAP",
      overflowMode: "ERROR",
      bounds: { x: 0.1, y: 0.1, width: 0.5, height: 0.2 },
      zIndex: 1,
    }]);
    const blocked = await render(requestFor("KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1", "PNG", textPlan));
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.errors.map((entry) => entry.code)).toContain("KBR-FREEFORM-ELEMENT-NOT-ALLOWED-FOR-PROFILE");
    const registry = JSON.parse(await readFile(path.join(projectRoot, "contracts/freeform-format-profiles.json"), "utf8")) as { profiles: Array<{ formatProfileId: string; collectionRule?: { minImages?: number; maxImages?: number } }> };
    expect(registry.profiles.find((profile) => profile.formatProfileId === "KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1")?.collectionRule).toMatchObject({ minImages: 3, maxImages: 5 });
  });

  it("keeps the JPEG quality ladder deterministic and fails when a target is impossible", async () => {
    const png = (await render(requestFor("KAKAO_DISPLAY_NATIVE_2_1", "PNG"))).png as Buffer;
    const first = await encodeFreeformArtifact(png, "JPEG", { maximumBytes: 1, maximumBytesComparator: "LTE" });
    const second = await encodeFreeformArtifact(png, "JPEG", { maximumBytes: 1, maximumBytesComparator: "LTE" });
    expect(first).toBeNull();
    expect(second).toBeNull();
  });
});
