import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  ARTIFACT_CARDINALITIES,
  CHANNEL_IDS,
  COMPOSITION_MODES,
  NAVER_GFA_PLACEMENTS,
  guardCompositionDispatch,
  isArtifactCardinality,
  isChannelId,
  isCompositionMode,
  isNaverGfaPlacement,
  materializeFormatProfileCapability,
  validateChannelPlacementCapability,
  type FormatProfile,
} from "../../packages/renderer-contract/src/index.js";
import { computeFreeformFingerprints } from "../../packages/renderer-contract/src/freeform.js";
import { validateCreativeLayoutPlan } from "../../packages/renderer-contract/src/freeform.js";

const root = path.resolve(import.meta.dirname, "../..");
const readJson = async <T = unknown>(file: string): Promise<T> => JSON.parse(await readFile(path.join(root, file), "utf8")) as T;
const sha256 = async (file: string): Promise<string> => createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");

describe("N1A channel namespace and orthogonal capability axes", () => {
  it("accepts canonical namespaces and rejects unknown values", () => {
    expect(CHANNEL_IDS).toEqual(["KAKAO_MOMENT", "NAVER_GFA"]);
    expect(isChannelId("KAKAO_MOMENT")).toBe(true);
    expect(isChannelId("NAVER_GFA")).toBe(true);
    expect(isChannelId("META")).toBe(false);
    expect(isCompositionMode("RENDERER_COMPOSED")).toBe(true);
    expect(isCompositionMode("PLATFORM_COMPOSED")).toBe(true);
    expect(isCompositionMode("FLATTENED")).toBe(false);
    expect(isArtifactCardinality("SINGLE")).toBe(true);
    expect(isArtifactCardinality("COLLECTION")).toBe(true);
    expect(isArtifactCardinality("BATCH")).toBe(false);
  });

  it("keeps placement identifiers channel-scoped", () => {
    expect(NAVER_GFA_PLACEMENTS).toHaveLength(8);
    expect(isNaverGfaPlacement("SMARTCHANNEL")).toBe(true);
    expect(isNaverGfaPlacement("BIZBOARD_OBJECT_RIGHT")).toBe(false);
    expect(validateChannelPlacementCapability({
      channel: "NAVER_GFA",
      placement: "SMARTCHANNEL",
      compositionMode: "RENDERER_COMPOSED",
      layoutMode: "TEMPLATE_LOCKED",
      artifactCardinality: "SINGLE",
      runtimeStatus: "CONTRACT_ONLY",
    })).toEqual([]);
    expect(validateChannelPlacementCapability({
      channel: "NAVER_GFA",
      placement: "UNKNOWN_PLACEMENT",
      compositionMode: "RENDERER_COMPOSED",
      layoutMode: "TEMPLATE_LOCKED",
      artifactCardinality: "SINGLE",
      runtimeStatus: "CONTRACT_ONLY",
    }).map((entry) => entry.code)).toContain("PLACEMENT_UNKNOWN");
  });

  it("requires layout only for renderer-composed capabilities and reserves collection semantics", () => {
    expect(validateChannelPlacementCapability({
      channel: "NAVER_GFA",
      placement: "MOBILE_NATIVE",
      compositionMode: "PLATFORM_COMPOSED",
      artifactCardinality: "SINGLE",
      runtimeStatus: "DEFERRED",
    })).toEqual([]);
    expect(validateChannelPlacementCapability({
      channel: "NAVER_GFA",
      placement: "MOBILE_DA",
      compositionMode: "RENDERER_COMPOSED",
      artifactCardinality: "COLLECTION",
      runtimeStatus: "CONTRACT_ONLY",
    }).map((entry) => entry.code)).toContain("LAYOUT_MODE_REQUIRED");
    expect(validateChannelPlacementCapability({
      channel: "NAVER_GFA",
      placement: "MOBILE_NATIVE",
      compositionMode: "PLATFORM_COMPOSED",
      layoutMode: "FREEFORM",
      artifactCardinality: "SINGLE",
      runtimeStatus: "DEFERRED",
    }).map((entry) => entry.code)).toContain("LAYOUT_MODE_FORBIDDEN");
    expect(ARTIFACT_CARDINALITIES).toEqual(["SINGLE", "COLLECTION"]);
    expect(COMPOSITION_MODES).toEqual(["RENDERER_COMPOSED", "PLATFORM_COMPOSED"]);
  });

  it("maps every existing Kakao/FREEFORM profile without changing its layout", async () => {
    const registry = await readJson<{ profiles: FormatProfile[] }>("contracts/freeform-format-profiles.json");
    for (const rawProfile of registry.profiles as FormatProfile[]) {
      const materialized = materializeFormatProfileCapability(rawProfile);
      expect(materialized.channelNamespace).toBe("KAKAO_MOMENT");
      expect(materialized.compositionMode).toBe("RENDERER_COMPOSED");
      expect(materialized.artifactCardinality).toBe("SINGLE");
      expect(materialized.layoutMode).toBe(rawProfile.layoutMode);
    }
  });

  it("blocks platform-composed dispatch without fabricating a raster", () => {
    const fakePlatformCapability = {
      channel: "NAVER_GFA" as const,
      placement: "MOBILE_NATIVE",
      compositionMode: "PLATFORM_COMPOSED" as const,
      artifactCardinality: "SINGLE" as const,
      runtimeStatus: "DEFERRED" as const,
    };
    const result = guardCompositionDispatch(fakePlatformCapability);
    expect(result.allowed).toBe(false);
    expect(result.finalRasterOutputAllowed).toBe(false);
    if (!result.allowed) {
      expect(result.status).toBe("NOT_SUPPORTED");
      expect(result.code).toBe("KBR-COMPOSITION-MODE-NOT-SUPPORTED");
    }
  });

  it("validates the machine-readable registry and keeps legacy plan JSON decodable", async () => {
    const schema = await readJson<Record<string, unknown>>("packages/renderer-contract/schema/channel-capabilities-v1.schema.json");
    const registry = await readJson<Record<string, unknown> & { channels: string[] }>("contracts/channel-capabilities.json");
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);
    expect(validate(registry)).toBe(true);
    const invalid = structuredClone(registry);
    invalid.channels = [...invalid.channels, "UNKNOWN"];
    expect(validate(invalid)).toBe(false);

    const legacyPlan = await readJson<Record<string, unknown>>("fixtures/freeform/creative-layout-plan-v1/minimal-valid.json");
    expect(validateCreativeLayoutPlan(legacyPlan)).toEqual([]);
  });

  it("keeps metadata out of pixel fingerprints", async () => {
    const plan = await readJson<Parameters<typeof computeFreeformFingerprints>[0]>("fixtures/freeform/creative-layout-plan-v1/minimal-valid.json");
    const legacyProfile: FormatProfile = {
      formatProfileId: plan.formatProfileId,
      canvas: { width: 1029, height: 258 },
      layoutMode: "FREEFORM",
      allowedOutputFormats: ["PNG"],
      implementationStatus: "IMPLEMENTED",
    };
    const materialized = materializeFormatProfileCapability(legacyProfile);
    const before = await computeFreeformFingerprints(plan, {}, legacyProfile);
    const after = await computeFreeformFingerprints(plan, {}, materialized);
    expect(after.pixelFingerprint).toBe(before.pixelFingerprint);
  });

  it("keeps all existing Kakao golden bytes unchanged", async () => {
    const expected: Record<string, string> = {
      "fixtures/golden/object-right__stable__golden.png": "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1",
      "fixtures/golden/thumbnail-box-right__valid__golden.png": "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996",
      "fixtures/golden/thumbnail-multi-right__valid__golden.png": "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
      "fixtures/golden/mask-semicircle-right__valid__golden.png": "ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145",
    };
    for (const [file, digest] of Object.entries(expected)) expect(await sha256(file)).toBe(digest);
  });
});
