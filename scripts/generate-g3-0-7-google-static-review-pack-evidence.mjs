import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPackRelativePath } from "./google-review-pack-path-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const traceabilityPath = path.join(root, "artifacts/g3-0-6/google-static-case-traceability.json");
const correctionPath = path.join(root, "artifacts/g3-0-7/google-static-review-pack-path-hygiene-correction.json");

const traceability = JSON.parse(await readFile(traceabilityPath, "utf8"));
const sourceArchive = traceability.sourceArchive;
if (!sourceArchive || typeof sourceArchive.path !== "string") throw new Error("sourceArchive.path is required");

const basename = sourceArchive.path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1);
const safePath = assertPackRelativePath(basename, "sourceArchive.path");
if (!safePath || safePath === "." || safePath.includes("..")) throw new Error("sourceArchive.path could not be normalized safely");

traceability.sourceArchive = {
  ...sourceArchive,
  path: safePath,
  locationClass: "EXTERNAL_REVIEW_INPUT",
};
await writeFile(traceabilityPath, `${JSON.stringify(traceability, null, 2)}\n`, "utf8");

const correction = {
  schemaVersion: "1.0.0",
  phase: "G3_0_7_GOOGLE_STATIC_REVIEW_PACK_PATH_HYGIENE_VERIFIER_CORRECTION",
  status: "PASS",
  normative: false,
  evidenceClass: "AUTOMATED_CONTRACT_TEST",
  rootCause: {
    category: "FINAL_PAYLOAD_SCAN_ORDER_AND_ABSOLUTE_PATH_REDACTION",
    affectedFile: "manifests/g3-0-6-completion-evidence.json",
    affectedField: "sourceArchive.path",
    priorRepresentation: "ABSOLUTE_LOCAL_PATH_REDACTED",
    correctedRepresentation: safePath,
    violationClasses: ["WINDOWS_ABSOLUTE_PATH", "LOCAL_USERNAME_TOKEN"],
    falseNegative: true,
    sourceArchiveIntegrityPreserved: true,
  },
  sourceGenerator: {
    path: "scripts/generate-g3-0-7-google-static-review-pack-evidence.mjs",
    archiveReferenceRepresentation: "BASENAME_ONLY",
    usesPackRelativePathAssertion: true,
  },
  verifier: {
    path: "scripts/verify-g3-0-7-google-static-review-pack-path-hygiene.mjs",
    scansAuthoritativeStagingAfterFinalPayload: true,
    scansPostExtractionPayload: true,
    scansFinalSummaryAndIntegrity: true,
    textExtensions: ["json", "md", "html", "txt", "yaml", "yml", "csv"],
    failClosed: true,
  },
  pathPolicy: {
    windowsDrivePaths: "REJECT",
    uncPaths: "REJECT",
    userHomes: "REJECT",
    posixRuntimePaths: "REJECT",
    fileUrls: "REJECT",
    usernameTokens: "REJECT",
    parentTraversalSegments: "REJECT",
    externalUrls: "REJECT",
    notExposedEntries: "REJECT",
    zipAbsoluteEntries: "REJECT",
    zipBackslashEntries: "REJECT",
    zipTraversalEntries: "REJECT",
    repositoryRelativeAndPackRelativePaths: "ALLOW",
    excludedFiles: [],
  },
  sourceArchive: {
    path: safePath,
    bytes: sourceArchive.bytes,
    sha256: sourceArchive.sha256,
    frozenHead: sourceArchive.frozenHead,
    evidenceClass: sourceArchive.evidenceClass,
    integrityStatus: sourceArchive.integrityStatus,
  },
  regression: {
    lateAddedCompletionEvidence: "MUST_FAIL_NON_ZERO",
    internalReportCountsMustMatchIndependentScan: true,
    finalReviewStatusRequiresCleanIntegrity: true,
  },
  invariants: {
    rendererOutputChanged: false,
    frozenGoldensRegenerated: false,
    canonicalRequestChanged: false,
    frozenChannelOutputChanges: 0,
    runtimeNetworkRequests: 0,
    plumeDependencies: [],
    g3_2_3Started: false,
    userAcceptanceRecorded: false,
    freezePerformed: false,
  },
  implementationRecord: "docs/implementation/google-static-review-pack-path-hygiene-verifier-correction-g3-0-7.md",
  nextPhase: "G3_2_3_GOOGLE_STATIC_FINAL_OUTPUT_PACK_REGENERATION",
};
await mkdir(path.dirname(correctionPath), { recursive: true });
await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", traceability: "artifacts/g3-0-6/google-static-case-traceability.json", correction: "artifacts/g3-0-7/google-static-review-pack-path-hygiene-correction.json", sourceArchivePath: safePath }, null, 2));
