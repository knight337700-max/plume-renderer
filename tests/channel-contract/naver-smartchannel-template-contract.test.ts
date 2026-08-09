import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
type JsonRecord = Record<string, unknown>;
type TemplateRecord = JsonRecord & { templateId: string; height: number; family: string; objectKind: string; side: string; textVariant: string; affordance: string; sourceTextLabel: string; source: { sha256: string; sourcePath: string; canvas: { width: number; height: number } } };
type AffordanceRecord = { id: string; enabled: boolean };
type ContractRecord = { templateContractVersion: string; canvas: { width: number; heights: number[] }; sourceCatalog: { sourcePsdCount: number; actualPsdCount: number; countsByHeight: Record<string, number>; catalogHashCrossCheck: { catalogEntries: number; sha256Matches: number; hashMismatches: number }; canvasHeaderCheck: { badHeaders: number } }; templates: TemplateRecord[]; textVariantWhitelist: string[]; affordances: AffordanceRecord[]; runtimeBoundary: JsonRecord };
type TypographyRecord = { status: string; sourceMetadata: { inferredValuesForbidden: boolean } };
type FixedRecord = { components: Array<{ id: string; status: string }> };
type CandidateRecord = Pick<TemplateRecord, "height" | "family" | "objectKind" | "side" | "textVariant" | "affordance">;
type N2Record = { status: string; candidates: CandidateRecord[] };
type SchemaRecord = { properties: { templateContractVersion: { const: string } } };
const readJson = <T>(file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;
const contract = readJson<ContractRecord>("contracts/naver-smartchannel-template-contract.json");
const schema = readJson<SchemaRecord>("contracts/naver-smartchannel-template.schema.json");
const typography = readJson<TypographyRecord>("contracts/naver-smartchannel-typography.json");
const fixed = readJson<FixedRecord>("contracts/naver-smartchannel-fixed-components.json");
const n2 = readJson<N2Record>("contracts/naver-smartchannel-n2-candidates.json");

describe("NAVER SmartChannel N1B contract", () => {
  it("freezes the source catalog counts and canvas headers", () => {
    expect(contract.templateContractVersion).toBe("1.7.0");
    expect(contract.canvas).toMatchObject({ width: 750, heights: [160, 200, 280] });
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
      expect(contract.textVariantWhitelist).toContain(entry.textVariant);
    }
  });

  it("keeps unsupported fixed affordances and typography explicit", () => {
    const affordances = contract.affordances;
    expect(affordances.find((entry) => entry.id === "NONE")?.enabled).toBe(true);
    expect(affordances.filter((entry) => entry.enabled).map((entry) => entry.id)).toEqual(["NONE"]);
    expect(affordances.filter((entry) => entry.id !== "NONE").every((entry) => entry.enabled === false)).toBe(true);
    expect(typography.status).toBe("UNRESOLVED_SOURCE_METADATA");
    expect(typography.sourceMetadata.inferredValuesForbidden).toBe(true);
    const fixedAffordances = fixed.components.filter((entry) => entry.id.startsWith("LANDING_ICON") || entry.id.startsWith("APP_CTA"));
    expect(fixedAffordances.every((entry) => entry.status === "UNRESOLVED")).toBe(true);
  });

  it("keeps N2 candidates registry-only and source-backed", () => {
    expect(n2.status).toBe("REGISTRY_ONLY");
    expect(n2.candidates).toHaveLength(6);
    const key = (entry: JsonRecord) => [entry.height, entry.family, entry.objectKind, entry.side, entry.textVariant, entry.affordance].join("/");
    const sourceKeys = new Set(contract.templates.map(key));
    for (const candidate of n2.candidates) expect(sourceKeys.has(key(candidate))).toBe(true);
  });

  it("does not expose a SmartChannel runtime implementation", () => {
    expect(contract.runtimeBoundary).toEqual({ rendererImplemented: false, rasterImplemented: false, desktopUiImplemented: false, previewDownloadImplemented: false, runtimeStatus: "CONTRACT_ONLY" });
    expect(schema.properties.templateContractVersion.const).toBe("1.7.0");
  });
});
