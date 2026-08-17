import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

function parseReport(output: string): Record<string, unknown> {
  const start = output.lastIndexOf("\n{");
  return JSON.parse((start >= 0 ? output.slice(start + 1) : output).trim());
}

describe("P0.0.3 G0.1 Canonical compatibility verifier", () => {
  it("proves the historical audit and all SemVer fixtures", () => {
    const script = path.resolve(process.cwd(), "scripts/verify-p0-0-3-canonical-compatibility.mjs");
    const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
    const report = parseReport(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    expect(report.status).toBe("PASS");
    expect(report.positiveCases).toMatchObject({ passed: 8, total: 8 });
    expect(report.negativeCases).toMatchObject({ passed: 14, total: 14 });
    expect(report.historicalVerifierAudit).toMatchObject({
      verifiersInspected: 13,
      activeCurrentPinBlockers: [],
      currentHeadGlobalPathBlockers: [],
      unresolved: [],
    });
  });
});
