import { cp, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createSmartChannelFontResourceProvider,
  loadContracts,
  renderSmartChannel,
} from "../../src/core/index.js";
import { projectRoot } from "../helpers.js";

async function requestFixture(): Promise<Record<string, unknown>> {
  const request = JSON.parse(await readFile(path.join(projectRoot, "fixtures", "valid", "naver-smartchannel", "N2-REP-001.input.json"), "utf8")) as Record<string, unknown> & { assets: { object: { path: string } } };
  request.assets.object.path = "fixtures/valid/mask-semicircle-right__logo__black__pass.png";
  return request;
}

describe("N7.7 SmartChannel environment-independent font providers", () => {
  it("produces identical pixels and PNG bytes when providers supply the same pinned bytes", async () => {
    const contracts = await loadContracts(projectRoot);
    const deploymentRoot = path.join(os.tmpdir(), `kbr-font-provider-${process.pid}`);
    await mkdir(path.join(deploymentRoot, "assets", "fonts", "naver-smartchannel"), { recursive: true });
    await cp(path.join(projectRoot, "assets", "fonts", "naver-smartchannel"), path.join(deploymentRoot, "assets", "fonts", "naver-smartchannel"), { recursive: true });
    const desktopProvider = createSmartChannelFontResourceProvider({ id: "DesktopResourceProvider", root: projectRoot });
    const deploymentProvider = createSmartChannelFontResourceProvider({ id: "TestDeploymentResourceProvider", root: deploymentRoot });
    const request = await requestFixture();
    const outputRoot = path.join(deploymentRoot, "output");
    const desktop = await renderSmartChannel(request, { projectRoot, inputRoot: projectRoot, outputRoot, contracts, fontResourceProvider: desktopProvider, publish: false });
    const deployment = await renderSmartChannel(request, { projectRoot, inputRoot: projectRoot, outputRoot, contracts, fontResourceProvider: deploymentProvider, publish: false });
    expect(desktop.status).toBe("PASS");
    expect(deployment.status).toBe("PASS");
    expect(desktop.report?.fonts.map((font) => font.digest)).toEqual(deployment.report?.fonts.map((font) => font.digest));
    expect(desktop.pixelFingerprint).toBe(deployment.pixelFingerprint);
    expect(desktop.pngDigest).toBe(deployment.pngDigest);
  });
});
