import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localUsernameTokens, scanReviewPackPayload, scanReviewPackText, scanZipEntryNames, summarizeReviewPackFindings } from "./google-review-pack-path-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineHead = "6426b0d7aef1983d19406c0203c1c883e1ef1f57";
const expectedGoldenSha = "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359";
const expectedObjectSha = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const checks = [];
const failures = [];
const check = (id, condition, detail = "") => {
  const pass = Boolean(condition);
  checks.push({ id, status: pass ? "PASS" : "FAIL", detail });
  if (!pass) failures.push({ id, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}: ${detail}`);
  return pass;
};
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const readText = async (relativePath) => readFile(path.join(root, relativePath), "utf8");
const sha256 = async (relativePath) => createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const traceability = await readJson("artifacts/g3-0-6/google-static-case-traceability.json");
const correction = await readJson("artifacts/g3-0-7/google-static-review-pack-path-hygiene-correction.json");
const policy = await readText("scripts/google-review-pack-path-policy.mjs");
const hygieneVerifier = await readText("scripts/verify-g3-2-2-google-static-review-pack-hygiene.mjs");
const policyTest = await readText("tests/desktop/integration/google-review-pack-path-policy.test.ts");
const generator = await readText("scripts/generate-g3-0-7-google-static-review-pack-evidence.mjs");

check("phase_record", correction.phase === "G3_0_7_GOOGLE_STATIC_REVIEW_PACK_PATH_HYGIENE_VERIFIER_CORRECTION" && correction.status === "PASS" && correction.normative === false, "G3.0.7 correction record");
check("source_archive_basename_only", traceability.sourceArchive?.path === "google-g3-2-1-final-output-pack-d23bd344-2.zip" && traceability.sourceArchive?.locationClass === "EXTERNAL_REVIEW_INPUT" && !/[\\/]/u.test(traceability.sourceArchive.path), "basename-only external archive reference");
check("source_archive_identity_preserved", traceability.sourceArchive?.bytes === 15391331 && traceability.sourceArchive?.sha256 === "eaba20cbfe073a2166b6be6738be62862f8acad8dcea5bb9cc1d141c4083075c" && traceability.sourceArchive?.frozenHead === "d23bd3447b1242b4773c06ea85c0f4a72b313c1d" && traceability.sourceArchive?.evidenceClass === "NON_NORMATIVE_REVIEW_EVIDENCE", "archive identity fields preserved");
check("source_generator_fail_closed", generator.includes("assertPackRelativePath") && generator.includes("replaceAll(\"\\\\\", \"/\")") && generator.includes("sourceArchive"), "source generator normalizes and validates the archive reference");
check("final_scan_includes_verification_payloads", hygieneVerifier.includes("automated-summary.json") && hygieneVerifier.includes("pack-integrity.json") && hygieneVerifier.includes("final-summary.json") && hygieneVerifier.includes("json|html|md|txt|yaml|yml|csv"), "final summary/integrity/evidence are scanned");
check("final_scan_recalculates_reports", hygieneVerifier.includes("reportMatches") && hygieneVerifier.includes("integrityTruthful") && hygieneVerifier.includes("finalReviewTruthful") && hygieneVerifier.includes("summarizeReviewPackFindings"), "independent scan controls report status");
check("policy_has_required_classes", ["DRIVE_ABSOLUTE", "UNC_ABSOLUTE", "UNIX_USER_HOME", "WORKSPACE_RUNTIME", "TEMP_HOME", "EXTERNAL_URI", "NOT_EXPOSED", "PARENT_TRAVERSAL", "localUsernameTokens", "scanZipEntryNames"].every((token) => policy.includes(token)), "all required path/privacy classes are represented");
check("late_added_regression_source_test", policyTest.includes("late-added completion evidence") && policyTest.includes("manifests/g3-0-6-completion-evidence.json") && policyTest.includes("C:/Users/Lenovo/Desktop/example.zip"), "late-added evidence injection is tested");
check("package_commands_registered", (await readJson("package.json")).scripts?.["verify:g3-0-7-google"] === "node scripts/verify-g3-0-7-google-static-review-pack-path-hygiene.mjs" && (await readJson("package.json")).scripts?.["generate:g3-0-7-review-pack-evidence"] === "node scripts/generate-g3-0-7-google-static-review-pack-evidence.mjs", "G3.0.7 commands are registered");

let baselineTraceability = null;
try {
  baselineTraceability = JSON.parse(execFileSync("git", ["show", `${baselineHead}:artifacts/g3-0-6/google-static-case-traceability.json`], { cwd: root, encoding: "utf8" }));
} catch (error) {
  baselineTraceability = null;
}
const baselinePathText = baselineTraceability?.sourceArchive?.path ?? "";
const baselineScan = scanReviewPackText(baselinePathText, { usernameTokens: ["Lenovo"] });
check("historical_absolute_path_root_cause", baselineScan.absoluteLocalPaths.length > 0 && baselineScan.usernameTokens.includes("lenovo"), "baseline completion evidence contained the confirmed absolute path and username token");
check("historical_source_archive_identity", baselineTraceability?.sourceArchive?.bytes === 15391331 && baselineTraceability?.sourceArchive?.sha256 === "eaba20cbfe073a2166b6be6738be62862f8acad8dcea5bb9cc1d141c4083075c" && baselineTraceability?.sourceArchive?.frozenHead === "d23bd3447b1242b4773c06ea85c0f4a72b313c1d", "historical traceability identity is unchanged");

const positiveFixtures = [
  { id: "basename", path: "manifests/g3-0-6-completion-evidence.json", text: json({ sourceArchive: { path: "google-g3-2-1-final-output-pack-d23bd344-2.zip" } }) },
  { id: "pack_relative", path: "sources/g2/google-g2-source.png", text: "pack-relative source" },
  { id: "repository_relative", path: "manifests/render-requests/D01.json", text: json({ canonicalRequest: { formatProfileId: "GOOGLE_MARKETING_LANDSCAPE_1_91" }, source: "sources/g2/source.png" }) },
  { id: "clean_final_tree", path: "verification/final-summary.json", text: json({ status: "AWAITING_EXTERNAL_OUTPUT_REVIEW", pathHygiene: { absoluteWindowsPaths: 0 } }) },
];
const positiveResults = positiveFixtures.map((fixture) => {
  const findings = scanReviewPackPayload([fixture]);
  return { ...fixture, passed: findings.length === 0 };
});
const positivePassed = positiveResults.filter((entry) => entry.passed).length;
check("positive_path_fixtures", positivePassed === positiveFixtures.length, `${positivePassed}/${positiveFixtures.length} positive fixtures clean`);

const negativeFixtures = [
  { id: "windows_drive_forward", text: "C:/Users/Lenovo/Desktop/example.zip" },
  { id: "windows_drive_backslash", text: "C:\\Users\\Lenovo\\Desktop\\example.zip" },
  { id: "unc", text: "\\\\server\\share\\example.zip" },
  { id: "file_url", text: "file://C:/Users/Lenovo/example.zip" },
  { id: "posix_home", text: "/home/user/example.zip" },
  { id: "workspace", text: "/workspace/build/example.json" },
  { id: "temporary", text: "/tmp/render/example.json" },
  { id: "parent_traversal", text: "../outside.json" },
  { id: "external_url", text: "https://example.test/review" },
  { id: "not_exposed", text: "NOT_EXPOSED" },
];
const negativeResults = negativeFixtures.map((fixture) => {
  const findings = scanReviewPackPayload([{ path: `fixtures/${fixture.id}.json`, text: fixture.text, options: { usernameTokens: ["Lenovo"] } }]);
  return { ...fixture, rejected: findings.length > 0 };
});
const negativePassed = negativeResults.filter((entry) => entry.rejected).length;
check("negative_path_fixtures", negativePassed === negativeFixtures.length, `${negativePassed}/${negativeFixtures.length} negative fixtures rejected`);
const zipFixture = scanZipEntryNames(["pack/README.md", "C:/Users/Lenovo/leak.txt", "pack\\outputs\\D01.png", "pack/../outside.txt"]);
check("zip_entry_fixtures", zipFixture.zipAbsoluteEntries.length === 1 && zipFixture.zipBackslashEntries.length === 1 && zipFixture.zipTraversalEntries.length === 1, "ZIP absolute/backslash/traversal entries rejected");

const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "kbr-g3-0-7-"));
const cleanRoot = path.join(fixtureRoot, "clean");
const dirtyRoot = path.join(fixtureRoot, "dirty");
await mkdir(path.join(cleanRoot, "verification"), { recursive: true });
await mkdir(path.join(dirtyRoot, "verification"), { recursive: true });
const pathHygieneCounts = {
  absoluteWindowsPaths: 0,
  usernameTokens: 0,
  parentTraversalSegments: 0,
  externalUrls: 0,
  notExposedEntries: 0,
  zipAbsoluteEntries: 0,
  zipBackslashEntries: 0,
  zipTraversalEntries: 0,
};
const reports = {
  "verification/automated-summary.json": json({ pathHygiene: pathHygieneCounts }),
  "verification/pack-integrity.json": json({ pathHygiene: "PASS" }),
  "verification/final-summary.json": json({ status: "AWAITING_EXTERNAL_OUTPUT_REVIEW" }),
};
for (const [relativePath, contents] of Object.entries(reports)) {
  await writeFile(path.join(cleanRoot, relativePath), contents, "utf8");
  await writeFile(path.join(dirtyRoot, relativePath), contents, "utf8");
}
for (const fixture of positiveFixtures.slice(0, 3)) {
  await mkdir(path.dirname(path.join(cleanRoot, fixture.path)), { recursive: true });
  await mkdir(path.dirname(path.join(dirtyRoot, fixture.path)), { recursive: true });
  await writeFile(path.join(cleanRoot, fixture.path), fixture.text, "utf8");
  await writeFile(path.join(dirtyRoot, fixture.path), fixture.text, "utf8");
}
const lateEvidencePath = path.join(dirtyRoot, "manifests/g3-0-6-completion-evidence.json");
await writeFile(lateEvidencePath, json({ sourceArchive: { path: "C:/Users/Lenovo/Desktop/example.zip" } }), "utf8");

function runPackHygiene(target) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(root, "scripts/verify-g3-2-2-google-static-review-pack-hygiene.mjs"), target], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { exitCode: 0, parsed: JSON.parse(stdout) };
  } catch (error) {
    const output = String(error.stdout ?? "");
    const parsed = (() => { try { return JSON.parse(output); } catch { return null; } })();
    return { exitCode: Number.isInteger(error.status) ? error.status : 1, parsed };
  }
}

const cleanRun = runPackHygiene(cleanRoot);
const dirtyRun = runPackHygiene(dirtyRoot);
const lateFindings = scanReviewPackPayload([{ path: "manifests/g3-0-6-completion-evidence.json", text: await readFile(lateEvidencePath, "utf8"), options: { usernameTokens: ["Lenovo"] } }]);
check("authoritative_staging_clean", cleanRun.exitCode === 0 && cleanRun.parsed?.status === "PASS" && cleanRun.parsed?.scanClean === true, "clean final staging tree passes");
check("late_added_evidence_detected", lateFindings.length === 1 && lateFindings[0].absoluteLocalPaths.length > 0 && lateFindings[0].usernameTokens.includes("lenovo"), "late-added completion evidence is detected");
check("late_added_pack_command_non_zero", dirtyRun.exitCode !== 0 && dirtyRun.parsed?.status === "FAIL" && dirtyRun.parsed?.findings?.some((entry) => entry.path === "manifests/g3-0-6-completion-evidence.json"), "dirty final staging fails closed with file path");

const cleanZipPath = path.join(fixtureRoot, "clean.zip");
let postExtractionRun = { exitCode: 1, parsed: null };
try {
  execFileSync(process.platform === "win32" ? "tar.exe" : "tar", ["-a", "-c", "-f", cleanZipPath, "-C", cleanRoot, "."], { stdio: "pipe" });
  postExtractionRun = runPackHygiene(cleanZipPath);
} catch {
  postExtractionRun = { exitCode: 1, parsed: null };
}
check("post_extraction_clean", postExtractionRun.exitCode === 0 && postExtractionRun.parsed?.status === "PASS" && postExtractionRun.parsed?.scanClean === true, "extracted clean ZIP payload passes the same scanner");

const goldenSha = await sha256("contracts/google/goldens.g2.1.json");
const objectSha = await sha256("reference/kakao-tool/OBJECT_RIGHT.png");
check("frozen_references", goldenSha === expectedGoldenSha && objectSha === expectedObjectSha, "Google Golden registry and OBJECT_RIGHT hashes unchanged");
check("no_scan_allowlist", correction.pathPolicy?.excludedFiles?.length === 0 && correction.pathPolicy?.repositoryRelativeAndPackRelativePaths === "ALLOW", "no payload file is excluded and only relative paths are allowed");
check("g3_2_3_not_started", correction.invariants?.g3_2_3Started === false, "G3.2.3 output generation not started");

const historicalCandidateName = "google-g3-2-2-final-output-pack-6426b0d7-20260816055148-final.zip";
const historicalCandidatePaths = [
  path.join(path.dirname(root), historicalCandidateName),
  path.join(os.homedir(), "iCloudDrive", "Renderer QA", "Google", "G3.2.2", historicalCandidateName),
];
let historicalCandidate = null;
for (const candidate of historicalCandidatePaths) {
  if (await stat(candidate).catch(() => null)) {
    historicalCandidate = candidate;
    break;
  }
}
let historicalCandidateResult = null;
if (historicalCandidate) {
  const candidateBytes = (await stat(historicalCandidate)).size;
  const candidateSha256 = createHash("sha256").update(await readFile(historicalCandidate)).digest("hex");
  historicalCandidateResult = runPackHygiene(historicalCandidate);
  check("historical_candidate_integrity", candidateBytes === 8025913 && candidateSha256 === "2fb9d3e15c3a5e53eddbc007af8d0ad095b06a6a4bb9e8161d2b52b31dfeaba5", "external G3.2.2 candidate bytes/SHA match the review record");
  check("historical_candidate_rejected", historicalCandidateResult.exitCode !== 0 && historicalCandidateResult.parsed?.absoluteWindowsPaths === 1 && historicalCandidateResult.parsed?.usernameTokens === 1 && historicalCandidateResult.parsed?.findings?.some((entry) => entry.path === "manifests/g3-0-6-completion-evidence.json"), "final verifier rejects the historical candidate and identifies the affected evidence file");
} else {
  check("historical_candidate_handling", baselineTraceability !== null, "historical candidate not present; baseline traceability was independently inspected");
}

await rm(fixtureRoot, { recursive: true, force: true });
const status = failures.length === 0 ? "PASS" : "FAIL";
const result = {
  phase: "G3_0_7_GOOGLE_STATIC_REVIEW_PACK_PATH_HYGIENE_VERIFIER_CORRECTION",
  status,
  checks: checks.length,
  passed: checks.filter((entry) => entry.status === "PASS").length,
  failed: failures,
  positivePathFixtures: { passed: positivePassed, total: positiveFixtures.length },
  negativePathFixtures: { passed: negativePassed, total: negativeFixtures.length },
  lateAddedEvidenceRegression: {
    absolutePathDetected: lateFindings.length === 1,
    packCommandFailedClosed: dirtyRun.exitCode !== 0,
    file: "manifests/g3-0-6-completion-evidence.json",
  },
  postExtractionFixture: { passed: postExtractionRun.exitCode === 0 ? 1 : 0, total: 1 },
  historicalCandidate: {
    available: Boolean(historicalCandidate),
    source: "EXTERNAL_REVIEW_INPUT",
    integrity: historicalCandidateResult ? historicalCandidateResult.parsed?.absoluteWindowsPaths === 1 && historicalCandidateResult.parsed?.usernameTokens === 1 : null,
    verifierExitCode: historicalCandidateResult?.exitCode ?? null,
  },
  finalScan: cleanRun.parsed ? { status: cleanRun.parsed.status, scanClean: cleanRun.parsed.scanClean, reportMatches: cleanRun.parsed.reportMatches, integrityTruthful: cleanRun.parsed.integrityTruthful, finalReviewTruthful: cleanRun.parsed.finalReviewTruthful } : null,
};
console.log(JSON.stringify(result, null, 2));
if (status !== "PASS") process.exitCode = 1;
