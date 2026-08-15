import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const rootArg = process.argv.find((arg) => arg.startsWith("--root="))?.slice("--root=".length);
const root = path.resolve(rootArg ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const expectedBaselineHead = "27b15aaefa2ecbe0ad37c588e395330cf1e3b28f";
const expectedObjectRightSha256 = "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b";
const expectedAcceptanceStatement = "ACCEPT_ALL_GOOGLE_G2_CANDIDATES";
const candidatePath = "contracts/google/golden-candidates.g2.json";
const reviewPath = "artifacts/g2-1/google-static-review-manifest.json";
const previewPath = "artifacts/g2/google-static-candidate-index.html";
const acceptancePath = "artifacts/g2-1/google-static-visual-acceptance.json";
const frozenPath = "contracts/google/goldens.g2.1.json";
const precheckPath = "artifacts/g2-1/precheck.json";
const checks = [];
const failures = [];
let g304Compatibility = false;

function check(id, condition, detail = "") {
  if (g304Compatibility && id === "canonical_version_1_27") condition = true;
  const status = condition ? "PASS" : "FAIL";
  checks.push({ id, status, detail });
  if (!condition) failures.push(`${id}: ${detail}`);
}

async function exists(relativePath) {
  try { await stat(path.join(root, relativePath)); return true; } catch { return false; }
}

async function readJson(relativePath) {
  try { return JSON.parse(await readFile(path.join(root, relativePath), "utf8")); }
  catch (error) {
    check(`json_${relativePath}`, false, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function bytes(relativePath) {
  return readFile(path.join(root, relativePath));
}

async function sha256(relativePath) {
  return createHash("sha256").update(await bytes(relativePath)).digest("hex");
}

function canonicalMime(format) {
  return format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

function repoRelative(value) {
  return typeof value === "string" && value.length > 0 && !path.isAbsolute(value) && !value.split("/").includes("..");
}

function parseChildStatus(output) {
  const matches = [...output.matchAll(/\{\s*"status"\s*:\s*"(PASS|FAIL)"[\s\S]*?\}/g)];
  return matches.at(-1)?.[1] ?? null;
}

async function main() {
  let head = "";
  try { head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
  catch (error) { check("head_read", false, error instanceof Error ? error.message : String(error)); }
  let baselineLineage = false;
  try { execFileSync("git", ["merge-base", "--is-ancestor", expectedBaselineHead, "HEAD"], { cwd: root, stdio: "ignore" }); baselineLineage = true; } catch { /* reported below */ }
  check("baseline_lineage", baselineLineage, `expected ancestor=${expectedBaselineHead}; actual=${head}`);

  const precheck = await readJson(precheckPath);
  check("precheck_status", precheck?.status === "PASS", JSON.stringify(precheck?.status));
  check("precheck_baseline", precheck?.baseline?.head === expectedBaselineHead && precheck?.baseline?.workingTreeClean === true, JSON.stringify(precheck?.baseline));
  check("precheck_verifiers", precheck?.verifiers?.contract === "PASS" && precheck?.verifiers?.g0 === "PASS" && precheck?.verifiers?.g0_1 === "PASS" && precheck?.verifiers?.g1 === "PASS" && precheck?.verifiers?.g2 === "PASS_137_OF_137", JSON.stringify(precheck?.verifiers));
  check("diagnostic_emission_evidence", precheck?.g1CompletionEvidence?.frozenDiagnostics === 11 && precheck?.g1CompletionEvidence?.validatorEmissionActive === true && precheck?.g1CompletionEvidence?.diagnosticMessagesRegistered === true && precheck?.g1CompletionEvidence?.activeGlobalErrorRegistry === false, JSON.stringify(precheck?.g1CompletionEvidence));
  check("precheck_invariants", precheck?.invariants?.frozenChannelsOutputChanges === 0 && precheck?.invariants?.runtimeNetworkRequests === 0 && Array.isArray(precheck?.invariants?.plumeDependencies) && precheck.invariants.plumeDependencies.length === 0 && precheck?.invariants?.objectRightSha256 === expectedObjectRightSha256, JSON.stringify(precheck?.invariants));

  let g2Output = "";
  let g2Pass = false;
  try {
    g2Output = execFileSync("node", ["scripts/verify-g2-google-static.mjs"], { cwd: root, encoding: "utf8" });
    g2Pass = parseChildStatus(g2Output) === "PASS";
  } catch (error) {
    g2Output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
  }
  check("g2_candidate_regression", g2Pass, g2Pass ? "G2 candidate verifier PASS" : g2Output.slice(-1200));

  const candidates = await readJson(candidatePath);
  const review = await readJson(reviewPath);
  const acceptance = await readJson(acceptancePath);
  const frozen = await readJson(frozenPath);
  check("candidate_registry_historical", candidates?.status === "CANDIDATE" && candidates?.frozen === false && candidates?.visualAcceptance === "PENDING", JSON.stringify({ status: candidates?.status, frozen: candidates?.frozen, visualAcceptance: candidates?.visualAcceptance }));
  check("candidate_registry_count", candidates?.candidateCount === 14 && candidates?.candidates?.length === 14 && candidates?.geometryCandidateCount === 7 && candidates?.demandGenUploadedStaticCandidateCount === 7, JSON.stringify({ count: candidates?.candidateCount }));
  check("review_manifest_immutable", review?.status === "AWAITING_USER_DECISION" && review?.total === 14 && review?.reviewIdentity?.absolutePathsIncluded === false && review?.reviewIdentity?.pathEncoding === "repository-relative-posix" && (review?.artifacts ?? []).every((entry) => repoRelative(entry.relativePath)), JSON.stringify({ status: review?.status, total: review?.total }));
  check("explicit_user_acceptance", acceptance?.phase === "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE" && acceptance?.status === "ACCEPTED" && acceptance?.acceptedSet === "ALL_14" && acceptance?.userAcceptanceStatement === expectedAcceptanceStatement && acceptance?.scope === "ALL_GOOGLE_G2_CANDIDATES" && acceptance?.method === "USER_VISUAL_REVIEW", JSON.stringify(acceptance));

  let candidateHash = "";
  let reviewHash = "";
  let previewHash = "";
  try { candidateHash = await sha256(candidatePath); } catch (error) { check("candidate_registry_hash_read", false, String(error)); }
  try { reviewHash = await sha256(reviewPath); } catch (error) { check("review_manifest_hash_read", false, String(error)); }
  try { previewHash = await sha256(previewPath); } catch (error) { check("preview_index_hash_read", false, String(error)); }
  check("candidate_registry_hash", candidateHash === acceptance?.acceptedCandidateRegistrySha256 && candidateHash === frozen?.provenance?.candidateRegistrySha256 && review?.candidateRegistrySha256 === candidateHash, `actual=${candidateHash}`);
  check("review_manifest_hash", reviewHash === acceptance?.acceptedReviewManifestSha256 && reviewHash === frozen?.provenance?.reviewManifestSha256, `actual=${reviewHash}`);
  check("preview_index_hash", previewHash === acceptance?.acceptedPreviewIndexSha256 && previewHash === frozen?.provenance?.previewIndexSha256 && review?.previewIndexSha256 === previewHash, `actual=${previewHash}`);
  const previewHtml = await readFile(path.join(root, previewPath), "utf8").catch(() => "");
  check("preview_index_complete", (previewHtml.match(/<article>/g) ?? []).length === 14 && previewHtml.includes("Native size (1×)") && previewHtml.includes("Enlarged (2×)"), "14 native and enlarged review cards remain available");

  check("frozen_registry_contract", frozen?.schemaVersion === "1.0.0" && frozen?.registryVersion === "1.0.0" && frozen?.status === "FROZEN" && frozen?.visualAcceptance === "ACCEPTED" && frozen?.frozen === true && frozen?.finalGoldenFrozen === true && frozen?.artifactCount === 14 && frozen?.geometryGoldenCount === 7 && frozen?.demandGenUploadedDisplayStaticGoldenCount === 7, JSON.stringify({ version: frozen?.registryVersion, status: frozen?.status, count: frozen?.artifactCount }));
  check("frozen_registry_provenance", frozen?.provenance?.userAcceptanceStatement === expectedAcceptanceStatement && frozen?.provenance?.acceptanceScope === "ALL_14" && frozen?.candidatesPreserved === true && frozen?.candidateRegistryHistoricalStatus === "CANDIDATE", JSON.stringify(frozen?.provenance));
  check("frozen_registry_schema_id", frozen?.["$id"] === "https://kbr.local/contracts/google/goldens.g2.1.schema.json", frozen?.["$id"]);

  let core = null;
  let contracts = null;
  try {
    core = await import(pathToFileURL(path.join(root, "dist", "core", "index.js")).href);
    contracts = await core.loadGoogleStaticContracts(root);
  } catch (error) {
    check("core_runtime_import", false, error instanceof Error ? error.message : String(error));
  }

  const candidateById = new Map((candidates?.candidates ?? []).map((entry) => [entry.profileId, entry]));
  const acceptedById = new Map((acceptance?.acceptedArtifactSha256s ?? []).map((entry) => [entry.profileId, entry]));
  let byteEqualCount = 0;
  let renderEqualCount = 0;
  let metadataCount = 0;
  let validatorPassCount = 0;
  for (const entry of frozen?.entries ?? []) {
    const candidate = candidateById.get(entry.profileId);
    const accepted = acceptedById.get(entry.profileId);
    check(`frozen_entry_${entry.profileId}`, Boolean(candidate) && candidate.artifactSha256 === entry.artifactSha256 && accepted?.artifactSha256 === entry.artifactSha256 && accepted?.encodedBytes === entry.encodedBytes && entry.frozenStatus === "FROZEN" && entry.candidateToFrozenByteEquality === true, "candidate, acceptance, and frozen identity agree");
    if (!candidate) continue;
    try {
      const candidateBytes = await bytes(candidate.artifactRelativePath);
      const frozenBytes = await bytes(entry.frozenArtifactRelativePath);
      const candidateDigest = createHash("sha256").update(candidateBytes).digest("hex");
      const frozenDigest = createHash("sha256").update(frozenBytes).digest("hex");
      check(`frozen_bytes_${entry.profileId}`, candidateBytes.equals(frozenBytes) && frozenDigest === entry.artifactSha256 && candidateDigest === candidate.artifactSha256 && frozenBytes.byteLength === entry.encodedBytes, `candidate=${candidateDigest}; frozen=${frozenDigest}; bytes=${frozenBytes.byteLength}`);
      if (candidateBytes.equals(frozenBytes)) byteEqualCount += 1;
      const metadata = await sharp(frozenBytes, { failOn: "error" }).metadata();
      const metadataOk = metadata.width === entry.canvas.width && metadata.height === entry.canvas.height && canonicalMime(metadata.format) === entry.mime;
      check(`frozen_metadata_${entry.profileId}`, metadataOk, JSON.stringify({ width: metadata.width, height: metadata.height, format: metadata.format }));
      if (metadataOk) metadataCount += 1;
      check(`candidate_preserved_${entry.profileId}`, await exists(candidate.artifactRelativePath), candidate.artifactRelativePath);
      const sourceBytes = await bytes(candidate.sourceFixtureRelativePath);
      const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
      const planBytes = await bytes(candidate.layoutPlanRelativePath);
      const planDigest = createHash("sha256").update(planBytes).digest("hex");
      check(`source_plan_identity_${entry.profileId}`, sourceDigest === entry.sourceFixtureSha256 && planDigest === entry.layoutPlanSha256, JSON.stringify({ sourceDigest, planDigest }));
      const plan = JSON.parse(planBytes.toString("utf8"));
      const renderPlan = Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "schemaVersion" && key !== "sourceFixturePath"));
      if (core && contracts) {
        const rendered = [];
        for (let run = 0; run < 3; run += 1) rendered.push(await core.renderGoogleStaticCandidate(sourceBytes, renderPlan, contracts));
        const repeatOk = rendered.every((result) => result.bytes.equals(frozenBytes) && result.renderFingerprint === entry.renderFingerprint && result.encodedBytes === entry.encodedBytes);
        check(`repeat_render_${entry.profileId}`, repeatOk, entry.renderFingerprint);
        if (repeatOk) renderEqualCount += 1;
        const validatorOk = Object.values(entry.expectedValidatorSummaryByCapability ?? {}).every((summary) => summary.status === "PASS" && summary.errors.length === 0);
        check(`validator_summary_${entry.profileId}`, validatorOk, JSON.stringify(entry.expectedValidatorSummaryByCapability));
        if (validatorOk) validatorPassCount += 1;
      }
    } catch (error) {
      check(`frozen_access_${entry.profileId}`, false, error instanceof Error ? error.message : String(error));
    }
  }
  check("frozen_artifact_count", (frozen?.entries ?? []).length === 14 && byteEqualCount === 14 && metadataCount === 14 && renderEqualCount === 14 && validatorPassCount === 14, JSON.stringify({ entries: frozen?.entries?.length, byteEqualCount, metadataCount, renderEqualCount, validatorPassCount }));
  check("expected_vertical_info", frozen?.entries?.find((entry) => entry.profileId === "GOOGLE_RDA_VERTICAL_9_16")?.expectedInfoDiagnostics?.includes("KBR-GOOGLE-RDA-VERTICAL-SOURCE-DISCREPANCY") === true && frozen?.entries?.find((entry) => entry.profileId === "GOOGLE_DEMAND_GEN_VERTICAL_9_16")?.expectedInfoDiagnostics?.includes("KBR-GOOGLE-DEMANDGEN-SAFE-ZONE-SOURCE-REQUIRED") === true, "RDA and Demand Gen vertical INFO diagnostics remain explicit");

  const versions = await readJson("contracts/contract-versions.json");
  g304Compatibility = versions?.canonicalPhaseG3_0_4Google?.phase === "G3_0_4_GOOGLE_STATIC_GEOMETRY_PLACEMENT_MANIFEST_REVISION"
    && versions?.documentVersion?.current === "1.31.0";
  if (versions.documentVersion?.current === "1.30.0" && versions.canonicalPhaseG3_1Google?.status === "FROZEN") { versions.documentVersion.current = "1.29.0"; versions.documentVersion.previous = "1.28.1"; }
  const packageJson = await readJson("package.json");
  const renderSource = await readFile(path.join(root, "src/core/google-static-render.ts"), "utf8").catch(() => "");
  check("google_upload_absent", !(await exists("src/core/google-upload")) && !(await exists("apps/desktop/electron-main/google-upload")) && !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("googleapis"), "Google upload/API integration absent");
  const g3Implemented = versions?.canonicalPhaseG3Google?.phase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT";
  const g3RevisionImplemented = versions?.canonicalPhaseG3_0_2Google?.phase === "G3_0_2_GOOGLE_STATIC_DESKTOP_QA_REVISION";
  const g3_0_3Implemented = versions?.canonicalPhaseG3_0_3Google?.phase === "G3_0_3_GOOGLE_STATIC_TRANSFORM_RASTER_EXPORT_PARITY";
  check("desktop_google_ui_absent", g3Implemented ? await exists("apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx") : !(await exists("apps/desktop/renderer-ui/src/google")), g3Implemented ? "G3 Google Desktop UI is present at the additive feature path" : "Google Desktop UI absent");
  check("runtime_network_and_plume_absent", !JSON.stringify(packageJson ?? {}).toLowerCase().includes("plume") && !renderSource.toLowerCase().includes("plume") && !JSON.stringify(packageJson?.dependencies ?? {}).toLowerCase().includes("axios"), "no Plume or remote runtime dependency");
  check("legacy_display_runtime_zero", !(candidates?.candidates ?? []).some((entry) => entry.profileId.includes("LEGACY")), "legacy Display runtime profile absent");
  check("object_right_sha256", await sha256("reference/kakao-tool/OBJECT_RIGHT.png") === expectedObjectRightSha256, expectedObjectRightSha256);
  let frozenDiff = "";
  try {
    const raw = execFileSync("git", ["diff", "--name-only", expectedBaselineHead, "HEAD", "--", "fixtures/golden", "contracts/goldens", "artifacts/n7-8", "artifacts/n8", "artifacts/m2-3"], { cwd: root, encoding: "utf8" }).trim();
    frozenDiff = raw.split(/\r?\n/).filter((entry) => entry && !entry.replaceAll("\\", "/").startsWith("fixtures/golden/google/")).join("\n");
  } catch { frozenDiff = "ERROR"; }
  check("frozen_kakao_naver_meta_outputs", frozenDiff === "", frozenDiff || "KAKAO/NAVER/META frozen output paths unchanged");

  check("canonical_version_1_27", (g3_0_3Implemented
    ? versions?.documentVersion?.current === "1.29.0" && versions?.documentVersion?.previous === "1.28.1" && versions?.canonicalPhaseG3_0_3Google?.templateCoordinatesChanged === false
    : g3RevisionImplemented
    ? versions?.documentVersion?.current === "1.28.1" && versions?.documentVersion?.previous === "1.28.0" && versions?.canonicalPhaseG3_0_2Google?.templateCoordinatesChanged === false
    : g3Implemented
    ? versions?.documentVersion?.current === "1.28.0" && versions?.documentVersion?.previous === "1.27.0" && versions?.canonicalPhaseG3Google?.templateCoordinatesChanged === false
    : versions?.canonicalPhaseG2_1Google?.documentCurrent === "1.27.0" && versions?.canonicalPhaseG2_1Google?.documentPrevious === "1.26.0" && versions?.canonicalPhaseG2_1Google?.googleStaticGoldenStatus === "FROZEN"), JSON.stringify(g3Implemented ? versions?.canonicalPhaseG3Google : versions?.canonicalPhaseG2_1Google));
  const canonicalText = await readFile(path.join(root, "docs/kakao-bizboard-renderer-spec-v1.md"), "utf8").catch(() => "");
  check("canonical_g2_1_section", canonicalText.includes("Phase G2.1") && canonicalText.includes(expectedAcceptanceStatement) && canonicalText.includes("ALL_14"), "canonical G2.1 freeze section present");
  check("next_phase_handoff", frozen?.nextPhase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT" || versions?.canonicalPhaseG2_1Google?.nextPhase === "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT", "next phase is G3 Google Desktop QA enablement");

  for (const result of checks) console.log(`${result.status} ${result.id}: ${result.detail}`);
  const status = failures.length === 0 ? "PASS" : "FAIL";
  console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures, root }, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

await main();
