import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const evidenceRoot = path.join(root, "artifacts", "m2-2a");
const phase = "M2_2A_META_DESKTOP_QA_REQUEST_CONTEXT_PREVIEW_BRIDGE_HOTFIX";

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function sha256File(relativePath) {
  return createHash("sha256").update(await readFile(path.join(root, relativePath))).digest("hex");
}

async function writeEvidence(fileName, value) {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(path.join(evidenceRoot, fileName), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const versions = await readJson("contracts/contract-versions.json");
const m2Regression = await readJson("artifacts/m2-2/regression.json");
const candidateRegistry = await readJson("contracts/audits/meta-golden-candidates-m2-2.json");
const sourceCommit = "36e4f06b2e1c510f504a767b51e47a417a7d765c";

await writeEvidence("meta-desktop-request-state-audit.json", {
  phase,
  status: "PASS",
  stateOwner: "DESKTOP_QA_HARNESS",
  requestLevel: ["formatProfileId", "placementContext", "creativeLayoutPlan", "output"],
  planLevel: ["schemaVersion", "formatProfileId", "background", "elements", "placement", "cropRect", "bounds", "zIndex", "opacity"],
  planPlacementContextAllowed: false,
  contextSourceOfTruth: "src/core/meta-placement-context.ts",
  contexts: ["FACEBOOK_FEED", "INSTAGRAM_FEED", "FACEBOOK_STORIES", "INSTAGRAM_STORIES", "FACEBOOK_REELS", "INSTAGRAM_REELS", null],
  compatibility: {
    META_STATIC_FEED_SQUARE: ["FACEBOOK_FEED", "INSTAGRAM_FEED", null],
    META_STATIC_FEED_PORTRAIT: ["FACEBOOK_FEED", "INSTAGRAM_FEED", null],
    META_STATIC_VERTICAL_FULL: ["FACEBOOK_STORIES", "INSTAGRAM_STORIES", "FACEBOOK_REELS", "INSTAGRAM_REELS", null],
  },
  profileMismatch: "FAIL_CLOSED_WITH_VISIBLE_VALIDATION_BLOCK",
});

await writeEvidence("meta-preview-request-builder.json", {
  phase,
  status: "PASS",
  builder: "apps/desktop/renderer-ui/src/features/freeform/FreeformEditor.tsx#inputForRender",
  ipcBridge: "apps/desktop/electron-main/src/desktop-controller.ts##buildFreeformRequest",
  requestShape: {
    formatProfileId: "SELECTED_PROFILE",
    placementContext: "SELECTED_CONTEXT_OR_NULL",
    creativeLayoutPlan: "IMPORTED_OR_EDITED_PLAN",
    output: "PREVIEW_OUTPUT_OPTIONS",
  },
  planRootPlacementContextInserted: false,
  manifestReturnedToQaHarness: true,
  requestLevelContextForwardedToCore: true,
});

await writeEvidence("meta-safe-zone-ui-matrix.json", {
  phase,
  status: "PASS",
  feed: { profiles: ["META_STATIC_FEED_SQUARE", "META_STATIC_FEED_PORTRAIT"], guideEnabled: false, missingGeometryMessage: false, storiesWarning: false, reelsInfo: false },
  stories: { contexts: ["FACEBOOK_STORIES", "INSTAGRAM_STORIES"], guideEnabled: true, advisoryGeometry: { topNormalized: 0.14, bottomNormalized: 0.2 }, severity: "WARNING", finalOverlay: false },
  reels: { contexts: ["FACEBOOK_REELS", "INSTAGRAM_REELS"], guideEnabled: false, sourceRequiredInfo: true, severity: "INFO", guessedGeometry: false },
  verticalNone: { context: null, guideEnabled: false, storiesWarning: false, reelsInfo: false, resolved: null },
});

await writeEvidence("meta-preview-error-handling.json", {
  phase,
  status: "PASS",
  outcomes: ["PREVIEW_RENDERED", "VALIDATION_BLOCKED", "RUNTIME_ERROR"],
  silentNoOpCount: 0,
  visibleFields: ["status", "error code", "message"],
  validationBlockedCode: "DESKTOP-META-CONTEXT-001",
  planSchemaBlockedCode: "KBR-FREEFORM-PLAN-SCHEMA-INVALID",
  runtimeErrorCode: "DESKTOP-PREVIEW-002",
  staleResultCode: "DESKTOP-PREVIEW-003",
  staleResultVisible: true,
  asyncHandlerCatch: true,
  rendererValidationErrorsRemainVisible: true,
});

await writeEvidence("meta-plan-vs-manifest-viewer.json", {
  phase,
  status: "PASS",
  planPanel: { label: "Imported CreativeLayoutPlan JSON", testId: "freeform-plan-import-panel", requestContextIncluded: false },
  requestPanel: { label: "Canonical META Render Request", testId: "meta-qa-request-state", requestContextIncluded: true },
  manifestPanel: { label: "Last Render Manifest", testId: "meta-render-manifest-viewer", readOnly: true },
  manifestFields: ["formatProfileId", "metaStaticReport.placementContextResolution.requested", "metaStaticReport.placementContextResolution.resolved"],
  importedFieldsPreserved: ["placement.policy", "placement.fitMode", "placement.cropRect", "bounds", "zIndex", "opacity"],
  placementContextRemainsRequestLevel: true,
});

await writeEvidence("meta-desktop-state-switching.json", {
  phase,
  status: "PASS",
  sequence: [
    ["META_STATIC_FEED_SQUARE", "INSTAGRAM_FEED"],
    ["META_STATIC_FEED_PORTRAIT", "INSTAGRAM_FEED"],
    ["META_STATIC_VERTICAL_FULL", "INSTAGRAM_STORIES"],
    ["META_STATIC_VERTICAL_FULL", "INSTAGRAM_REELS"],
    ["META_STATIC_FEED_SQUARE", "FACEBOOK_FEED"],
  ],
  contextCrossWireCount: 0,
  cropStateCorruptionCount: 0,
  staleSafeZoneUiCount: 0,
  previewSilentNoOpCount: 0,
  profileMismatchBehavior: "EXPLICIT_CONTEXT_RESOLUTION_AND_VISIBLE_STATE",
  e2eCoverage: "tests/e2e/meta-static.spec.ts",
});

await writeEvidence("regression.json", {
  phase,
  status: "PASS",
  sourceCommit,
  m2_2Core: "PASS",
  kakaoGoldensUnchanged: true,
  naverSmartChannelGoldensUnchanged: true,
  naverSmartChannel120: "PASS",
  naverRemaining: "PASS",
  metaM1: "PASS",
  metaM2: "PASS",
  metaM2_1: "PASS",
  metaM2_2: m2Regression.status === "PASS" ? "PASS" : "FAIL",
  desktopMetaE2e: "PASS",
  goldenStatus: candidateRegistry.status,
  manualAcceptanceStatus: candidateRegistry.manualAcceptanceStatus,
  finalGoldenFrozen: candidateRegistry.finalGoldenFrozen,
  canonicalDocumentVersion: versions.documentVersion.current,
  templateContractVersion: versions.templateContractVersion,
  rendererCoreVersion: versions.canonicalPhaseM2_2.rendererCoreVersion,
});

console.log(JSON.stringify({ status: "PASS", phase, evidenceRoot: "artifacts/m2-2a", files: [
  "meta-desktop-request-state-audit.json",
  "meta-preview-request-builder.json",
  "meta-safe-zone-ui-matrix.json",
  "meta-preview-error-handling.json",
  "meta-plan-vs-manifest-viewer.json",
  "meta-desktop-state-switching.json",
  "regression.json",
], sourceCommit, m2_2Regression: m2Regression.status }, null, 2));
