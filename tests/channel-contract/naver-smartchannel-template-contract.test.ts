import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
type JsonRecord = Record<string, unknown>;
type TemplateRecord = JsonRecord & { templateId: string; height: number; family: string; objectKind: string; side: string; textVariant: string; affordance: string; sourceTextLabel: string; objectPlacementToken: string; source: { sha256: string; sourcePath: string; canvas: { width: number; height: number } } };
type AffordanceRecord = { id: string; enabled: boolean };
type ContractRecord = { registryVersion: string; templateContractVersion: string; objectPlacementContractRef: string; objectPlacementSchemaRef: string; objectPlacementStatus: string; canvas: { width: number; heights: number[] }; sourceCatalog: { sourcePsdCount: number; actualPsdCount: number; countsByHeight: Record<string, number>; catalogHashCrossCheck: { catalogEntries: number; sha256Matches: number; hashMismatches: number }; canvasHeaderCheck: { badHeaders: number } }; templates: TemplateRecord[]; textVariantWhitelist: string[]; affordances: AffordanceRecord[]; runtimeBoundary: JsonRecord };
type TypographyRecord = {
  registryVersion: string;
  status: string;
  exactSourceFontIdentity: string;
  sourceFonts: Array<{ postScriptName: string; classification: string }>;
  tokens: Array<{ classification: string }>;
  runtimeResolution: string;
  runtimeFontAssets: Array<{ resolution: string; sourceIdentityToPSD: string; bundleAllowed?: boolean; required?: boolean }>;
  n2Blocking: boolean;
};
type FixedRecord = {
  components: Array<{ id: string; status: string; n2Blocking?: boolean }>;
  specialGeometry: {
    disclosure160TwoLine: { status: string; invariants: { line1ToLine2BaselineGapPx: number[] } };
    landingIcon200OnePixel: { status: string; classification: string; rawPixelDigestSame: boolean; trimmedPixelDigestSame: boolean };
    thumbnail280CurrentRule: { status: string; width: number; height: number };
    object260: { status: string; classification: string; n2Blocking: boolean };
  };
};
type CandidateRecord = Pick<TemplateRecord, "height" | "family" | "objectKind" | "side" | "textVariant" | "affordance">;
type N2Record = { status: string; candidates: CandidateRecord[]; sourceResolutionStatus: string; sourceBacked: boolean; readiness: { ready: boolean; blockers: string[] } };
type SchemaRecord = { properties: { templateContractVersion: { const: string } } };
type SourceRevisionRecord = {
  status: string;
  sourceRevision: { officialNonMacPsdCount: number; localPsdCount: number; hashSetMatch: boolean; hashMismatches: number };
  currentOfficialRules: {
    thumbnail280: { width: number; height: number; sourcePsdMatches: boolean };
    logoVerticalMargin24: { top: number; bottom: number };
  };
};
type CtaRecord = { status: string; compact160200: { allowedLabels: string[] }; options280: Array<{ label: string; sourceOccurrences: unknown[] }> };
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;
const contract = readJson<ContractRecord>("contracts/naver-smartchannel-template-contract.json");
const schema = readJson<SchemaRecord>("contracts/naver-smartchannel-template.schema.json");
const typography = readJson<TypographyRecord>("contracts/naver-smartchannel-typography.json");
const fixed = readJson<FixedRecord>("contracts/naver-smartchannel-fixed-components.json");
const n2 = readJson<N2Record>("contracts/naver-smartchannel-n2-candidates.json");
const sourceRevision = readJson<SourceRevisionRecord>("contracts/naver-smartchannel-source-revision.json");
const cta = readJson<CtaRecord>("contracts/naver-smartchannel-cta-options.json");

