import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const failures = [];
const check = (id, condition, detail = "") => {
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push({ id, detail });
  console.log(`${status} ${id}: ${detail}`);
};
const readText = async (relativePath) => readFile(path.join(root, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));
const sha256 = async (relativePath) => createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");

const versions = await readJson("contracts/contract-versions.json");
const packageJson = await readJson("package.json");
const traceability = await readJson("artifacts/g3-0-6/google-static-case-traceability.json");
const g0 = await readText("scripts/verify-g0-1-google-architecture-freeze.mjs");
const g304 = await readText("scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs");
const g305Test = await readText("tests/e2e/google-static-g3-0-5.spec.ts");
const packPolicyTest = await readText("tests/desktop/integration/google-review-pack-path-policy.test.ts");
const g3_0_5ProductionPath = "apps/desktop/renderer-ui/src/features/google/google-preview-geometry.ts";
const requiredCases = ["D02", "D03", "D04", "D05", "D06", "T03", "T04", "T05", "T06", "T07", "T08"];
const expectedCases = {
  D02: { kind: "DEFAULT", coverage: "CONSTRAINED_VIEWPORT", profileId: "GOOGLE_MARKETING_SQUARE_1_1", format: "JPEG", placement: { x: 0.5, y: 0.5, scale: 1 } },
  D03: { kind: "DEFAULT", coverage: "CONSTRAINED_VIEWPORT", profileId: "GOOGLE_MARKETING_PORTRAIT_4_5", format: "PNG", placement: { x: 0.5, y: 0.5, scale: 1 } },
  D04: { kind: "DEFAULT", coverage: "CONSTRAINED_VIEWPORT", profileId: "GOOGLE_RDA_VERTICAL_9_16", format: "PNG", placement: { x: 0.5, y: 0.5, scale: 1 } },
  D05: { kind: "DEFAULT", coverage: "CONSTRAINED_VIEWPORT", profileId: "GOOGLE_DEMAND_GEN_VERTICAL_9_16", format: "JPEG", placement: { x: 0.5, y: 0.5, scale: 1 } },
  D06: { kind: "DEFAULT", coverage: "CONSTRAINED_VIEWPORT", profileId: "GOOGLE_LOGO_SQUARE_1_1", format: "PNG", placement: { x: 0.5, y: 0.5, scale: 1 } },
  T03: { kind: "TRANSFORM", coverage: "TRANSFORM", profileId: "GOOGLE_MARKETING_SQUARE_1_1", format: "PNG", target: { x: 0.62, y: 0.38, scale: 1.22 }, interaction: "drag + zoom", pointer: true },
  T04: { kind: "TRANSFORM", coverage: "TRANSFORM", profileId: "GOOGLE_MARKETING_PORTRAIT_4_5", format: "JPEG", target: { x: 0.44, y: 0.6, scale: 1.15 }, interaction: "numeric", pointer: false },
  T05: { kind: "TRANSFORM", coverage: "TRANSFORM", profileId: "GOOGLE_RDA_VERTICAL_9_16", format: "PNG", target: { x: 0.56, y: 0.44, scale: 1.18 }, interaction: "drag + numeric scale", pointer: true },
  T06: { kind: "TRANSFORM", coverage: "TRANSFORM", profileId: "GOOGLE_DEMAND_GEN_VERTICAL_9_16", format: "JPEG", target: { x: 0.48, y: 0.35, scale: 1.25 }, interaction: "numeric", pointer: false },
  T07: { kind: "TRANSFORM", coverage: "TRANSFORM", profileId: "GOOGLE_LOGO_SQUARE_1_1", format: "PNG", target: { x: 0.5, y: 0.5, scale: 1.1 }, interaction: "zoom", pointer: false },
  T08: { kind: "TRANSFORM", coverage: "TRANSFORM", profileId: "GOOGLE_LOGO_LANDSCAPE_4_1", format: "JPEG", target: { x: 0.57, y: 0.5, scale: 1.12 }, interaction: "drag + zoom", pointer: true },
};
const hasExactTransform = (actual, expected) => actual && expected && actual.x === expected.x && actual.y === expected.y && actual.scale === expected.scale;
const hasExactPlacement = (actual, expected) => hasExactTransform(actual, expected);
const hasTest = (entry, file, title, coverage) => Array.isArray(entry?.connectedAutomatedTests) && entry.connectedAutomatedTests.some((test) => test?.file === file && test?.title === title && test?.coverage === coverage);

