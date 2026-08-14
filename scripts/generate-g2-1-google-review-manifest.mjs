import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedHead = "27b15aaefa2ecbe0ad37c588e395330cf1e3b28f";
const registryRelativePath = "contracts/google/golden-candidates.g2.json";
const previewRelativePath = "artifacts/g2/google-static-candidate-index.html";
const outputRelativePath = "artifacts/g2-1/google-static-review-manifest.json";

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const relative = (value) => path.relative(root, value).split(path.sep).join("/");
const absolute = (value) => path.join(root, value);
const isRepoRelative = (value) => typeof value === "string" && value.length > 0 && !path.isAbsolute(value) && !value.split("/").includes("..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), "utf8"));
}

async function fileSha(relativePath) {
  return sha256(await readFile(absolute(relativePath)));
}

async function main() {
  const registry = await readJson(registryRelativePath);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (head !== expectedHead) throw new Error(`G2.1 review baseline mismatch: expected ${expectedHead}, got ${head}`);
  if (registry.status !== "CANDIDATE" || registry.frozen !== false || registry.visualAcceptance !== "PENDING") {
    throw new Error("G2 candidate registry is not in CANDIDATE/PENDING state");
  }
  if (registry.candidateCount !== 14 || registry.candidates?.length !== 14) throw new Error("G2 candidate count must be exactly 14");

  const registrySha256 = await fileSha(registryRelativePath);
  const previewSha256 = await fileSha(previewRelativePath);
  const artifacts = [];
  for (const candidate of registry.candidates) {
    const artifactPath = candidate.artifactRelativePath;
    if (!isRepoRelative(artifactPath)) throw new Error(`absolute/traversal artifact path: ${artifactPath}`);
    const artifactBytes = await readFile(absolute(artifactPath));
    const artifactSha256 = sha256(artifactBytes);
    if (artifactSha256 !== candidate.artifactSha256) throw new Error(`${candidate.profileId} artifact digest drift`);
    if (artifactBytes.byteLength !== candidate.encodedBytes) throw new Error(`${candidate.profileId} encoded byte drift`);
    artifacts.push({
      profileId: candidate.profileId,
      capabilityContexts: candidate.capabilityContexts,
      assetRole: candidate.assetRole,
      relativePath: artifactPath,
      canvas: candidate.canvas,
      mime: candidate.mime,
      encodedBytes: candidate.encodedBytes,
      artifactSha256,
      renderFingerprint: candidate.renderFingerprint,
      sourceFixtureSha256: candidate.sourceFixtureSha256,
      layoutPlanSha256: candidate.layoutPlanSha256,
      placementPolicy: candidate.placementPolicy,
      expectedInfoDiagnostics: candidate.expectedInfoDiagnostics,
      validatorSummaryByCapability: candidate.validatorSummaryByCapability,
    });
  }

  const outputPath = absolute(outputRelativePath);
  try {
    await stat(outputPath);
    if (!process.argv.includes("--refresh")) throw new Error(`review manifest already exists; refusing overwrite: ${outputRelativePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const manifest = {
    reviewManifestVersion: "0.1.0",
    phase: "G2_1_GOOGLE_STATIC_USER_VISUAL_ACCEPTANCE_AND_GOLDEN_FREEZE",
    status: "AWAITING_USER_DECISION",
    baselineCommit: expectedHead,
    candidateRegistryPath: registryRelativePath,
    candidateRegistrySha256: registrySha256,
    previewIndexPath: previewRelativePath,
    previewIndexSha256: previewSha256,
    candidateRegistryStatus: "CANDIDATE",
    candidateFrozen: false,
    visualAcceptance: "PENDING",
    reviewIdentity: {
      absolutePathsIncluded: false,
      candidateBytesPinned: true,
      renderDuringReview: false,
      pathEncoding: "repository-relative-posix",
      orderedBy: "G2 candidate registry order",
    },
    artifacts,
    total: artifacts.length,
    requestedUserResponse: "ACCEPT_ALL_GOOGLE_G2_CANDIDATES",
  };
  await writeFile(outputPath, json(manifest), "utf8");
  console.log(JSON.stringify({ status: "PASS", manifestPath: outputRelativePath, manifestSha256: sha256(Buffer.from(json(manifest))), candidateRegistrySha256: registrySha256, previewIndexSha256: previewSha256, artifacts: artifacts.length }, null, 2));
}

await main();
