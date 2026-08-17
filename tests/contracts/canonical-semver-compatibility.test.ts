import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Canonical SemVer compatibility", () => {
  it("executes the verifier-only transition matrix", () => {
    const script = path.resolve(process.cwd(), "scripts/verify-p0-0-3-canonical-compatibility.mjs");
    const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(0);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(output).toContain("PASS MINOR_1_32_0_TO_1_33_0");
    expect(output).toContain("PASS PATCH_1_32_0_TO_1_32_1");
    expect(output).toContain("PASS MAJOR_1_32_0_TO_2_0_0");
    expect(output).toContain("PASS VERSION_DOWNGRADE");
    expect(output).toContain("PASS DOCUMENT_REGISTRY_DIGEST_MISMATCH");
  });
});
