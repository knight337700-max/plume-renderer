import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  CAPABILITIES,
  INTEGRATION_SCHEMA_VERSION,
  OBJECT_RIGHT_FORMAT_PROFILE_ID,
  OBJECT_RIGHT_IMAGE_SLOT_ID,
  OBJECT_RIGHT_TEMPLATE_ID,
  computeFingerprints,
  normalizedRectToPixelRect,
  parsePlacementPlan,
  renderWithIntegrationAdapter,
  serializePlacementPlan,
  validateIntegrationInput,
  validateNormalizedPoint,
  validateNormalizedRect,
  validatePlacementPlan,
  validateProtectedSubjects,
  type CropCandidate,
  type ImagePlacementPlan,
  type RendererIntegrationInputV1,
} from "../../packages/renderer-contract/src/index.js";
import { createKakaoBizboardRenderer } from "../../src/core/index.js";
import type { KakaoBizboardInputV1 } from "../../src/core/types.js";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const readJson = async (relativePath: string): Promise<unknown> => JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));

const genericAsset = { assetId: "stock-01", mimeType: "image/png" as const, assetRef: { type: "FIXTURE_ASSET_ID" as const, value: "stock-01.png" } };
const basePlan: ImagePlacementPlan = { schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId: "TEST_IMAGE_SLOT", assetId: "stock-01", policy: "CENTER_CONTAIN", source: "DETERMINISTIC", fitMode: "CONTAIN", anchor: "CENTER", subjectProtection: "NONE" };
const genericInput = (plan: ImagePlacementPlan, extra: Partial<RendererIntegrationInputV1> = {}): RendererIntegrationInputV1 => ({ schemaVersion: INTEGRATION_SCHEMA_VERSION, formatProfileId: "TEST_GENERIC_SLOT", templateId: "TEST_GENERIC_SLOT_V1", copy: {}, assets: [genericAsset], imagePlacementPlans: [plan], output: { mimeType: "image/png" }, ...extra });

describe("Integration Contract schemas", () => {
  it("parses every v1 schema and rejects unknown fields", async () => {
    const files = [
      "packages/renderer-contract/schema/renderer-integration-input-v1.schema.json",
      "packages/renderer-contract/schema/renderer-integration-output-v1.schema.json",
      "packages/renderer-contract/schema/image-placement-plan-v1.schema.json",
      "packages/renderer-contract/schema/crop-candidate-v1.schema.json",
      "packages/renderer-contract/schema/template-capability-v1.schema.json",
    ];
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    for (const file of files) {
      const schema = await readJson(file) as object;
      expect(() => ajv.compile(schema)).not.toThrow();
    }
    const plan = { ...basePlan, unknownField: true };
    expect(parsePlacementPlan(plan).errors.some((entry) => entry.messageKey === "input.additional_property")).toBe(true);
    const nestedPlan = { ...basePlan, focalPoint: { x: 0.5, y: 0.5, nestedUnknown: true } };
    expect(parsePlacementPlan(nestedPlan).errors.some((entry) => entry.path === "/focalPoint/nestedUnknown")).toBe(true);
  });

  it("round-trips a manual plan in canonical JSON and preserves source", () => {
    const plan: ImagePlacementPlan = { ...basePlan, policy: "MANUAL_CROP", source: "MANUAL", fitMode: "COVER", cropRect: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 } };
    const json = serializePlacementPlan(plan);
    const parsed = parsePlacementPlan(JSON.parse(json));
    expect(parsed.errors).toEqual([]);
    expect(parsed.plan?.source).toBe("MANUAL");
    if (parsed.plan) expect(json).toBe(serializePlacementPlan(parsed.plan));
  });
});

