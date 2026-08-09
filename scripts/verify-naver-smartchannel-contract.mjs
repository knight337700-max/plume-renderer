import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const strictSource = process.argv.includes("--strict-source");
const sourceRoot = process.env.NAVER_SMARTCHANNEL_SOURCE_ROOT ?? "C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12";
const contract = JSON.parse(fs.readFileSync(path.join(root, "contracts/naver-smartchannel-template-contract.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root, "contracts/naver-smartchannel-template.schema.json"), "utf8"));
const typography = JSON.parse(fs.readFileSync(path.join(root, "contracts/naver-smartchannel-typography.json"), "utf8"));
const fixed = JSON.parse(fs.readFileSync(path.join(root, "contracts/naver-smartchannel-fixed-components.json"), "utf8"));
const n2 = JSON.parse(fs.readFileSync(path.join(root, "contracts/naver-smartchannel-n2-candidates.json"), "utf8"));

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const templates = contract.templates;
const ids = templates.map((entry) => entry.templateId);
const hashes = templates.map((entry) => entry.source.sha256);
expect(contract.templateContractVersion === "1.7.0", "templateContractVersion must remain 1.7.0");
expect(contract.channel === "NAVER_GFA" && contract.placement === "SMARTCHANNEL", "channel/placement mismatch");
expect(contract.layoutMode === "TEMPLATE_LOCKED" && contract.compositionMode === "RENDERER_COMPOSED" && contract.artifactCardinality === "SINGLE", "composition axes mismatch");
expect(templates.length === 120, `expected 120 templates, got ${templates.length}`);
expect(new Set(ids).size === ids.length, "templateId values are not unique");
expect(new Set(hashes).size === hashes.length, "source SHA-256 values are not unique");
expect(JSON.stringify(contract.sourceCatalog.countsByHeight) === JSON.stringify({ "160": 32, "200": 32, "280": 56 }), "source counts by height mismatch");
expect(contract.sourceCatalog.catalogHashCrossCheck.hashMismatches === 0, "catalog hash mismatch recorded");
expect(contract.sourceCatalog.canvasHeaderCheck.badHeaders === 0, "PSD header mismatch recorded");
expect(schema.properties.templateContractVersion.const === "1.7.0", "template schema version mismatch");
expect(typography.status === "UNRESOLVED_SOURCE_METADATA", "typography must not claim resolved PSD metadata");
expect(fixed.components.some((entry) => entry.id === "LANDING_ICON_280" && entry.status === "UNRESOLVED"), "landing icon unresolved state missing");
expect(n2.status === "REGISTRY_ONLY" && n2.candidates.length === 6, "N2 representative registry mismatch");

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.name.toLowerCase().endsWith(".psd")) files.push(absolute);
  }
  return files;
}

let sourceStatus = "NOT_AVAILABLE_EXTERNAL_ROOT";
if (fs.existsSync(sourceRoot)) {
  sourceStatus = "PASS";
  const filesByHash = new Map();
  for (const filePath of walk(sourceRoot)) {
    const bytes = fs.readFileSync(filePath);
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    filesByHash.set(digest, { filePath, bytes });
  }
  expect(filesByHash.size >= 120, `source root contains fewer than 120 distinct PSD digests (${filesByHash.size})`);
  for (const entry of templates) {
    const source = filesByHash.get(entry.source.sha256);
    expect(Boolean(source), `missing source PSD for ${entry.templateId}`);
    if (!source) continue;
    const bytes = source.bytes;
    const width = bytes.readUInt32BE(18);
    const height = bytes.readUInt32BE(14);
    expect(bytes.subarray(0, 4).toString("ascii") === "8BPS" && bytes.readUInt16BE(4) === 1, `invalid PSD header for ${entry.templateId}`);
    expect(width === 750 && height === entry.height, `PSD canvas mismatch for ${entry.templateId}`);
  }
} else if (strictSource) {
  failures.push(`source root not found: ${sourceRoot}`);
}

const result = { status: failures.length === 0 ? "PASS" : "FAIL", sourceStatus, templateCount: templates.length, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
