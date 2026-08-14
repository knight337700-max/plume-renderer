import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedHead = "27b15aaefa2ecbe0ad37c588e395330cf1e3b28f";
const userAcceptanceStatement = "ACCEPT_ALL_GOOGLE_G2_CANDIDATES";
const acceptedAt = "2026-08-14";
const candidateRegistryPath = "contracts/google/golden-candidates.g2.json";
const reviewManifestPath = "artifacts/g2-1/google-static-review-manifest.json";
const previewIndexPath = "artifacts/g2/google-static-candidate-index.html";
const acceptanceEvidencePath = "artifacts/g2-1/google-static-visual-acceptance.json";
const frozenRegistryPath = "contracts/google/goldens.g2.1.json";
const frozenRoot = "fixtures/golden/google";

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const absolute = (relativePath) => path.join(root, relativePath);
const relative = (value) => path.relative(root, value).split(path.sep).join("/");
const isRepoRelative = (value) => typeof value === "string" && value.length > 0 && !path.isAbsolute(value) && !value.split("/").includes("..");

async function exists(relativePath) {
  try { await stat(absolute(relativePath)); return true; } catch { return false; }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), "utf8"));
}

async function hashFile(relativePath) {
  return sha256(await readFile(absolute(relativePath)));
}

async function main() {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (head !== expectedHead) throw new Error(`G2.1 acceptance baseline mismatch: expected ${expectedHead}, got ${head}`);
  if (await exists(acceptanceEvidencePath) || await exists(frozenRegistryPath)) throw new Error("G2.1 acceptance/frozen evidence already exists; refusing overwrite");

  const candidateRegistry = await readJson(candidateRegistryPath);
  const reviewManifest = await readJson(reviewManifestPath);
  if (candidateRegistry.status !== "CANDIDATE" || candidateRegistry.frozen !== false || candidateRegistry.visualAcceptance !== "PENDING") throw new Error("candidate registry is not CANDIDATE/PENDING");
  if (candidateRegistry.candidateCount !== 14 || candidateRegistry.candidates?.length !== 14) throw new Error("candidate registry must contain exactly 14 candidates");
  if (reviewManifest.status !== "AWAITING_USER_DECISION" || reviewManifest.total !== 14) throw new Error("review manifest is not awaiting decision for all 14 candidates");

  const candidateRegistrySha256 = await hashFile(candidateRegistryPath);
  const reviewManifestSha256 = await hashFile(reviewManifestPath);
  const previewIndexSha256 = await hashFile(previewIndexPath);
  if (reviewManifest.candidateRegistrySha256 !== candidateRegistrySha256) throw new Error("candidate registry hash drift since review");
  if (reviewManifest.previewIndexSha256 !== previewIndexSha256) throw new Error("preview index hash drift since review");

  const acceptedArtifactSha256s = [];
  const entries = [];
  for (const candidate of candidateRegistry.candidates) {
    if (!isRepoRelative(candidate.artifactRelativePath)) throw new Error(`invalid candidate path: ${candidate.artifactRelativePath}`);
    const candidateBytes = await readFile(absolute(candidate.artifactRelativePath));
    const actualSha256 = sha256(candidateBytes);
    if (actualSha256 !== candidate.artifactSha256 || candidateBytes.byteLength !== candidate.encodedBytes) throw new Error(`${candidate.profileId} candidate bytes drift`);
    const reviewArtifact = reviewManifest.artifacts.find((entry) => entry.profileId === candidate.profileId);
    if (!reviewArtifact || reviewArtifact.artifactSha256 !== actualSha256 || reviewArtifact.renderFingerprint !== candidate.renderFingerprint) throw new Error(`${candidate.profileId} review identity mismatch`);

    const frozenArtifactRelativePath = `${frozenRoot}/${path.basename(candidate.artifactRelativePath)}`;
    const frozenAbsolutePath = absolute(frozenArtifactRelativePath);
    await mkdir(path.dirname(frozenAbsolutePath), { recursive: true });
    await copyFile(absolute(candidate.artifactRelativePath), frozenAbsolutePath);
    const frozenBytes = await readFile(frozenAbsolutePath);
    const frozenSha256 = sha256(frozenBytes);
    if (!frozenBytes.equals(candidateBytes) || frozenSha256 !== actualSha256) throw new Error(`${candidate.profileId} candidate/frozen byte mismatch`);

    acceptedArtifactSha256s.push({ profileId: candidate.profileId, artifactSha256: actualSha256, encodedBytes: candidate.encodedBytes });
    entries.push({
      profileId: candidate.profileId,
      capabilityContexts: candidate.capabilityContexts,
      assetRole: candidate.assetRole,
      candidateArtifactRelativePath: candidate.artifactRelativePath,
      frozenArtifactRelativePath,
      canvas: candidate.canvas,
      mime: candidate.mime,
      encodedBytes: candidate.encodedBytes,
      artifactSha256: actualSha256,
      renderFingerprint: candidate.renderFingerprint,
      sourceFixtureRelativePath: candidate.sourceFixtureRelativePath,
      sourceFixtureSha256: candidate.sourceFixtureSha256,
      layoutPlanRelativePath: candidate.layoutPlanRelativePath,
      layoutPlanSha256: candidate.layoutPlanSha256,
      placementPolicy: candidate.placementPolicy,
      expectedValidatorSummaryByCapability: candidate.validatorSummaryByCapability,
      expectedInfoDiagnostics: candidate.expectedInfoDiagnostics,
      candidateRegistrySha256,
      reviewManifestSha256,
      acceptanceEvidenceReference: acceptanceEvidencePath,
      frozenStatus: "FROZEN",
      candidateToFrozenByteEquality: true,
    });
  }

  const acceptanceEvidence = {
    phase: "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE",
    status: "ACCEPTED",
    acceptedSet: "ALL_14",
    acceptedCandidateRegistrySha256: candidateRegistrySha256,
    acceptedReviewManifestSha256: reviewManifestSha256,
    acceptedPreviewIndexSha256: previewIndexSha256,
    acceptedArtifactSha256s,
    userAcceptanceStatement,
    acceptedAt,
    acceptedAtTimezone: "Asia/Seoul",
    method: "USER_VISUAL_REVIEW",
    scope: "ALL_GOOGLE_G2_CANDIDATES",
  };
  await mkdir(path.dirname(absolute(acceptanceEvidencePath)), { recursive: true });
  await writeFile(absolute(acceptanceEvidencePath), json(acceptanceEvidence), "utf8");

  const frozenRegistry = {
    $schema: "https://kbr.local/contracts/google/goldens.g2.1.schema.json",
    $id: "https://kbr.local/contracts/google/goldens.g2.1.schema.json",
    schemaVersion: "1.0.0",
    registryVersion: "1.0.0",
    phase: "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE",
    status: "FROZEN",
    visualAcceptance: "ACCEPTED",
    frozen: true,
    finalGoldenFrozen: true,
    geometryGoldenCount: 7,
    demandGenUploadedDisplayStaticGoldenCount: 7,
    artifactCount: 14,
    goldenIdentity: ["profileId", "capabilityContexts", "assetRole", "canvas", "mime", "encodedBytes", "artifactSha256", "renderFingerprint", "sourceFixtureSha256", "layoutPlanSha256", "expectedValidatorSummaryByCapability"],
    provenance: {
      candidateRegistryPath,
      candidateRegistrySha256,
      reviewManifestPath,
      reviewManifestSha256,
      previewIndexPath,
      previewIndexSha256,
      acceptanceEvidencePath,
      userAcceptanceStatement,
      acceptanceScope: "ALL_14",
    },
    candidatesPreserved: true,
    candidateRegistryHistoricalStatus: "CANDIDATE",
    entries,
    scope: {
      desktopGoogleUiAdded: false,
      googleUploadAdded: false,
      plumeIntegrationAdded: false,
      runtimeNetworkAccess: "PROHIBITED",
      frozenChannelsOutputChanges: 0,
    },
    nextPhase: "G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT",
  };
  await writeFile(absolute(frozenRegistryPath), json(frozenRegistry), "utf8");

  console.log(JSON.stringify({
    status: "PASS",
    acceptanceEvidencePath,
    acceptanceEvidenceSha256: sha256(Buffer.from(json(acceptanceEvidence))),
    frozenRegistryPath,
    frozenRegistrySha256: sha256(Buffer.from(json(frozenRegistry))),
    frozenArtifactRoot: frozenRoot,
    artifactCount: entries.length,
    candidateRegistrySha256,
    reviewManifestSha256,
    previewIndexSha256,
  }, null, 2));
}

await main();
