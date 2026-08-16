import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultGoogleStaticRequest } from "../../../apps/desktop/shared/src/index.js";
import { DesktopController } from "../../../apps/desktop/electron-main/src/desktop-controller.js";
import { DesktopSessionManager } from "../../../apps/desktop/electron-main/src/session/session-manager.js";
import type { UiRenderInput } from "../../../apps/desktop/shared/src/index.js";
import profilesRegistry from "../../../contracts/google/static-asset-profiles.g1.json" with { type: "json" };
import { sha256File } from "../../../src/core/hash.js";
import { createTempRoot, projectRoot, removeTempRoot } from "../../helpers.js";

type Context = { root: string; outputRoot: string; session: DesktopSessionManager; controller: DesktopController };
const contexts: Context[] = [];

async function setup(label: string): Promise<Context> {
  const root = await createTempRoot(`desktop-google-g306-${label}`);
  const outputRoot = path.join(root, "output");
  await mkdir(outputRoot, { recursive: true });
  const session = new DesktopSessionManager(path.join(root, "sessions"));
  await session.initialize();
  const controller = new DesktopController({ projectRoot, session, appVersion: "0.13.1-test", blockedNetworkRequestCount: () => 0 });
  const context = { root, outputRoot, session, controller };
  contexts.push(context);
  return context;
}

function profile(profileId: string) {
  const value = [...profilesRegistry.geometryProfiles, ...profilesRegistry.uploadedDisplayStaticProfiles].find((entry) => entry.profileId === profileId);
  if (!value) throw new Error(`Profile missing: ${profileId}`);
  return value;
}

afterEach(async () => {
  for (const context of contexts.splice(0)) {
    await context.session.cleanup();
    await removeTempRoot(context.root);
  }
});

describe("Google Static G3.0.6 view-only export invariants", () => {
  it("keeps the historical G3.0.5 production allowlist exact and non-wildcard", async () => {
    const verifier = await readFile(path.join(projectRoot, "scripts/verify-g0-1-google-architecture-freeze.mjs"), "utf8");
    expect(verifier).toContain("const g3_0_5ProductionPaths = new Set([");
    expect(verifier).toContain("apps/desktop/renderer-ui/src/features/google/google-preview-geometry.ts");
    expect(verifier).not.toMatch(/g3_0_5ProductionPaths[^\n]*\*/u);
    expect(verifier).toContain("g3_0_5ProductionPaths.has(relativePath)");
  });

  it("keeps PNG/JPEG export bytes deterministic for geometry and Uploaded Display representatives", async () => {
    const context = await setup("view-only-export");
    const cases = [
      { profileId: "GOOGLE_MARKETING_LANDSCAPE_1_91", format: "PNG" as const },
      { profileId: "GOOGLE_MARKETING_SQUARE_1_1", format: "JPEG" as const },
      { profileId: "GOOGLE_MARKETING_PORTRAIT_4_5", format: "PNG" as const },
      { profileId: "GOOGLE_DG_UPLOAD_300X250", format: "JPEG" as const },
      { profileId: "GOOGLE_DG_UPLOAD_320X50", format: "PNG" as const },
    ];

    for (const [index, entry] of cases.entries()) {
      const selected = await context.controller.selectProductFromPath(path.join(projectRoot, "fixtures/google/g2/source", `g2-${entry.profileId}.png`));
      expect(selected.status, entry.profileId).toBe("SELECTED");
      if (selected.status !== "SELECTED") continue;
      const base = defaultGoogleStaticRequest(profile(entry.profileId), selected);
      const request = { ...base, outputFormat: entry.format, ...(entry.format === "JPEG" ? { jpegQuality: 88 } : {}) };
      const input: UiRenderInput = { assetToken: selected.assetToken, advertiser: "", headline: "", subcopy: "", jobName: `g306-${index}`, requestSequence: index + 1, googleStatic: request };
      const preview = await context.controller.requestPreview(input);
      expect(preview.validationStatus, entry.profileId).toBe("PASS");
      if (!preview.previewToken) throw new Error(`Preview token missing for ${entry.profileId}`);

      const firstRoot = path.join(context.outputRoot, `first-${index}`);
      const secondRoot = path.join(context.outputRoot, `second-${index}`);
      await mkdir(firstRoot, { recursive: true });
      await mkdir(secondRoot, { recursive: true });
      const firstOutput = await context.controller.registerOutputDirectory(firstRoot);
      const secondOutput = await context.controller.registerOutputDirectory(secondRoot);
      const first = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: firstOutput.token });
      const second = await context.controller.exportRender({ ...input, previewToken: preview.previewToken, outputDirectoryToken: secondOutput.token });
      expect(first.status, entry.profileId).toBe("EXPORTED");
      expect(second.status, entry.profileId).toBe("EXPORTED");
      if (first.status !== "EXPORTED" || second.status !== "EXPORTED") continue;
      const firstPath = path.join(context.outputRoot, `first-${index}`, input.jobName, first.artifactFileName ?? first.pngFileName);
      const secondPath = path.join(context.outputRoot, `second-${index}`, input.jobName, second.artifactFileName ?? second.pngFileName);
      expect(await sha256File(firstPath), entry.profileId).toBe(await sha256File(secondPath));
      expect(await readFile(firstPath), entry.profileId).toEqual(await readFile(secondPath));
    }
  }, 120_000);
});
