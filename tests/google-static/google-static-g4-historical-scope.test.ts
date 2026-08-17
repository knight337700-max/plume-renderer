import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("G4 historical change-scope forward compatibility", () => {
  test("proves the historical boundary and protected-artifact mutation guards", () => {
    const output = execFileSync(process.execPath, [path.resolve(process.cwd(), "scripts/verify-p0-0-2-g4-historical-scope.mjs")], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const reportLine = output.trim().split(/\r?\n/u).at(-1);
    if (!reportLine) throw new Error("P0.0.2 verifier did not emit a report");
    const report = JSON.parse(reportLine);
    expect(report.status).toBe("PASS");
    expect(report.expectedHistoricalCount).toBe(26);
    expect(report.actualHistoricalCount).toBe(26);
    expect(report.positives).toBeGreaterThanOrEqual(6);
    expect(report.negatives).toBe(15);
    expect(report.failed).toEqual([]);
  });
});