check("version_policy_unchanged", versions?.documentVersion?.current === "1.31.1" && versions?.desktopAppVersion === "0.13.1" && packageJson?.version === "0.13.1", JSON.stringify({ document: versions?.documentVersion?.current, desktop: versions?.desktopAppVersion, package: packageJson?.version }));
check("exact_g3_0_5_source_allowlist", g0.includes(`const g3_0_5ProductionPaths = new Set([\n  \"${g3_0_5ProductionPath}\",\n]);`) && g0.includes("g3_0_5ProductionPaths.has(relativePath)"), g3_0_5ProductionPath);
check("no_g3_0_5_allowlist_wildcards", !g0.includes("g3_0_5ProductionPaths = new Set([\"*\"]") && !g0.includes("g3_0_5ProductionPaths = new Set([\"**\"]") && !g0.includes("g3_0_5ProductionPaths.has(relativePath +"), "exact Set membership only");
check("historical_verifier_exact_frozen_sets", g304.includes("const exactTreePaths") && g304.includes("const frozenChannelPaths = new Set") && !g304.includes("frozen_channel_paths_unchanged\", ![...changed].some((entry) => /"), "no regex/prefix frozen-channel assertion");
check("case_traceability_shape", traceability?.phase === "G3_0_6_GOOGLE_STATIC_VERIFICATION_GATE_AND_CROSS_CHANNEL_REGRESSION_REPAIR" && traceability?.normative === false && traceability?.authorityScope === "CASE_ID_AND_EXECUTED_INPUT_TRACEABILITY_ONLY" && traceability?.evidenceClass === "NON_NORMATIVE_REVIEW_EVIDENCE" && traceability?.sourceArchive?.normative === false && traceability?.sourceArchive?.evidenceClass === "NON_NORMATIVE_REVIEW_EVIDENCE" && traceability?.sourceArchive?.bytes === 15391331 && traceability?.sourceArchive?.sha256 === "eaba20cbfe073a2166b6be6738be62862f8acad8dcea5bb9cc1d141c4083075c" && traceability?.sourceArchive?.frozenHead === "d23bd3447b1242b4773c06ea85c0f4a72b313c1d" && traceability?.sourceArchive?.integrityStatus === "PASS" && traceability?.integrity?.centralDirectory === "PASS" && traceability?.integrity?.packManifest?.status === "PASS" && traceability?.integrity?.sha256Sums?.status === "PASS" && traceability?.integrity?.finalSummary?.status === "PASS" && traceability?.integrity?.caseJsonChecks?.passed === 11 && traceability?.integrity?.renderRequestChecks?.passed === 11 && traceability?.integrity?.canonicalRequestChecks?.passed === 11 && traceability?.integrity?.manifestDigestChecks?.passed === 11 && traceability?.integrity?.sourceDigestChecks?.passed === 11 && traceability?.integrity?.crossReferenceChecks?.passed === 11 && traceability?.integrity?.prohibitedEntries === 0 && Array.isArray(traceability?.resolvedCases) && Array.isArray(traceability?.missingCaseIds), JSON.stringify({ status: traceability?.status, missing: traceability?.missingCaseIds?.length, resolved: traceability?.resolvedCases?.length, authority: traceability?.authorityScope }));
const missing = requiredCases.filter((id) => !traceability?.resolvedCases?.some((entry) => entry?.caseId === id));
const invalidCases = requiredCases.filter((id) => {
  const expected = expectedCases[id];
  const entry = traceability?.resolvedCases?.find((candidate) => candidate?.caseId === id);
  if (!entry || entry.kind !== expected.kind || entry.coverage !== expected.coverage || entry.profileId !== expected.profileId || entry.format !== expected.format || entry.normative !== false || entry.sourceArchiveSha256 !== traceability?.sourceArchive?.sha256 || entry.source?.sha256 !== entry.source?.internalFileSha256 || !entry.source?.repositoryPath || !entry.source?.packPath || !entry.canonicalRequest?.path || !entry.renderRequest?.path || !entry.caseEvidence?.path || !entry.outputManifest?.path) return true;
  if (expected.kind === "DEFAULT" && !hasExactPlacement(entry.placement, expected.placement)) return true;
  if (expected.kind === "TRANSFORM" && (!hasExactTransform(entry.target, expected.target) || entry.interaction !== expected.interaction)) return true;
  const transformTest = hasTest(entry, "tests/e2e/desktop.spec.ts", "G3.0.4 actual Electron transforms change canonical output and Reset restores the Golden", "TRANSFORM");
  const constrainedTest = hasTest(entry, "tests/e2e/google-static-g3-0-5.spec.ts", "Fit contains every profile across resize and constrained-height viewport", "CONSTRAINED_VIEWPORT");
  const pointerTest = hasTest(entry, "tests/e2e/google-static-g3-0-5.spec.ts", "pointer uses displayed content rect and letterbox is a no-op", "POINTER_PARITY");
  if (expected.kind === "DEFAULT" && !constrainedTest) return true;
  if (expected.kind === "TRANSFORM" && (!transformTest || (expected.pointer && !pointerTest) || (!expected.pointer && pointerTest && id === "T04"))) return true;
  return false;
});
check("case_traceability_complete", missing.length === 0 && invalidCases.length === 0 && traceability?.missingCaseIds?.length === 0, missing.length === 0 && invalidCases.length === 0 ? "all required cases resolved and cross-referenced" : `missing or invalid authoritative definitions: ${[...missing, ...invalidCases].join(",")}`);
check("wheel_zoom_lock_automatic_test", g305Test.includes("WHEEL_ZOOM") && g305Test.includes("mouse.wheel"), "Uploaded Display wheel input is asserted as a no-op");
check("view_only_invariant_automatic_test", g305Test.includes("canonicalRequest") && g305Test.includes("renderFingerprint") && g305Test.includes("placementPlan") && g305Test.includes("setSize"), "Fit/Actual and resize preserve request/fingerprint/placement");
check("review_pack_path_policy_contract_test", packPolicyTest.includes("scanReviewPackPayload") && packPolicyTest.includes("assertPackRelativePath") && packPolicyTest.includes("absoluteLocalPaths") && packPolicyTest.includes("canonicalRequest") && packPolicyTest.includes("entryPaths"), "canonical-request relative-path fixture is present");
check("frozen_references", await sha256("contracts/google/goldens.g2.1.json") === "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359" && await sha256("reference/kakao-tool/OBJECT_RIGHT.png") === "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b", "Golden registry and OBJECT_RIGHT hashes unchanged");
check("g3_0_5_evidence_status", traceability?.status === "PASS" && traceability?.blocker?.status === "NONE" && traceability?.blocker?.code === "NONE", JSON.stringify({ status: traceability?.status, blocker: traceability?.blocker?.code }));

const status = failures.length === 0 ? "PASS" : (missing.length > 0 ? "BLOCKED" : "FAIL");
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, missingCaseIds: missing }, null, 2));
if (status !== "PASS") process.exitCode = 1;
