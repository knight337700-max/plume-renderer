import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyGoogleStaticPlacementTransform, defaultGoogleStaticRequest } from "../../../apps/desktop/shared/src/index.js";
import { DesktopController } from "../../../apps/desktop/electron-main/src/desktop-controller.js";
import { DesktopSessionManager } from "../../../apps/desktop/electron-main/src/session/session-manager.js";
import type { UiRenderInput } from "../../../apps/desktop/shared/src/index.js";
import profilesRegistry from "../../../contracts/google/static-asset-profiles.g1.json" with { type: "json" };
import goldensRegistry from "../../../contracts/google/goldens.g2.1.json" with { type: "json" };
import { sha256File } from "../../../src/core/hash.js";
import { createTempRoot, projectRoot, removeTempRoot } from "../../helpers.js";

type Context = { root: string; outputRoot: string; session: DesktopSessionManager; controller: DesktopController };
const contexts: Context[] = [];

async function setup(label: string): Promise<Context> {
  const root = await createTempRoot(`desktop-google-g304-${label}`);
  const outputRoot = path.join(root, "output");
  await mkdir(outputRoot, { recursive: true });
  const session = new DesktopSessionManager(path.join(root, "sessions"));
  await session.initialize();
  const controller = new DesktopController({ projectRoot, session, appVersion: "0.13.0-test", blockedNetworkRequestCount: () => 0 });
  const context = { root, outputRoot, session, controller };
  contexts.push(context);
  return context;
}

async function selectSource(context: Context, profileId: string) {
  const selected = await context.controller.selectProductFromPath(path.join(projectRoot, "fixtures/google/g2/source", `g2-${profileId}.png`));
  expect(selected.status).toBe("SELECTED");
  if (selected.status !== "SELECTED") throw new Error("Google source fixture selection failed");
  return selected;
}

function profile(profileId: string) {
  const value = [...profilesRegistry.geometryProfiles, ...profilesRegistry.uploadedDisplayStaticProfiles].find((entry) => entry.profileId === profileId);
  if (!value) throw new Error(`Profile missing: ${profileId}`);
  return value;
}

function golden(profileId: string) {
  const value = goldensRegistry.entries.find((entry) => entry.profileId === profileId);
  if (!value) throw new Error(`Golden missing: ${profileId}`);
  return value;
}

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    await context.session.cleanup();
    await removeTempRoot(context.root);
  }
});

describe("Google Static G3.0.4 default placement and manifest", () => {
  it("keeps all fourteen production controller defaults byte-equal to G2.1", async () => {
    const context = await setup("all-defaults");
    const profileIds = [...profilesRegistry.geometryProfiles, ...profilesRegistry.uploadedDisplayStaticProfiles].map((entry) => entry.profileId).sort();
    for (const profileId of profileIds) {
      const selected = await selectSource(context, profileId);
      const request = defaultGoogleStaticRequest(profile(profileId), selected);
      const input: UiRenderInput = { assetToken: selected.assetToken, advertiser: "", headline: "", subcopy: "", jobName: `g304-${profileId}`, requestSequence: 1, googleStatic: request };
      const preview = await context.controller.requestPreview(input);
      expect(preview.validationStatus, profileId).toBe("PASS");
      expect(preview.googleStatic?.placementPlan, profileId).not.toBeNull();
      if (!preview.previewToken) throw new Error(`Preview token missing for ${profileId}`);
      const output = await context.controller.registerOutputDirectory(context.outputRoot);
      const exported = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: output.token });
      expect(exported.status, profileId).toBe("EXPORTED");
      if (exported.status !== "EXPORTED") continue;
      const artifact = path.join(context.outputRoot, input.jobName, exported.artifactFileName ?? exported.pngFileName);
      expect(await sha256File(artifact), profileId).toBe(golden(profileId).artifactSha256);
      const manifest = JSON.parse(await readFile(path.join(context.outputRoot, input.jobName, exported.manifestFileName), "utf8")) as Record<string, unknown>;
      expect(manifest.schemaVersion, profileId).toBe("1.1.0");
      expect(manifest.canonicalRequest, profileId).toEqual(expect.objectContaining({ profileId, placementPlan: expect.any(Object) }));
      expect(manifest.outputArtifactDigest, profileId).toBe(exported.artifactDigest);
      if (request.outputFormat === "JPEG") expect(manifest).not.toHaveProperty("outputPngDigest");
    }
  }, 120_000);

  it("composes deterministic transform values, replays, resets, and rejects missing plans", async () => {
    const context = await setup("transform");
    const profileId = "GOOGLE_MARKETING_LANDSCAPE_1_91";
    const selected = await selectSource(context, profileId);
    const base = defaultGoogleStaticRequest(profile(profileId), selected);
    const baseInput: UiRenderInput = { assetToken: selected.assetToken, advertiser: "", headline: "", subcopy: "", jobName: "g304-transform", requestSequence: 1, googleStatic: base };
    const basePreview = await context.controller.requestPreview(baseInput);
    expect(basePreview.previewPngDigest).toBe(golden(profileId).artifactSha256);
    const transformed = applyGoogleStaticPlacementTransform(profile(profileId), selected, { x: 0.42, y: 0.58, scale: 1.2 }, base);
    const transformedInput = { ...baseInput, requestSequence: 2, googleStatic: transformed };
    const transformedPreview = await context.controller.requestPreview(transformedInput);
    expect(transformedPreview.validationStatus).toBe("PASS");
    expect(transformedPreview.canonicalInputDigest).not.toBe(basePreview.canonicalInputDigest);
    expect(transformedPreview.googleStatic?.renderFingerprint).not.toBe(basePreview.googleStatic?.renderFingerprint);
    expect(transformedPreview.previewPngDigest).not.toBe(basePreview.previewPngDigest);
    const replay = await context.controller.requestPreview({ ...transformedInput, requestSequence: 3 });
    expect(replay.previewPngDigest).toBe(transformedPreview.previewPngDigest);
    expect(replay.canonicalInputDigest).toBe(transformedPreview.canonicalInputDigest);
    const reset = defaultGoogleStaticRequest(profile(profileId), selected);
    const resetPreview = await context.controller.requestPreview({ ...baseInput, requestSequence: 4, googleStatic: reset });
    expect(resetPreview.previewPngDigest).toBe(basePreview.previewPngDigest);
    expect(resetPreview.canonicalInputDigest).toBe(basePreview.canonicalInputDigest);
    const missingPlan = Object.fromEntries(Object.entries(base).filter(([key]) => key !== "placementPlan")) as Omit<typeof base, "placementPlan">;
    const blocked = await context.controller.requestPreview({ ...baseInput, requestSequence: 5, googleStatic: missingPlan });
    expect(blocked.validationStatus).toBe("ERROR");
    expect(blocked.errors.map((entry) => entry.code)).toContain("KBR-G3-0-4-DEFAULT-PLAN-MISSING");
  });
});
