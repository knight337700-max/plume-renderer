import { access } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import { createKakaoBizboardRenderer } from "../../src/core/index.js";
import {
  createTempRoot,
  loadValidInput,
  projectRoot,
  removeTempRoot,
  withOutput,
} from "../helpers.js";

describe("C2a text limits in the Core pipeline", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map(removeTempRoot));
  });

  async function setup() {
    const outputRoot = await createTempRoot("text-limits");
    roots.push(outputRoot);
    const renderer = await createKakaoBizboardRenderer({
      projectRoot,
      inputRoot: projectRoot,
      outputRoot,
    });
    return { renderer, outputRoot };
  }

  function baseTextInput() {
    return loadValidInput().then((input) => {
      input.advertiser.text = "가";
      input.copy.subcopy = "가 편안한 소파";
      input.assets.product.path = "fixtures/valid/object-right__product__inset-alpha__pass.png";
      return input;
    });
  }

  it("returns baseline and metrics from the exact rasterized text", async () => {
    const { renderer } = await setup();
    const input = await baseTextInput();
    input.copy.headline = "가나다라마바사아자차카타";
    const preview = await renderer.previewInternal(input);

    expect(preview.measurements?.headline.baselineY).toBe(120);
    expect(preview.measurements?.subcopy.baselineY).toBe(178);
    expect(preview.measurements?.headline.drawX).toBe(48);
    expect(preview.measurements?.headline.metrics.koreanEquivalentUnits).toBe(12);
    expect(preview.measurements?.headline.metrics.occupiedWidthPx).toBe(530);
    expect(preview.measurements?.headline.metrics.limitStatus).toBe("WARNING");
  });

  it("blocks a Korean-equivalent count error even when pixel width remains under 585px", async () => {
    const { renderer, outputRoot } = await setup();
    const input = withOutput(await baseTextInput(), "headline-count-error");
    input.copy.headline = "가나다라마바사아자차카타파";
    const response = await renderer.render(input);

    expect(response.downloadAllowed).toBe(false);
    expect(response.errors.map(({ code }) => code)).toContain("KBR-TEXT-COUNT-HEADLINE-001");
    expect(response.errors.map(({ code }) => code)).not.toContain("KBR-TEXT-004");
    await expect(access(`${outputRoot}\\jobs\\headline-count-error\\output.png`)).rejects.toThrow();
  });

  it("blocks a raster width error even when Korean-equivalent units remain within the limit", async () => {
    const { renderer, outputRoot } = await setup();
    const input = withOutput(await baseTextInput(), "headline-width-error");
    input.copy.headline = "가나다라마바사아자차WWWW";
    const response = await renderer.render(input);

    expect(response.downloadAllowed).toBe(false);
    expect(response.errors.map(({ code }) => code)).toContain("KBR-TEXT-004");
    expect(response.errors.map(({ code }) => code)).not.toContain("KBR-TEXT-COUNT-HEADLINE-001");
    await expect(access(`${outputRoot}\\jobs\\headline-width-error\\output.png`)).rejects.toThrow();
  });

  it("blocks a Subcopy Korean-equivalent count error", async () => {
    const { renderer, outputRoot } = await setup();
    const input = withOutput(await baseTextInput(), "subcopy-count-error");
    input.copy.subcopy = "가나다라마바사아자차카타파하거너더러";
    const response = await renderer.render(input);

    expect(response.downloadAllowed).toBe(false);
    expect(response.errors.map(({ code }) => code)).toContain("KBR-TEXT-COUNT-SUBCOPY-001");
    await expect(access(`${outputRoot}\\jobs\\subcopy-count-error\\output.png`)).rejects.toThrow();
  });

  it("allows warning-only width results and preserves the output gate", async () => {
    const { renderer } = await setup();
    const input = withOutput(await baseTextInput(), "headline-width-warning");
    input.copy.headline = "가나다라마바사아자WWWW";
    const response = await renderer.render(input);

    expect(response.status).toBe("PASS");
    expect(response.downloadAllowed).toBe(true);
    expect(response.errors).toEqual([]);
    expect(response.warnings.map(({ code }) => code)).toContain("KBR-TEXT-WIDTH-HEADLINE-W001");
  });

  it("preserves consecutive spaces and reports a warning instead of rewriting the input", async () => {
    const { renderer } = await setup();
    const input = await baseTextInput();
    input.copy.headline = "가  나 편안함";
    const preview = await renderer.previewInternal(input);

    expect(preview.warnings.map(({ code }) => code)).toContain("KBR-TEXT-SPACING-001");
    expect(preview.measurements?.headline.text).toBe("가  나 편안함");
  });
});
