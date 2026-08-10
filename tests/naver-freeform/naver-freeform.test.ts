import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import type { FormatProfile, CreativeLayoutPlan } from "@kbr/renderer-contract";
import {
  loadContracts,
  renderFreeform,
  validateFreeformPostRender,
  type FreeformRenderRequest,
} from "../../src/core/index.js";
import profilesJson from "../../contracts/freeform-format-profiles.json" with { type: "json" };
import { projectRoot } from "../helpers.js";

const profileRegistry = profilesJson as unknown as { profiles: readonly FormatProfile[] };
const mobileFixturePath = path.join(projectRoot, "fixtures/naver-freeform/mobile-da-jpeg.json");
const bannerFixturePath = path.join(projectRoot, "fixtures/naver-freeform/image-banner-1x1-png.json");

async function fixture(filePath: string): Promise<FreeformRenderRequest> {
  return JSON.parse(await readFile(filePath, "utf8")) as FreeformRenderRequest;
}

async function render(request: FreeformRenderRequest) {
  return renderFreeform(request, { projectRoot, inputRoot: projectRoot, outputRoot: projectRoot, publish: false });
}

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("Naver FREEFORM image profiles", () => {
  it("renders representative Mobile DA JPEG and Image Banner 1:1 PNG goldens", async () => {
    const mobile = await render(await fixture(mobileFixturePath));
    expect(mobile.status).toBe("PASS");
    expect(mobile.artifactFormat).toBe("JPEG");
    expect(mobile.png).toBeInstanceOf(Buffer);
    expect(digest(mobile.png as Buffer)).toBe("b3462e8129d8a2246a00905142bfcd09f3d81db72905d4b1f7cbfe708de7cf52");
    const mobileMetadata = await sharp(mobile.png as Buffer).metadata();
    expect({ width: mobileMetadata.width, height: mobileMetadata.height, format: mobileMetadata.format }).toEqual({ width: 1250, height: 560, format: "jpeg" });
    expect((mobile.png as Buffer).byteLength).toBeGreaterThanOrEqual(50000);
    expect((mobile.png as Buffer).byteLength).toBeLessThanOrEqual(250000);

    const banner = await render(await fixture(bannerFixturePath));
    expect(banner.status).toBe("PASS");
    expect(banner.artifactFormat).toBe("PNG");
    expect(banner.png).toBeInstanceOf(Buffer);
    expect(digest(banner.png as Buffer)).toBe("8e737308eabdb84f9bef041443cc348f9ff7ae13096db90ebb72e0a58755ae3e");
    const bannerMetadata = await sharp(banner.png as Buffer).metadata();
    expect({ width: bannerMetadata.width, height: bannerMetadata.height, format: bannerMetadata.format }).toEqual({ width: 1200, height: 1200, format: "png" });
    expect((banner.png as Buffer).byteLength).toBeGreaterThanOrEqual(80000);
    expect((banner.png as Buffer).byteLength).toBeLessThanOrEqual(800000);
  });

  it("is byte deterministic across three Windows-targeted runs", async () => {
    const request = await fixture(mobileFixturePath);
    const runs = await Promise.all([render(request), render(request), render(request)]);
    expect(runs.every((result) => result.status === "PASS")).toBe(true);
    expect(runs[0]?.pngDigest).toBe(runs[1]?.pngDigest);
    expect(runs[1]?.pngDigest).toBe(runs[2]?.pngDigest);
    expect(runs[0]?.pixelFingerprint).toBe(runs[1]?.pixelFingerprint);
    expect(runs[0]?.requestFingerprint).toBe(runs[1]?.requestFingerprint);
  });

  it("blocks actual-raster safe-area violations without adjusting the plan", async () => {
    const request = await fixture(mobileFixturePath);
    const changed: FreeformRenderRequest = {
      ...request,
      creativeLayoutPlan: {
        ...(request.creativeLayoutPlan as CreativeLayoutPlan),
        elements: (request.creativeLayoutPlan as CreativeLayoutPlan).elements.map((element) => element.id === "mobile-headline"
          ? { ...element, bounds: { ...element.bounds, x: 0.14 } }
          : element),
      },
    };
    const result = await render(changed);
    expect(result.status).toBe("BLOCKED");
    expect(result.downloadAllowed).toBe(false);
    expect(result.errors.some((entry) => entry.code === "KBR-FREEFORM-SAFE-ZONE-VIOLATION" && entry.stage === "POST_RENDER")).toBe(true);
  });

  it("enforces Mobile DA text limits before rasterization", async () => {
    const request = await fixture(mobileFixturePath);
    const plan = request.creativeLayoutPlan as CreativeLayoutPlan;
    const fiveLines: FreeformRenderRequest = {
      ...request,
      creativeLayoutPlan: {
        ...plan,
        elements: plan.elements.map((element) => element.id === "mobile-headline"
          ? { ...element, text: "1\n2\n3\n4\n5", wrapMode: "EXPLICIT_NEWLINES" as const, bounds: { ...element.bounds, height: 0.5 } }
          : element),
      },
    };
    expect((await render(fiveLines)).errors.some((entry) => entry.code === "KBR-FREEFORM-TEXT-LINES-EXCEEDED")).toBe(true);

    const tooLarge: FreeformRenderRequest = {
      ...request,
      creativeLayoutPlan: {
        ...plan,
        elements: plan.elements.map((element) => element.id === "mobile-headline"
          ? { ...element, fontSizePx: 53 }
          : element),
      },
    };
    expect((await render(tooLarge)).errors.some((entry) => entry.code === "KBR-FREEFORM-TEXT-FONT-SIZE-EXCEEDED")).toBe(true);
  });

  it("enforces minimum and maximum bytes and prohibited transparency", async () => {
    const request = await fixture(mobileFixturePath);
    const belowMinimum = await render({ ...request, output: { ...request.output, quality: 40 } });
    expect(belowMinimum.status).toBe("BLOCKED");
    expect(belowMinimum.errors.some((entry) => entry.code === "KBR-FREEFORM-FILE-SIZE-BELOW-MINIMUM")).toBe(true);

    const transparent = await render({
      ...request,
      output: { format: "PNG", mimeType: "image/png" },
      creativeLayoutPlan: { ...(request.creativeLayoutPlan as CreativeLayoutPlan), background: { type: "TRANSPARENT" } },
    });
    expect(transparent.status).toBe("BLOCKED");
    expect(transparent.errors.some((entry) => entry.code === "KBR-FREEFORM-OPAQUE-OUTPUT-REQUIRED")).toBe(true);

    const bannerProfile = profileRegistry.profiles.find((profile) => profile.formatProfileId === "NAVER_IMAGE_BANNER_1_1");
    if (!bannerProfile) throw new Error("Naver Image Banner profile missing");
    const contracts = await loadContracts(projectRoot);
    const noise = Buffer.alloc(1200 * 1200 * 4);
    let state = 0x12345678;
    for (let index = 0; index < noise.length; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      noise[index] = (state >>> 8) & 0xff;
    }
    const noisyPng = await sharp(noise, { raw: { width: 1200, height: 1200, channels: 4 } }).png().toBuffer();
    expect(noisyPng.byteLength).toBeGreaterThan(800000);
    const maxIssues = await validateFreeformPostRender({
      contracts,
      profile: bannerProfile,
      plan: (await fixture(bannerFixturePath)).creativeLayoutPlan as CreativeLayoutPlan,
      appliedElements: [],
      artifact: noisyPng,
      artifactFormat: "PNG",
    });
    expect(maxIssues.some((entry) => entry.code === "KBR-FREEFORM-FILE-SIZE-EXCEEDED")).toBe(true);
  });
});
