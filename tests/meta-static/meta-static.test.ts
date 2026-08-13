import { describe, expect, it } from "vitest";

import {
  META_STATIC_PROFILE_ORDER,
  renderMetaStatic,
  type MetaStaticPlacementSetRequest,
} from "../../src/core/index.js";
import type { CreativeLayoutPlan } from "@kbr/renderer-contract";
import { projectRoot } from "../helpers.js";

const basePlan = (formatProfileId: string, y = 0.35): CreativeLayoutPlan => ({
  schemaVersion: "1.0.0",
  formatProfileId,
  source: "MANUAL",
  background: { type: "SOLID", color: "#FFFFFF" },
  elements: [
    { id: "shape", type: "SHAPE", shape: "RECTANGLE", fillColor: "#FF3366", bounds: { x: 0.1, y, width: 0.8, height: 0.25 }, zIndex: 0, opacity: 1, role: "HEADLINE", safeZoneImportance: "KEY_CREATIVE" },
  ],
});

function single(profileId = "META_STATIC_FEED_SQUARE", extra: Record<string, unknown> = {}) {
  return {
    formatProfileId: profileId,
    layoutMode: "FREEFORM" as const,
    creativeLayoutPlan: basePlan(profileId),
    output: { format: "PNG" as const },
    metaStatic: { mode: "SINGLE" as const, placementContext: "FACEBOOK_FEED", ...extra },
  };
}

async function render(request: Parameters<typeof renderMetaStatic>[0]) {
  return renderMetaStatic(request, { projectRoot, inputRoot: projectRoot, outputRoot: projectRoot, publish: false });
}

describe("META static M1 renderer", () => {
  it("renders all project presets and keeps shape support scoped to META", async () => {
    for (const profileId of META_STATIC_PROFILE_ORDER) {
      const result = await render(single(profileId));
      expect(result.status).toBe("PASS");
      expect(result.png).toBeInstanceOf(Buffer);
      expect(result.pngDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.appliedElements[0]?.elementType).toBe("SHAPE");
    }
  });

  it("does not rasterize platform copy and keeps pixel/artifact bytes stable", async () => {
    const first = await render(single("META_STATIC_FEED_SQUARE", { platformCopy: { headline: "one" } }));
    const second = await render(single("META_STATIC_FEED_SQUARE", { platformCopy: { headline: "two", destinationUrl: "https://example.invalid/two" } }));
    expect(first.status).toBe("PASS");
    expect(second.status).toBe("PASS");
    expect(second.pngDigest).toBe(first.pngDigest);
    expect(second.pixelFingerprint).toBe(first.pixelFingerprint);
    expect(second.requestFingerprint).not.toBe(first.requestFingerprint);
  });

  it("emits Stories WARNING and Reels INFO without blocking export", async () => {
    const stories = await render({ ...single("META_STATIC_VERTICAL_FULL", { placementContext: "INSTAGRAM_STORIES" }), creativeLayoutPlan: basePlan("META_STATIC_VERTICAL_FULL", 0.02) });
    expect(stories.status).toBe("PASS");
    expect(stories.errors).toHaveLength(0);
    expect(stories.warnings.some((issue) => issue.code === "KBR-META-STORIES-SAFE-ZONE-WARNING")).toBe(true);
    const reels = await render(single("META_STATIC_VERTICAL_FULL", { placementContext: "INSTAGRAM_REELS" }));
    expect(reels.status).toBe("PASS");
    expect(reels.errors).toHaveLength(0);
    expect(reels.warnings).toHaveLength(0);
    if ("mode" in reels) throw new Error("single render returned collection");
    expect(reels.metaStaticReport?.reelsGeometryStatus).toBe("SOURCE_REQUIRED");
  });

  it("blocks invalid manual crop deterministically", async () => {
    const request = {
      ...single("META_STATIC_FEED_SQUARE"),
      assets: { hero: { path: "fixtures/valid/thumbnail-box-right__asset__basic__pass.png", mimeType: "image/png" as const } },
      creativeLayoutPlan: {
        ...basePlan("META_STATIC_FEED_SQUARE"),
        elements: [{ id: "hero", type: "IMAGE" as const, assetId: "hero", bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, zIndex: 0, placement: { policy: "MANUAL_CROP" as const, source: "MANUAL" as const, fitMode: "COVER" as const, cropRect: { x: -0.1, y: 0, width: 1, height: 1 }, anchor: "CENTER" as const, subjectProtection: "NONE" as const } }],
      },
    };
    const result = await render(request);
    expect(result.status).toBe("BLOCKED");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("renders a deterministic ordered placement set and blocks a missing variant", async () => {
    const variants = Object.fromEntries(META_STATIC_PROFILE_ORDER.map((profileId) => [profileId, { formatProfileId: profileId, creativeLayoutPlan: basePlan(profileId) }]));
    const request: MetaStaticPlacementSetRequest = { layoutMode: "FREEFORM", output: { format: "PNG" }, metaStatic: { mode: "PLACEMENT_SET", conceptId: "test", variants } };
    const first = await render(request);
    const second = await render(request);
    expect(first.status).toBe("PASS");
    expect(second.status).toBe("PASS");
    if (first.status !== "PASS" || second.status !== "PASS") return;
    if (!("mode" in first) || !("mode" in second)) throw new Error("placement set render returned single result");
    expect(first.collectionArtifacts.map((artifact) => artifact.profileId)).toEqual([...META_STATIC_PROFILE_ORDER]);
    expect(first.collectionFingerprint).toBe(second.collectionFingerprint);
    expect(first.collectionArtifacts.map((artifact) => artifact.sha256)).toEqual(second.collectionArtifacts.map((artifact) => artifact.sha256));
    const missing = { ...variants };
    delete missing.META_STATIC_FEED_PORTRAIT;
    const blocked = await render({ ...request, metaStatic: { ...request.metaStatic, variants: missing } });
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.errors[0]?.code).toBe("KBR-META-PLACEMENT-SET-INCOMPLETE");
  });

  it("accepts the canonical top-level placementSet envelope", async () => {
    const variants = Object.fromEntries(META_STATIC_PROFILE_ORDER.map((profileId) => [profileId, { creativeLayoutPlan: basePlan(profileId) }]));
    const result = await render({
      output: { format: "PNG" },
      placementSet: { conceptId: "alias", sharedLayerIds: ["shape"], variants },
    } as unknown as MetaStaticPlacementSetRequest);
    expect(result.status).toBe("PASS");
    if (!("mode" in result)) throw new Error("placement set alias returned single result");
    expect(result.collectionArtifacts.map((artifact) => artifact.profileId)).toEqual([...META_STATIC_PROFILE_ORDER]);
  });
});
