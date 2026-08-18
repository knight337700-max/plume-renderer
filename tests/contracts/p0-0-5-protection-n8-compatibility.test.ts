import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("P0.0.5 protection and N8 forward compatibility", () => {
  it("passes the integrated compatibility verifier", () => {
    const output = execFileSync(process.execPath, ["scripts/verify-p0-0-5-protection-n8-compatibility.mjs"], { cwd: process.cwd(), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const lines = output.trim().split(/\r?\n/u);
    let result: { status: string; positiveCases: { passed: number; total: number }; negativeCases: { passed: number; total: number }; p0_0_4Proof: { passed: number; total: number } } | undefined;
    for (let index = 0; index < lines.length; index += 1) {
      try { result = JSON.parse(lines.slice(index).join("\n")) as typeof result; break; } catch { /* continue */ }
    }
    expect(result?.status).toBe("PASS");
    expect(result?.positiveCases.passed).toBe(result?.positiveCases.total);
    expect(result?.negativeCases.passed).toBe(result?.negativeCases.total);
    expect(result?.p0_0_4Proof).toEqual({ passed: 29, total: 29 });
  }, 120_000);
});
