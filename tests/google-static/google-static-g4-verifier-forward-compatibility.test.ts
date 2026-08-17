import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("G4 verifier forward compatibility", () => {
  test("proves future current versions while retaining historical failure guards", () => {
    const output = execFileSync(process.execPath, [path.resolve(process.cwd(), "scripts/verify-p0-0-1-g4-forward-compatibility.mjs")], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const reportLine = output.trim().split(/\r?\n/u).at(-1);
    if (!reportLine) throw new Error("P0.0.1 verifier did not emit a report");
    const report = JSON.parse(reportLine);
    expect(report.status).toBe("PASS");
    expect(report.checks).toBe(13);
    expect(report.passed).toBe(13);
    expect(report.failed).toEqual([]);
  });
});
