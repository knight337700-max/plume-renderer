import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertDownloadAllowed,
  applyDefaults,
  canonicalDigest,
  canonicalJson,
  createKakaoBizboardRenderer,
  inspectPngIhdr,
  loadContracts,
  normalizeInput,
  readRenderedManifest,
} from "../../src/core/index.js";
import { sha256Bytes } from "../../src/core/hash.js";
import type { KakaoBizboardInputV1 } from "../../src/core/types.js";
import {
  createTempRoot,
  loadValidInput,
  projectRoot,
  removeTempRoot,
  withOutput,
} from "../helpers.js";

async function doesNotExist(target: string): Promise<boolean> {
  try {
    await access(target);
    return false;
  } catch {
    return true;
  }
}

describe("Core renderer publish workflow", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map(removeTempRoot));
  });

  async function setup() {
    const outputRoot = await createTempRoot("renderer");
    roots.push(outputRoot);
    const renderer = await createKakaoBizboardRenderer({
      projectRoot,
      inputRoot: projectRoot,
      outputRoot,
    });
    return { outputRoot, renderer };
  }

  it("publishes exactly one RGBA PNG and one self-hash-free manifest", async () => {
    const { renderer } = await setup();
    const input = withOutput(await loadValidInput(), "pass");
    const response = await renderer.render(input);

    expect(response.status).toBe("PASS");
    expect(response.downloadAllowed).toBe(true);
    expect(response.errors).toEqual([]);
    expect(response.pngPath).not.toBeNull();
    expect(response.manifestPath).not.toBeNull();
    if (!response.pngPath || !response.manifestPath) return;

    const [png, manifestText] = await Promise.all([
      readFile(response.pngPath),
      readFile(response.manifestPath, "utf8"),
    ]);
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    expect(inspectPngIhdr(png)).toEqual({ width: 1029, height: 258, bitDepth: 8, colorType: 6 });
    expect(png.byteLength).toBeLessThanOrEqual(300_000);
    expect(sha256Bytes(png)).toBe(response.pngDigest);
    expect(sha256Bytes(Buffer.from(manifestText, "utf8"))).toBe(response.manifestDigest);
    expect(manifestText).toBe(canonicalJson(manifest));
    expect(manifest).not.toHaveProperty("manifestDigest");
    expect(manifest).not.toHaveProperty("sha256");
    expect(manifest).toMatchObject({
      schemaVersion: "1.0.0",
      templateContractVersion: "1.1.0",
      inputSchemaVersion: "1.2.0",
      outputSchemaVersion: "2.0.0",
      outputPngDigest: response.pngDigest,
      canonicalInputDigest: canonicalDigest(normalizeInput(applyDefaults(input))),
      normalizedInputDigest: canonicalDigest(normalizeInput(applyDefaults(input))),
    });
    expect(await readRenderedManifest(response)).toMatchObject(manifest);
  });

  it("does not publish when CTA mode is registered but disabled", async () => {
    const { outputRoot, renderer } = await setup();
    const invalid = JSON.parse(
      await readFile(
        path.join(projectRoot, "fixtures", "invalid", "object-right__input__cta-disabled__error.json"),
        "utf8",
      ),
    ) as KakaoBizboardInputV1;
    invalid.output = { directory: "jobs", baseName: "cta-disabled", overwrite: false };

    const response = await renderer.render(invalid);
    expect(response).toMatchObject({
      status: "FAIL",
      downloadAllowed: false,
      manifestDigest: null,
      pngDigest: null,
      manifestPath: null,
      pngPath: null,
    });
    expect(response.errors.map(({ code }) => code)).toContain("KBR-CTA-009");
    expect(await doesNotExist(path.join(outputRoot, "jobs", "cta-disabled", "output.png"))).toBe(true);
  });

  it("does not publish a product with no layout-visible alpha", async () => {
    const { outputRoot, renderer } = await setup();
    const invalid = withOutput(await loadValidInput(), "transparent");
    invalid.assets.product.path = "fixtures/invalid/object-right__alpha__fully-transparent__error.png";

    const response = await renderer.render(invalid);
    expect(response.status).toBe("FAIL");
    expect(response.errors.map(({ code }) => code)).toContain("KBR-ASSET-005");
    expect(await doesNotExist(path.join(outputRoot, "jobs", "transparent", "output.png"))).toBe(true);
  });

  it("maps a missing safe asset to KBR-ASSET-001", async () => {
    const { renderer } = await setup();
    const invalid = withOutput(await loadValidInput(), "missing");
    invalid.assets.product.path = "fixtures/invalid/does-not-exist.png";

    const response = await renderer.render(invalid);
    expect(response.errors.map(({ code }) => code)).toContain("KBR-ASSET-001");
    expect(response.errors.map(({ code }) => code)).not.toContain("KBR-SYSTEM-005");
  });

  it("blocks output traversal at Core and reports the output pointer", async () => {
    const { renderer } = await setup();
    const invalid = withOutput(await loadValidInput(), "escape");
    invalid.output.directory = "../outside";

    const response = await renderer.render(invalid);
    expect(response.errors).toContainEqual(
      expect.objectContaining({ code: "KBR-INPUT-009", path: "/output/directory" }),
    );
  });

  it("preserves completed output when overwrite is not explicitly enabled", async () => {
    const { renderer } = await setup();
    const input = withOutput(await loadValidInput(), "no-overwrite");
    const first = await renderer.render(input);
    const second = await renderer.render(input);

    expect(first.status).toBe("PASS");
    expect(second.status).toBe("FAIL");
    expect(second.errors.map(({ code }) => code)).toContain("KBR-INPUT-010");
    expect(second.pngDigest).toBeNull();
    if (!first.pngPath) return;
    expect(sha256Bytes(await readFile(first.pngPath))).toBe(first.pngDigest);
  });

  it("enforces downloadAllowed in the Core API", async () => {
    const { renderer } = await setup();
    const invalid = withOutput(await loadValidInput(), "download-blocked");
    invalid.copy.subcopy = invalid.copy.headline;
    const response = await renderer.render(invalid);
    const contracts = await loadContracts(projectRoot);

    expect(response.downloadAllowed).toBe(false);
    expect(() => assertDownloadAllowed(response, contracts)).toThrow("KBR-DOWNLOAD-001:download.blocked");
    await expect(readRenderedManifest(response)).resolves.toBeNull();
  });
});
