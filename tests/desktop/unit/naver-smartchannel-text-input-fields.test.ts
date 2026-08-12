import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import { deriveNaverSmartChannelTextInputFields } from "../../../apps/desktop/shared/src/index.js";
import type { NaverSmartChannelTextInputKey } from "../../../apps/desktop/shared/src/index.js";
import { projectRoot } from "../../helpers.js";

type Template = {
  templateId: string;
  height: number;
  family: string;
  textVariant: string;
  affordance: string;
};

let metadata: Record<string, unknown>;
let templates: Template[];

function keys(templateId: string): NaverSmartChannelTextInputKey[] {
  const template = templates.find((entry) => entry.templateId === templateId);
  if (!template) throw new Error(`Missing test template ${templateId}`);
  return deriveNaverSmartChannelTextInputFields(metadata, templateId, template.affordance).map((entry) => entry.key);
}

beforeAll(async () => {
  const [metadataJson, templateJson] = await Promise.all([
    readFile(`${projectRoot}/contracts/naver-smartchannel-psd-metadata.json`, "utf8"),
    readFile(`${projectRoot}/contracts/naver-smartchannel-template-contract.json`, "utf8"),
  ]);
  metadata = JSON.parse(metadataJson) as Record<string, unknown>;
  templates = (JSON.parse(templateJson) as { templates: Template[] }).templates;
});

describe("SmartChannel canonical Desktop text input descriptors", () => {
  it("derives both 280 BASIC and EMPHASIS MAIN_TWO_LINES fields from PSD layers", () => {
    expect(keys("NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN_TWO_LINES_NONE")).toEqual([
      "headline",
      "headlineLine2",
    ]);
    expect(keys("NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_MAIN_TWO_LINES_NONE")).toEqual([
      "headline",
      "headlineLine2",
    ]);
  });

  it("orders ordinary 280 FOUR_LINE fields by final line order", () => {
    const fourLineTemplates = templates.filter((entry) => entry.height === 280 && entry.textVariant === "FOUR_LINE" && entry.family === "EMPHASIS");
    expect(fourLineTemplates).toHaveLength(5);
    for (const template of fourLineTemplates) {
      expect(keys(template.templateId), template.templateId).toEqual([
        "headline",
        "headlineLine2",
        "subcopy",
        "subcopyLine4",
      ]);
    }
  });

  it("preserves the source-backed disclosure key in the bottom-disclosure four-row template", () => {
    expect(keys("NAVER_SMARTCHANNEL_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_FOUR_LINE_LANDING_ICON")).toEqual([
      "headline",
      "headlineLine2",
      "subcopy",
      "disclosureLine1",
    ]);
  });

  it("derives a unique, ordered, localized descriptor set for all 120 templates", () => {
    expect(templates).toHaveLength(120);
    for (const template of templates) {
      const descriptors = deriveNaverSmartChannelTextInputFields(metadata, template.templateId, template.affordance);
      expect(descriptors.map((entry) => entry.order), template.templateId).toEqual(descriptors.map((_, index) => index));
      expect(new Set(descriptors.map((entry) => entry.key)).size, template.templateId).toBe(descriptors.length);
      expect(descriptors.every((entry) => entry.required && entry.labelKey.startsWith("naver_smartchannel.field.")), template.templateId).toBe(true);
    }
  });

  it("keeps 160 and 200 descriptor derivation independently source-backed", () => {
    const compact = templates.filter((entry) => entry.height === 160 || entry.height === 200);
    expect(compact).toHaveLength(64);
    expect(compact.every((entry) => deriveNaverSmartChannelTextInputFields(metadata, entry.templateId, entry.affordance).length > 0)).toBe(true);
  });
});
