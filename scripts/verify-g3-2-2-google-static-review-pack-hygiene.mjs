import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanReviewPackPayload, scanZipEntryNames, summarizeReviewPackFindings } from "./google-review-pack-path-policy.mjs";

const packArgument = process.argv[2] ? path.resolve(process.argv[2]) : null;
const textExtensions = /\.(json|html|md|txt|yaml|yml|csv)$/iu;

async function walk(root, current = root, files = []) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(root, absolute, files);
    else if (entry.isFile()) files.push({ path: path.relative(root, absolute).replaceAll("\\", "/"), absolute });
  }
  return files;
}

if (!packArgument) {
  console.log(JSON.stringify({ status: "NOT_RUN", reason: "Pass a future G3.2.2 extracted pack directory; this verifier never creates a pack." }, null, 2));
  process.exit(0);
}

let packRoot = packArgument;
let temporaryExtraction = null;
const packStat = await stat(packArgument).catch(() => null);
if (packStat?.isFile() && path.extname(packArgument).toLowerCase() === ".zip") {
  temporaryExtraction = await mkdtemp(path.join(os.tmpdir(), "kbr-g3-2-2-pack-"));
  try {
    execFileSync(process.platform === "win32" ? "tar.exe" : "tar", ["-xf", packArgument, "-C", temporaryExtraction], { stdio: "pipe" });
    const roots = (await readdir(temporaryExtraction, { withFileTypes: true })).filter((entry) => entry.isDirectory());
    packRoot = roots.length === 1 ? path.join(temporaryExtraction, roots[0].name) : temporaryExtraction;
  } catch (error) {
    console.error(JSON.stringify({ status: "FAIL", reason: "ZIP extraction failed", packPath: packArgument, error: String(error) }, null, 2));
    await rm(temporaryExtraction, { recursive: true, force: true });
    process.exit(1);
  }
}

const resolvedPackStat = await stat(packRoot).catch(() => null);
if (!resolvedPackStat?.isDirectory()) {
  console.error(JSON.stringify({ status: "FAIL", reason: "pack directory does not exist", packRoot: packArgument }, null, 2));
  if (temporaryExtraction) await rm(temporaryExtraction, { recursive: true, force: true });
  process.exit(1);
}
const files = await walk(packRoot);
const payloadFiles = [];
for (const file of files.filter((entry) => textExtensions.test(entry.path))) payloadFiles.push({ path: file.path, text: await readFile(file.absolute, "utf8") });
const findings = scanReviewPackPayload(payloadFiles);
const zipEntryNames = packArgument.toLowerCase().endsWith(".zip") ? execFileSync(process.platform === "win32" ? "tar.exe" : "tar", ["-tf", packArgument], { encoding: "utf8" }).split(/\r?\n/u).filter(Boolean) : files.map((entry) => entry.path);
const zipFindings = scanZipEntryNames(zipEntryNames);
const summary = await readFile(path.join(packRoot, "verification", "automated-summary.json"), "utf8").then((text) => JSON.parse(text)).catch(() => null);
const integrity = await readFile(path.join(packRoot, "verification", "pack-integrity.json"), "utf8").then((text) => JSON.parse(text)).catch(() => null);
const independent = summarizeReviewPackFindings(findings, zipFindings);
const { clean: scanClean, ...independentCounts } = independent;
const reportMatches = Boolean(summary?.pathHygiene) && Object.entries(independentCounts).every(([key, value]) => summary.pathHygiene[key] === value);
const integrityTruthful = Boolean(integrity) && (scanClean ? integrity.pathHygiene === "PASS" : integrity.pathHygiene !== "PASS");
const finalReviewTruthful = await (async () => {
  const finalSummary = files.find((entry) => entry.path === "verification/final-summary.json");
  if (!finalSummary) return false;
  const parsed = JSON.parse(await readFile(finalSummary.absolute, "utf8"));
  return scanClean ? parsed.status === "AWAITING_EXTERNAL_OUTPUT_REVIEW" : parsed.status !== "AWAITING_EXTERNAL_OUTPUT_REVIEW";
})();
const result = {
  status: findings.length === 0 && scanClean && reportMatches && integrityTruthful && finalReviewTruthful ? "PASS" : "FAIL",
  packRootLabel: "PACK_ROOT",
  scannedPayloadFiles: payloadFiles.length,
  scannedFiles: files.length,
  ...independentCounts,
  scanClean,
  reportMatches,
  integrityTruthful,
  finalReviewTruthful,
  findings,
  zipFindings,
  note: "Final staging or extracted ZIP payload is scanned after all verification files are present; no completion evidence file is excluded.",
};
console.log(JSON.stringify(result, null, 2));
if (temporaryExtraction) await rm(temporaryExtraction, { recursive: true, force: true });
if (result.status !== "PASS") process.exitCode = 1;
