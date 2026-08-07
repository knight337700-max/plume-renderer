import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  FREEFORM_PLAN_SCHEMA_VERSION,
  applyCreativeLayoutPlanDefaults,
  computeFreeformFingerprints,
  validateCreativeLayoutPlan,
  validateFreeformOutputFormat,
  validateFontReference,
  stableSortCreativeElements,
  type CreativeLayoutPlan,
  type FreeformFontRegistry,
  type FormatProfile,
  type RendererIntegrationInputV1,
} from "../../packages/renderer-contract/src/index.js";
import { validateIntegrationInput } from "../../packages/renderer-contract/src/index.js";

const root = path.resolve(import.meta.dirname, "../..");
const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(path.join(root, file), "utf8"));

const profile: FormatProfile = {
  formatProfileId: "KBR_FREEFORM_CONTRACT_TEST_1029X258",
  canvas: { width: 1029, height: 258 },
  layoutMode: "FREEFORM",
  allowedOutputFormats: ["PNG"],
  implementationStatus: "NOT_IMPLEMENTED",
  catalogStatus: "INTERNAL_TEST_ONLY",
};

describe("FREEFORM contract schemas", () => {
  it("compiles all schemas and rejects unknown fields", async () => {
    const files = [
      "packages/renderer-contract/schema/renderer-integration-input-v1.schema.json",
      "packages/renderer-contract/schema/renderer-integration-output-v1.schema.json",
      "packages/renderer-contract/schema/image-placement-plan-v1.schema.json",
      "packages/renderer-contract/schema/crop-candidate-v1.schema.json",
      "packages/renderer-contract/schema/template-capability-v1.schema.json",
      "packages/renderer-contract/schema/image-placement-spec-v1.schema.json",
      "packages/renderer-contract/schema/freeform-text-element-v1.schema.json",
      "packages/renderer-contract/schema/freeform-image-element-v1.schema.json",
      "packages/renderer-contract/schema/freeform-logo-element-v1.schema.json",
      "packages/renderer-contract/schema/freeform-shape-element-v1.schema.json",
      "packages/renderer-contract/schema/creative-element-v1.schema.json",
      "packages/renderer-contract/schema/creative-layout-plan-v1.schema.json",
      "packages/renderer-contract/schema/format-profile-v1.schema.json",
      "packages/renderer-contract/schema/freeform-font-registry-v1.schema.json",
    ];
    const schemas = await Promise.all(files.map(readJson)) as Record<string, unknown>[];
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    schemas.forEach((schema) => ajv.addSchema(schema));
    const valid = await readJson("fixtures/freeform/creative-layout-plan-v1/minimal-valid.json");
    const validate = ajv.getSchema("https://kbr.local/schema/creative-layout-plan-v1.schema.json");
    expect(validate).toBeDefined();
    expect(validate?.(valid)).toBe(true);
    const unknown = structuredClone(valid) as Record<string, unknown>;
    unknown.unknownField = true;
    expect(validate?.(unknown)).toBe(false);
    expect(JSON.stringify(valid)).not.toContain("imageSlotId");
  });

  it("accepts FREEFORM input without templateId and rejects profile mismatch", async () => {
    const value = await readJson("fixtures/integration/freeform/manual.json") as RendererIntegrationInputV1;
    expect(validateIntegrationInput(value)).toEqual([]);
    const plan = value.creativeLayoutPlan;
    expect(plan).toBeDefined();
    if (!plan) return;
    expect(validateCreativeLayoutPlan(plan, { formatProfileId: value.formatProfileId, profile })).toEqual([]);
    expect(validateCreativeLayoutPlan(plan, { formatProfileId: "OTHER_PROFILE", profile })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "KBR-FREEFORM-FORMAT-PROFILE-MISMATCH" })]));
    expect(validateCreativeLayoutPlan(plan, { formatProfileId: value.formatProfileId, requireProfile: true }).map((entry) => entry.code)).toContain("KBR-FREEFORM-CANVAS-PROFILE-MISSING");
    expect(validateFreeformOutputFormat("PNG", profile)).toEqual([]);
    expect(validateFreeformOutputFormat("JPG", profile).map((entry) => entry.code)).toContain("KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED");
  });
});