describe("normalized geometry", () => {
  it.each([
    [{ x: Number.NaN, y: 0 }, "point"],
    [{ x: Number.POSITIVE_INFINITY, y: 0 }, "point"],
  ])("rejects non-finite %s", (value, kind) => {
    expect((kind === "point" ? validateNormalizedPoint(value) : validateNormalizedRect(value)).length).toBeGreaterThan(0);
  });

  it("rejects negative, zero-size, and out-of-bounds rectangles without clamping", () => {
    expect(validateNormalizedRect({ x: -0.01, y: 0, width: 0.2, height: 0.2 })).toHaveLength(1);
    expect(validateNormalizedRect({ x: 0, y: 0, width: 0, height: 0.2 })).toHaveLength(1);
    expect(validateNormalizedRect({ x: 0.8, y: 0, width: 0.3, height: 0.2 })).toHaveLength(1);
    expect(validateNormalizedRect({ x: 1 + 5e-10, y: 0, width: 0.1, height: 0.1 })).toHaveLength(1);
    expect(validateNormalizedRect({ x: 1 + 2e-9, y: 0, width: 0.1, height: 0.1 })).toHaveLength(1);
  });

  it("converts normalized bounds with floor/ceil and minimum one pixel", () => {
    expect(normalizedRectToPixelRect({ x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, 10, 10)).toEqual({ x: 1, y: 2, width: 3, height: 2 });
    expect(normalizedRectToPixelRect({ x: 0.25, y: 0.25, width: 0.00001, height: 0.00001 }, 100, 100)).toEqual({ x: 25, y: 25, width: 1, height: 1 });
    expect(() => normalizedRectToPixelRect({ x: 0.99, y: 0, width: 0.02, height: 0.2 }, 100, 100)).toThrow();
  });
});

describe("placement policy matrix", () => {
  it("allows alpha trim and center contain without crop", () => {
    expect(validateIntegrationInput(genericInput({ ...basePlan, policy: "ALPHA_TRIM_CONTAIN" }), { allowedPolicies: ["ALPHA_TRIM_CONTAIN"], allowedImageSlotIds: ["TEST_IMAGE_SLOT"] })).toEqual(expect.not.arrayContaining([expect.objectContaining({ severity: "ERROR" })]));
    expect(validateIntegrationInput(genericInput(basePlan), { allowedPolicies: ["CENTER_CONTAIN"], allowedImageSlotIds: ["TEST_IMAGE_SLOT"] })).toEqual(expect.not.arrayContaining([expect.objectContaining({ severity: "ERROR" })]));
  });

  it("rejects crop on contain and missing crop on semantic/manual policies", () => {
    const alphaWithCrop = { ...basePlan, policy: "ALPHA_TRIM_CONTAIN" as const, cropRect: { x: 0, y: 0, width: 0.5, height: 0.5 } };
    expect(validateIntegrationInput(genericInput(alphaWithCrop), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-RECT-FORBIDDEN");
    const semantic = { ...basePlan, policy: "SEMANTIC_CROP_COVER" as const, fitMode: "COVER" as const };
    expect(validateIntegrationInput(genericInput(semantic), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-RECT-REQUIRED");
    const manual = { ...semantic, policy: "MANUAL_CROP" as const, source: "MANUAL" as const };
    expect(validateIntegrationInput(genericInput(manual), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-RECT-REQUIRED");
  });

  it("rejects absolute or traversal-like asset references in the serializable contract", () => {
    const unsafe = genericInput(basePlan, { assets: [{ ...genericAsset, assetRef: { type: "FIXTURE_ASSET_ID", value: "C:\\outside\\asset.png" } }] });
    expect(validateIntegrationInput(unsafe).map((entry) => entry.code)).toContain("KBR-ASSET-REF-UNRESOLVED");
  });

  it("accepts exactly one direct crop or candidate for semantic crop", () => {
    const direct: ImagePlacementPlan = { ...basePlan, policy: "SEMANTIC_CROP_COVER", fitMode: "COVER", cropRect: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } };
    expect(validateIntegrationInput(genericInput(direct), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] })).toEqual([]);
    const candidate: CropCandidate = { schemaVersion: INTEGRATION_SCHEMA_VERSION, candidateId: "c1", assetId: "stock-01", imageSlotId: "TEST_IMAGE_SLOT", cropRect: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, preservedSubjectIds: [], clippedSubjectIds: [], fillRatio: 0.8, subjectCoverageRatio: 1, warnings: [] };
    const byCandidate: ImagePlacementPlan = { ...basePlan, policy: "SEMANTIC_CROP_COVER", fitMode: "COVER", cropCandidateId: "c1" };
    expect(validateIntegrationInput(genericInput(byCandidate, { cropCandidates: [candidate] }), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] })).toEqual([]);
    expect(validateIntegrationInput(genericInput({ ...direct, cropCandidateId: "c1" } as ImagePlacementPlan, { cropCandidates: [candidate] }), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-RECT-FORBIDDEN");
  });
});

describe("candidate and subject protection", () => {
  it("blocks missing, duplicate, and mismatched candidates", () => {
    const plan = { ...basePlan, policy: "SEMANTIC_CROP_COVER" as const, fitMode: "COVER" as const, cropCandidateId: "missing" };
    expect(validateIntegrationInput(genericInput(plan), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-CANDIDATE-NOT-FOUND");
    const mismatch: CropCandidate = { schemaVersion: INTEGRATION_SCHEMA_VERSION, candidateId: "c1", assetId: "other", imageSlotId: "TEST_IMAGE_SLOT", cropRect: { x: 0, y: 0, width: 1, height: 1 }, preservedSubjectIds: [], clippedSubjectIds: [], fillRatio: 1, subjectCoverageRatio: 1, warnings: [] };
    expect(validateIntegrationInput(genericInput({ ...plan, cropCandidateId: "c1" }, { cropCandidates: [mismatch] }), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-CANDIDATE-MISMATCH");
    expect(validateIntegrationInput(genericInput({ ...plan, cropCandidateId: "c1" }, { cropCandidates: [mismatch, mismatch] }), { allowedImageSlotIds: ["TEST_IMAGE_SLOT"] }).map((entry) => entry.code)).toContain("KBR-CROP-CANDIDATE-MISMATCH");
  });

  it("applies REQUIRED/PREFERRED/NONE clipping semantics", () => {
    const crop = { x: 0.2, y: 0.2, width: 0.5, height: 0.5 } as const;
    const subject = { subjectId: "p", subjectType: "PRODUCT" as const, bounds: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 } };
    const required = { ...basePlan, policy: "MANUAL_CROP" as const, source: "MANUAL" as const, fitMode: "COVER" as const, cropRect: crop, subjectProtection: "REQUIRED" as const, protectedSubjects: [subject] };
    expect(validateProtectedSubjects(required, crop).map((entry) => entry.severity)).toEqual(["ERROR"]);
    expect(validateProtectedSubjects({ ...required, subjectProtection: "PREFERRED" }, crop).map((entry) => entry.severity)).toEqual(["WARNING"]);
    expect(validateProtectedSubjects({ ...required, subjectProtection: "NONE" }, crop)).toEqual([]);
    const requiredWithoutSubjects = structuredClone(required) as ImagePlacementPlan;
    Reflect.deleteProperty(requiredWithoutSubjects, "protectedSubjects");
    expect(validatePlacementPlan(requiredWithoutSubjects, new Map([[genericAsset.assetId, genericAsset]]), new Map())).toEqual(expect.arrayContaining([expect.objectContaining({ code: "KBR-PROTECTED-SUBJECT-DATA-MISSING" })]));
  });
});

describe("fingerprints", () => {
  it("keeps pixel fingerprints equal while request fingerprints record source provenance", async () => {
    const manual = JSON.parse(JSON.stringify(await readJson("fixtures/integration/equivalence/manual.json"))) as RendererIntegrationInputV1;
    const agent = JSON.parse(JSON.stringify(await readJson("fixtures/integration/equivalence/agent.json"))) as RendererIntegrationInputV1;
    const assetDigests = { "stock-01": "a".repeat(64) };
    const manualFp = await computeFingerprints(manual, assetDigests, manual.imagePlacementPlans);
    const agentFp = await computeFingerprints(agent, assetDigests, agent.imagePlacementPlans);
    expect(manualFp.pixelFingerprint).toBe(agentFp.pixelFingerprint);
    expect(manualFp.requestFingerprint).not.toBe(agentFp.requestFingerprint);
    expect((await Promise.all([1, 2, 3].map(() => computeFingerprints(manual, assetDigests, manual.imagePlacementPlans)))).map((entry) => entry.pixelFingerprint)).toEqual([manualFp.pixelFingerprint, manualFp.pixelFingerprint, manualFp.pixelFingerprint]);
  });
});

describe("capability and adapter boundary", () => {
  it("advertises OBJECT_RIGHT, THUMBNAIL_BOX_RIGHT, and THUMBNAIL_MULTI_RIGHT as production implemented", () => {
    expect(CAPABILITIES.KAKAO_BIZBOARD_OBJECT_RIGHT?.implementationStatus).toBe("IMPLEMENTED");
    expect(CAPABILITIES.KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT?.implementationStatus).toBe("IMPLEMENTED");
    expect(CAPABILITIES.KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT?.implementationStatus).toBe("IMPLEMENTED");
    expect(Object.values(CAPABILITIES).filter((entry) => entry.implementationStatus === "IMPLEMENTED")).toHaveLength(4);
  });

  it("resolves a fixture asset and bridges an Integration Input to a legacy renderer callback", async () => {
    const input = await readJson("fixtures/integration/alpha-trim-contain/input.json") as RendererIntegrationInputV1;
    const png = new Uint8Array(await readFile(path.join(projectRoot, "fixtures/valid/object-right__product__basic__pass.png")));
    const outputPng = new Uint8Array(await readFile(path.join(projectRoot, "fixtures/golden/object-right__stable__golden.png")));
    const result = await renderWithIntegrationAdapter(input, {
      resolver: { resolve: async () => ({ bytes: png, resolvedMimeType: "image/png" }) },
      renderLegacy: async () => ({ bytes: outputPng, width: 1029, height: 258, mimeType: "image/png", appliedImagePlacement: { imageSlotId: OBJECT_RIGHT_IMAGE_SLOT_ID, assetId: "product-basic", policy: "ALPHA_TRIM_CONTAIN", source: "DETERMINISTIC", destinationRect: { x: 666, y: 0, width: 315, height: 258 }, appliedScale: 1, appliedAnchor: "CENTER", alphaTrimApplied: true, changedFromRequestedPlan: false } }),
    });
    expect(result.status).toBe("PASS");
    expect(result.artifact?.checksumSha256).toHaveLength(64);
    expect(result.appliedImagePlacements[0]?.destinationRect).toEqual({ x: 666, y: 0, width: 315, height: 258 });
    expect(result.appliedImagePlacements[0]?.changedFromRequestedPlan).toBe(false);
  });

  it("bridges the Integration Input into the unchanged OBJECT_RIGHT Core pipeline", async () => {
    const input = await readJson("fixtures/integration/alpha-trim-contain/input.json") as RendererIntegrationInputV1;
    const sourceBytes = new Uint8Array(await readFile(path.join(projectRoot, "fixtures/valid/object-right__product__basic__pass.png")));
    const inputRoot = path.join(projectRoot, ".tmp-integration-input");
    const outputRoot = path.join(projectRoot, ".tmp-integration-output");
    await mkdir(path.join(inputRoot, "integration"), { recursive: true });
    await mkdir(outputRoot, { recursive: true });
    await writeFile(path.join(inputRoot, "integration", "product-basic.png"), sourceBytes);
    try {
      const core = await createKakaoBizboardRenderer({ projectRoot, inputRoot, outputRoot });
      const result = await renderWithIntegrationAdapter(input, {
        resolver: { resolve: async () => ({ bytes: sourceBytes, resolvedMimeType: "image/png" }) },
        renderLegacy: async (legacyInput) => {
          const coreInput: KakaoBizboardInputV1 = {
            schemaVersion: "1.2.0",
            channel: legacyInput.channel,
            placement: legacyInput.placement,
            template: legacyInput.template,
            advertiser: { text: legacyInput.advertiser, renderMode: "REQUIRE_IN_COPY" },
            copy: legacyInput.copy,
            cta: { mode: "NONE", landingType: "DIRECT_URL", label: null, iconPath: null },
            assets: { product: { path: legacyInput.product.relativePath, expectedSha256: legacyInput.product.expectedSha256, alphaTrim: true } },
            render: { templateContractVersion: "1.3.0", includeDebugOverlay: false, pixelRatio: 1 },
            output: { directory: "jobs", baseName: "integration-core", overwrite: false },
            canvas: { width: 1029, height: 258 },
          };
          const response = await core.render(coreInput);
          if (response.status !== "PASS" || !response.pngPath) throw new Error(`legacy Core blocked: ${response.errors.map((error) => error.code).join(",")}`);
          const bytes = new Uint8Array(await readFile(response.pngPath));
          return { bytes, width: 1029, height: 258, mimeType: "image/png", appliedImagePlacement: { imageSlotId: OBJECT_RIGHT_IMAGE_SLOT_ID, assetId: "product-basic", policy: "ALPHA_TRIM_CONTAIN", source: "DETERMINISTIC", destinationRect: { x: 666, y: 0, width: 315, height: 258 }, appliedScale: 1, appliedAnchor: "CENTER", alphaTrimApplied: true, changedFromRequestedPlan: false } };
        },
      });
      expect(result.status).toBe("PASS");
      expect(result.artifact?.checksumSha256).toBe("20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1");
    } finally {
      await rm(inputRoot, { recursive: true, force: true });
      await rm(outputRoot, { recursive: true, force: true });
    }
  });

  it("blocks checksum and dimension mismatch before legacy rendering", async () => {
    const input = await readJson("fixtures/integration/alpha-trim-contain/input.json") as RendererIntegrationInputV1;
    const png = new Uint8Array(await readFile(path.join(projectRoot, "fixtures/valid/object-right__product__basic__pass.png")));
    const firstAsset = input.assets[0];
    expect(firstAsset).toBeDefined();
    if (!firstAsset) return;
    const mismatched = { ...input, assets: [{ ...firstAsset, declaredWidth: 999, checksumSha256: "0".repeat(64) }] };
    const result = await renderWithIntegrationAdapter(mismatched, { resolver: { resolve: async () => ({ bytes: png, resolvedMimeType: "image/png" }) }, renderLegacy: async () => { throw new Error("must not render"); } });
    expect(result.status).toBe("BLOCKED");
    expect(result.artifact).toBeUndefined();
    expect(result.validation.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining(["KBR-ASSET-CHECKSUM-MISMATCH", "KBR-ASSET-DIMENSION-MISMATCH"]));
  });

  it("blocks an unsupported production capability without auto inference", async () => {
    const input = await readJson("fixtures/integration/invalid/unsupported-capability.json") as RendererIntegrationInputV1;
    const result = await renderWithIntegrationAdapter(input, { resolver: { resolve: async () => { throw new Error("not called"); } }, renderLegacy: async () => { throw new Error("not called"); } });
    expect(result.status).toBe("BLOCKED");
    expect(result.validation.errors.map((entry) => entry.code)).toContain("KBR-TEMPLATE-CONSTRAINT-VIOLATION");
  });
});

describe("constant baseline", () => {
  it("keeps the existing OBJECT_RIGHT integration identifiers stable", () => {
    expect(OBJECT_RIGHT_FORMAT_PROFILE_ID).toBe("KAKAO_BIZBOARD_OBJECT_RIGHT");
    expect(OBJECT_RIGHT_TEMPLATE_ID).toBe("KAKAO_MOMENT_BIZBOARD_OBJECT_RIGHT_1029X258_V1");
    expect(OBJECT_RIGHT_IMAGE_SLOT_ID).toBe("OBJECT_RIGHT_PRODUCT");
  });
});
