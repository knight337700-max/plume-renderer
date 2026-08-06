import { readFile } from "node:fs/promises";
import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";

import {
  renderWithIntegrationAdapter,
  type RendererIntegrationInputV1,
} from "../../packages/renderer-contract/src/index.js";
import { renderThumbnailBoxRight } from "../../src/core/thumbnail-box-right.js";

const root = path.resolve(import.meta.dirname, "../..");
const assetPath = path.join(root, "fixtures", "valid", "thumbnail-box-right__asset__basic__pass.png");
const assetBytesPromise = readFile(assetPath);

GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansBold.ttf"), "KBR Spoqa Han Sans Bold");
GlobalFonts.registerFromPath(path.join(root, "assets", "fonts", "SpoqaHanSansRegular.ttf"), "KBR Spoqa Han Sans Regular");

async function loadFixture(name: string): Promise<RendererIntegrationInputV1> {
  return JSON.parse(await readFile(path.join(root, "fixtures", "integration", "thumbnail-box-right", name, "input.json"), "utf8")) as RendererIntegrationInputV1;
}

async function render(input: RendererIntegrationInputV1) {
  const bytes = await assetBytesPromise;
  return renderWithIntegrationAdapter(input, {
    resolver: { resolve: async () => ({ bytes, resolvedMimeType: "image/png" }) },
    renderThumbnail: async (request) => renderThumbnailBoxRight(request),
  });
}

describe("THUMBNAIL_BOX_RIGHT integration execution", () => {
  it.each([
    ["manual-crop-pass", "PASS"],
    ["semantic-crop-direct-pass", "PASS"],
    ["semantic-crop-candidate-pass", "PASS"],
  ])("renders %s", async (fixture, expected) => {
    const result = await render(await loadFixture(fixture));
    expect(result.status).toBe(expected);
    expect(result.artifact?.width).toBe(1029);
    expect(result.artifact?.height).toBe(258);
    expect(result.appliedImagePlacements[0]?.destinationRect).toEqual({ x: 666, y: 36, width: 315, height: 186 });
  });

  it.each([
    ["missing-crop-error", "KBR-CROP-RECT-REQUIRED"],
    ["candidate-not-found-error", "KBR-CROP-CANDIDATE-NOT-FOUND"],
    ["required-subject-clipped-error", "KBR-PROTECTED-SUBJECT-CLIPPED"],
  ])("blocks %s with %s", async (fixture, code) => {
    const result = await render(await loadFixture(fixture));
    expect(result.status).toBe("BLOCKED");
    expect(result.artifact).toBeUndefined();
    expect(result.validation.errors.map((entry) => entry.code)).toContain(code);
  });

  it("keeps the manual and agent semantic plans pixel-equivalent", async () => {
    const manual = JSON.parse(await readFile(path.join(root, "fixtures", "integration", "thumbnail-box-right", "manual-agent-equivalence", "manual.json"), "utf8")) as RendererIntegrationInputV1;
    const agent = JSON.parse(await readFile(path.join(root, "fixtures", "integration", "thumbnail-box-right", "manual-agent-equivalence", "agent.json"), "utf8")) as RendererIntegrationInputV1;
    const [manualResult, agentResult] = await Promise.all([render(manual), render(agent)]);
    expect(manualResult.status).toBe("PASS");
    expect(agentResult.status).toBe("PASS");
    expect(manualResult.artifact?.checksumSha256).toBe(agentResult.artifact?.checksumSha256);
    expect(manualResult.pixelFingerprint).toBe(agentResult.pixelFingerprint);
    expect(manualResult.requestFingerprint).not.toBe(agentResult.requestFingerprint);
  });
});