describe("NAVER SmartChannel N1C source-resolution contract", () => {
  it("freezes the source catalog counts and canvas headers", () => {
    expect(contract.registryVersion).toBe("1.4.0");
    expect(contract.templateContractVersion).toBe("1.10.0");
    expect(contract.canvas).toMatchObject({ width: 750, heights: [160, 200, 280] });
    expect(contract).toMatchObject({ objectPlacementContractRef: "contracts/naver-smartchannel-object-placement.json", objectPlacementSchemaRef: "contracts/naver-smartchannel-object-placement.schema.json", objectPlacementStatus: "SOURCE_RESOLVED_PROJECT_CONTRACT" });
    expect(contract.sourceCatalog.sourcePsdCount).toBe(120);
    expect(contract.sourceCatalog.actualPsdCount).toBe(120);
    expect(contract.sourceCatalog.countsByHeight).toEqual({ "160": 32, "200": 32, "280": 56 });
    expect(contract.sourceCatalog.catalogHashCrossCheck).toMatchObject({ catalogEntries: 120, sha256Matches: 120, hashMismatches: 0 });
    expect(contract.sourceCatalog.canvasHeaderCheck.badHeaders).toBe(0);
  });

  it("maintains a 120-to-120 template and PSD bijection", () => {
    const templates = contract.templates;
    expect(templates).toHaveLength(120);
    expect(new Set(templates.map((entry) => entry.templateId)).size).toBe(120);
    expect(new Set(templates.map((entry) => entry.source.sha256)).size).toBe(120);
    for (const entry of templates) {
      expect(entry.templateId).toMatch(/^NAVER_SMARTCHANNEL_/);
      expect(entry.source.sourcePath).not.toMatch(/^[A-Za-z]:[\\/]/);
      expect(entry.source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.source.canvas).toEqual({ width: 750, height: entry.height });
      expect(entry.objectPlacementToken).toMatch(/^NAVER_SC_/);
      expect(contract.textVariantWhitelist).toContain(entry.textVariant);
    }
  });

  it("freezes source typography and fixed affordances without inventing runtime assets", () => {
    const affordances = contract.affordances;
    expect(affordances.find((entry) => entry.id === "NONE")?.enabled).toBe(true);
    expect(affordances.filter((entry) => entry.enabled).map((entry) => entry.id)).toEqual(["NONE"]);
    expect(affordances.filter((entry) => entry.id !== "NONE").every((entry) => entry.enabled === false)).toBe(true);
    expect(typography.registryVersion).toBe("1.3.0");
    expect(typography.status).toBe("SOURCE_METADATA_FROZEN");
    expect(typography.exactSourceFontIdentity).toBe("PASS");
    expect(typography.sourceFonts.every((font) => font.classification === "SOURCE_CONFIRMED")).toBe(true);
    expect(typography.tokens).toHaveLength(25);
    expect(typography.tokens.every((token) => token.classification === "DERIVED_FROM_EXACT_SOURCE_METADATA")).toBe(true);
    expect(typography.runtimeResolution).toBe("OFFICIAL_ASSET_REQUIRED");
    expect(typography.runtimeFontAssets).toHaveLength(3);
    expect(typography.runtimeFontAssets.filter((asset) => asset.required !== false)).toHaveLength(2);
    expect(typography.runtimeFontAssets.every((asset) => asset.resolution !== "PROJECT_COMPATIBLE_VERIFIED" && asset.bundleAllowed === false)).toBe(true);
    expect(typography.n2Blocking).toBe(true);
    const fixedAffordances = fixed.components.filter((entry) => entry.id.startsWith("LANDING_ICON") || entry.id.startsWith("APP_CTA"));
    expect(fixedAffordances.every((entry) => entry.status === "FROZEN")).toBe(true);
    expect(fixed.specialGeometry.disclosure160TwoLine.status).toBe("FROZEN");
    expect(fixed.specialGeometry.disclosure160TwoLine.invariants.line1ToLine2BaselineGapPx).toEqual([24]);
    expect(fixed.specialGeometry.landingIcon200OnePixel).toMatchObject({ status: "RESOLVED", classification: "PSD_AUTHORING_INCONSISTENCY", rawPixelDigestSame: true, trimmedPixelDigestSame: true });
    expect(fixed.specialGeometry.thumbnail280CurrentRule).toMatchObject({ status: "FROZEN", width: 200, height: 200 });
    expect(fixed.specialGeometry.object260).toMatchObject({ status: "DEFERRED_NON_BLOCKING", classification: "GUIDE_NOTE_NOT_MACHINE_ENFORCEABLE", n2Blocking: false });
  });

  it("freezes official source revision and CTA options", () => {
    expect(sourceRevision.status).toBe("SOURCE_CONFIRMED");
    expect(sourceRevision.sourceRevision).toMatchObject({ officialNonMacPsdCount: 120, localPsdCount: 120, hashSetMatch: true, hashMismatches: 0 });
    expect(sourceRevision.currentOfficialRules.thumbnail280).toMatchObject({ width: 200, height: 200, sourcePsdMatches: true });
    expect(sourceRevision.currentOfficialRules.logoVerticalMargin24).toMatchObject({ top: 24, bottom: 24 });
    expect(cta.status).toBe("SOURCE_CONFIRMED");
    expect(cta.compact160200.allowedLabels).toHaveLength(11);
    expect(cta.options280).toHaveLength(11);
    expect(cta.options280.every((entry) => entry.sourceOccurrences.length === 8)).toBe(true);
  });

  it("keeps N2 candidates registry-only and source-backed", () => {
    expect(n2.status).toBe("REGISTRY_ONLY");
    expect(n2.candidates).toHaveLength(6);
    expect(n2.sourceResolutionStatus).toBe("SOURCE_RESOLVED_PROJECT_COMPATIBLE");
    expect(n2.sourceBacked).toBe(true);
    expect(n2.readiness).toMatchObject({ ready: true, blockers: [], runtimeFontMode: "PROJECT_COMPATIBLE_VERIFIED" });
    const key = (entry: JsonRecord) => [entry.height, entry.family, entry.objectKind, entry.side, entry.textVariant, entry.affordance].join("/");
    const sourceKeys = new Set(contract.templates.map(key));
    for (const candidate of n2.candidates) expect(sourceKeys.has(key(candidate))).toBe(true);
  });

  it("does not expose a SmartChannel runtime implementation", () => {
    expect(contract.runtimeBoundary).toEqual({ rendererImplemented: false, rasterImplemented: false, desktopUiImplemented: false, previewDownloadImplemented: false, runtimeStatus: "CONTRACT_ONLY" });
    expect(schema.properties.templateContractVersion.const).toBe("1.10.0");
  });
});
