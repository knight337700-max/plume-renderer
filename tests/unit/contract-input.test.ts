import { beforeAll, describe, expect, it } from "vitest";

import {
  applyDefaults,
  canonicalDigest,
  canonicalJson,
  loadContracts,
  normalizeInput,
  parseJsonInput,
  SchemaValidators,
} from "../../src/core/index.js";
import type { KakaoBizboardInputV1 } from "../../src/core/types.js";
import { loadValidInput, projectRoot } from "../helpers.js";

describe("input contract and canonicalization", () => {
  let validInput: KakaoBizboardInputV1;
  let validators: SchemaValidators;
  let contracts: Awaited<ReturnType<typeof loadContracts>>;

  beforeAll(async () => {
    validInput = await loadValidInput();
    contracts = await loadContracts(projectRoot);
    validators = new SchemaValidators(contracts);
  });

  it("materializes every public default before canonical digesting", () => {
    const canonical = normalizeInput(applyDefaults(validInput));

    expect(canonical.canvas).toEqual({ width: 1029, height: 258 });
    expect(canonical.cta).toEqual({
      mode: "NONE",
      landingType: "DIRECT_URL",
      label: null,
      iconPath: null,
    });
    expect(canonical.assets.product).toMatchObject({ expectedSha256: null, alphaTrim: true });
    expect(canonical.render).toEqual({
      templateContractVersion: "1.1.0",
      includeDebugOverlay: false,
      pixelRatio: 1,
    });
    expect(canonical.output.overwrite).toBe(false);
    expect(canonicalDigest(canonical)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes NFC, copy spaces, and project-relative path separators", () => {
    const input = structuredClone(validInput);
    input.advertiser.text = "  자코모  ";
    input.copy.headline = "  자코모   프리미엄 소파 ";
    input.assets.product.path = "fixtures\\valid\\object-right__product__basic__pass.png";

    const canonical = normalizeInput(applyDefaults(input));

    expect(canonical.advertiser.text).toBe("자코모");
    expect(canonical.copy.headline).toBe("자코모 프리미엄 소파");
    expect(canonical.assets.product.path).toBe("fixtures/valid/object-right__product__basic__pass.png");
  });

  it("uses RFC 8785-compatible canonical object ordering without whitespace", () => {
    expect(canonicalJson({ z: 1, a: [3, { y: true, x: "가" }] })).toBe(
      '{"a":[3,{"x":"가","y":true}],"z":1}',
    );
  });

  it("maps AJV failures to stable sorted KBR issues", () => {
    const result = validators.validateInput({});
    expect(result.valid).toBe(false);
    if (result.valid) return;

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every(({ code, messageKey }) => code.startsWith("KBR-") && messageKey.length > 0)).toBe(true);
    expect(result.issues.map(({ path }) => path)).toEqual(
      [...result.issues.map(({ path }) => path)].sort((left, right) => left.localeCompare(right, "en")),
    );
    expect(result.issues.some(({ path }) => path === "/schemaVersion")).toBe(true);
  });

  it("returns the deterministic JSON parse error without exposing parser text", () => {
    const result = parseJsonInput("{broken", contracts);
    expect(result).toEqual({
      valid: false,
      issues: [
        {
          code: "KBR-INPUT-001",
          severity: "ERROR",
          path: "/",
          messageKey: "input.json_parse_failed",
        },
      ],
    });
  });
});
