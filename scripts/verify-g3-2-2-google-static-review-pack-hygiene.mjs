import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { scanReviewPackPayload } from "./google-review-pack-path-policy.mjs";

const packRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;

async function walk(root, current = root, files = []) {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(root, absolute, files);
    else if (entry.isFile()) files.push({ path: path.relative(root, absolute).replaceAll("\\", "/"), absolute });
  }
  return files;
}

if (!packRoot) {
  console.log(JSON.stringify({ status: "NOT_RUN", reason: "Pass a future G3.2.2 extracted pack directory; this verifier never creates a pack." }, null, 2));
  process.exit(0);
}

const packStat = await stat(packRoot).catch(() => null);
if (!packStat?.isDirectory()) {
  console.error(JSON.stringify({ status: "FAIL", reason: "pack directory does not exist", packRoot }, null, 2));
  process.exit(1);
}
const files = await walk(packRoot);
const payloadFiles = [];
for (const file of files.filter((entry) => /\.(json|html|md|txt)$/iu.test(entry.path))) payloadFiles.push({ path: file.path, text: await readFile(file.absolute, "utf8") });
const findings = scanReviewPackPayload(payloadFiles);
const externalReferences = files.filter((entry) => /\.(html|md)$/iu.test(entry.path)).length;
const result = {
  status: findings.length === 0 ? "PASS" : "FAIL",
  packRootLabel: "PACK_ROOT",
  scannedPayloadFiles: payloadFiles.length,
  scannedFiles: files.length,
  absoluteLocalPathsFound: findings.reduce((count, entry) => count + entry.absoluteLocalPaths.length, 0),
  externalUrlsFound: findings.reduce((count, entry) => count + entry.externalUrls.length, 0),
  notExposedPlaceholders: findings.reduce((count, entry) => count + entry.notExposedPlaceholders.length, 0),
  findings,
  note: "Historical G3.2.1 evidence is not sanitized or reclassified; this verifier is for a future G3.2.2 payload only.",
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "PASS") process.exitCode = 1;