describe("FREEFORM element rules", () => {
  it("enforces ids, bounds, colors, and the v1 wrap boundary", async () => {
    const valid = await readJson("fixtures/freeform/creative-layout-plan-v1/minimal-valid.json") as CreativeLayoutPlan;
    expect(validateCreativeLayoutPlan(valid)).toEqual([]);
    const duplicate = await readJson("fixtures/freeform/creative-layout-plan-v1/invalid-duplicate-id.json");
    expect(validateCreativeLayoutPlan(duplicate).map((entry) => entry.code)).toContain("KBR-FREEFORM-ELEMENT-ID-DUPLICATE");
    const invalidColor = await readJson("fixtures/freeform/creative-layout-plan-v1/invalid-color.json");
    expect(validateCreativeLayoutPlan(invalidColor).map((entry) => entry.code)).toContain("KBR-FREEFORM-TEXT-COLOR-INVALID");
    const wordWrap = structuredClone(valid) as Record<string, unknown>;
    const elements = wordWrap.elements as Record<string, unknown>[];
    const firstElement = elements[0];
    if (!firstElement) return;
    firstElement.wrapMode = "WORD_WRAP";
    expect(validateCreativeLayoutPlan(wordWrap).map((entry) => entry.code)).toContain("KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED");
    const outside = structuredClone(valid) as Record<string, unknown>;
    const outsideElements = outside.elements as Record<string, unknown>[];
    const outsideElement = outsideElements[0];
    if (!outsideElement) return;
    outsideElement.bounds = { x: 0.9, y: 0, width: 0.2, height: 0.2 };
    expect(validateCreativeLayoutPlan(outside).map((entry) => entry.code)).toContain("KBR-FREEFORM-BOUNDS-OUT-OF-RANGE");
  });

  it("materializes deterministic defaults and keeps zIndex stable sort", async () => {
    const valid = await readJson("fixtures/freeform/creative-layout-plan-v1/minimal-valid.json") as CreativeLayoutPlan;
    const applied = applyCreativeLayoutPlanDefaults(valid);
    expect(applied.schemaVersion).toBe(FREEFORM_PLAN_SCHEMA_VERSION);
    expect(applied.elements.every((element) => element.opacity === 1)).toBe(true);
    const text = applied.elements.find((element) => element.type === "TEXT");
    expect(text && text.type === "TEXT" ? text.letterSpacingPx : undefined).toBe(0);
    const first = valid.elements[0];
    const second = valid.elements[1];
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    expect(stableSortCreativeElements([{ ...first, zIndex: 2 }, { ...second, zIndex: 2 }]).map((element) => element.id)).toEqual([first.id, second.id]);
  });
});

describe("FREEFORM deterministic assets and fingerprints", () => {
  it("requires registered font assets and exact digests", async () => {
    const registry = await readJson("contracts/freeform-font-registry.json") as FreeformFontRegistry;
    const entry = registry.entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(validateFontReference(entry.fontId, registry)).toEqual([]);
    expect(validateFontReference("SYSTEM_DEFAULT", registry).map((issue) => issue.code)).toContain("KBR-FONT-NOT-REGISTERED");
    expect(validateFontReference(entry.fontId, registry, "/fontId", "0".repeat(64)).map((issue) => issue.code)).toContain("KBR-FONT-ASSET-DIGEST-MISMATCH");
  });

  it("keeps pixel fingerprints equal across MANUAL and AGENT provenance", async () => {
    const manual = await readJson("fixtures/freeform/creative-layout-plan-v1/manual.json") as CreativeLayoutPlan;
    const agent = await readJson("fixtures/freeform/creative-layout-plan-v1/agent.json") as CreativeLayoutPlan;
    const digests = { "freeform-image-01": "a".repeat(64), SPOQA_HAN_SANS_BOLD: "b".repeat(64) };
    const manualFp = await computeFreeformFingerprints(manual, digests, profile, { requestId: "manual" });
    const agentFp = await computeFreeformFingerprints(agent, digests, profile, { requestId: "agent" });
    expect(manualFp.pixelFingerprint).toBe(agentFp.pixelFingerprint);
    expect(manualFp.requestFingerprint).not.toBe(agentFp.requestFingerprint);
  });

  it("preserves existing TEMPLATE_LOCKED Golden bytes", async () => {
    const bytes = await readFile(path.join(root, "fixtures/golden/object-right__stable__golden.png"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1");
  });
});
