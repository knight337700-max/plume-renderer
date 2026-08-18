import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function runVerifier(): { status: string; positiveCases: { passed: number; total: number }; negativeCases: { passed: number; total: number }; candidatePreservation: { passed: boolean } } {
  return JSON.parse(execFileSync(process.execPath, ["scripts/verify-p0-0-4-candidate-compatibility.mjs"], { cwd: root, encoding: "utf8" })) as {
    status: string;
    positiveCases: { passed: number; total: number };
    negativeCases: { passed: number; total: number };
    candidatePreservation: { passed: boolean };
  };
}

describe("P0.0.4 candidate historical verifier compatibility", () => {
  it("proves the actual dirty P0 candidate and all expected-failure mutations", () => {
    const result = runVerifier();
    expect(result.status).toBe("PASS");
    expect(result.positiveCases.passed).toBe(result.positiveCases.total);
    expect(result.negativeCases.passed).toBe(result.negativeCases.total);
    expect(result.candidatePreservation.passed).toBe(true);
  });
});
