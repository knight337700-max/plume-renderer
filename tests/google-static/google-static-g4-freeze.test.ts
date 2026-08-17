import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(process.cwd());
const readJson = (file: string) => JSON.parse(readFileSync(resolve(root, file), "utf8"));
const sha256 = (file: string) => createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex");

describe("G4 Google Static release freeze contract", () => {
  test("links acceptance, external review, registry, and accepted pack identity", () => {
    const acceptance = readJson("artifacts/g4/google-static-user-acceptance.json");
    const review = readJson("artifacts/g4/google-static-external-review.json");
    const registry = readJson("contracts/google/release-freeze.g4.json");
    const packSha = "8ea80cda80f53347a08d89cadaaf5501a73fb5b687e2724fc90e111ac32d8ffa";
    expect(acceptance.userAcceptanceRecorded).toBe(true);
    expect(acceptance.acceptedPack.sha256).toBe(packSha);
    expect(review.selectedPack.sha256).toBe(packSha);
    expect(registry.acceptedPack.sha256).toBe(packSha);
    expect(registry.userAcceptance.sha256).toBe(sha256("artifacts/g4/google-static-user-acceptance.json"));
    expect(registry.externalReview.sha256).toBe(sha256("artifacts/g4/google-static-external-review.json"));
  });

  test("freezes exactly fourteen profiles and fourteen Golden identities", () => {
    const registry = readJson("contracts/google/release-freeze.g4.json");
    const goldens = readJson("contracts/google/goldens.g2.1.json");
    expect(registry.frozenProfiles).toHaveLength(14);
    expect(registry.frozenGoldens).toHaveLength(14);
    expect(registry.frozenGoldens.map((entry: { profileId: string }) => entry.profileId)).toEqual(goldens.entries.map((entry: { profileId: string }) => entry.profileId));
    expect(registry.runtimePolicy.runtimeNetworkRequests).toBe(0);
  });

  test("keeps the accepted review pack non-normative", () => {
    const registry = readJson("contracts/google/release-freeze.g4.json");
    const review = readJson("artifacts/g4/google-static-external-review.json");
    expect(registry.acceptedPack.evidenceClass).toBe("NON_NORMATIVE_REVIEW_EVIDENCE");
    expect(review.evidenceClass).toBe("INDEPENDENT_EXTERNAL_REVIEW");
    expect(registry.evidencePolicy.acceptedPackReclassified).toBe(false);
  });
});
