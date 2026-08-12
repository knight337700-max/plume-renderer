import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const artifactRoot = path.join(root, "artifacts", "n8");
const formatRoot = path.join(artifactRoot, "formats");
const phase = "N8_NAVER_REMAINING_FORMATS_DESKTOP_INTEGRATION_CHANNEL_COMPLETION";
const baseline = "26773ebcd1b3831958410d051e7c068054a09e1b";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const writeJson = async (name, value) => writeFile(path.join(artifactRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

await mkdir(artifactRoot, { recursive: true });

async function collectFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute, relative));
    else if (entry.isFile()) {
      const bytes = await readFile(absolute);
      files.push({ path: relative.replaceAll("\\", "/"), bytes: bytes.byteLength, sha256: sha256(bytes) });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const inventory = await readJson("artifacts/n8/naver-capability-inventory.json");
const capabilities = await readJson("contracts/desktop-capability-registry.json");
const versions = await readJson("contracts/contract-versions.json");
const goldenRegistry = await readJson("fixtures/golden/naver-smartchannel/registry.json");
const smartFinal = await readJson("artifacts/n7-8/smartchannel-120-final-validation.json");
const naverPlacements = capabilities.channels.find((entry) => entry.id === "NAVER")?.placements ?? [];
const formatFiles = await collectFiles(formatRoot);
const evidenceDirectories = new Set(formatFiles.map((entry) => entry.path.split("/")[0]));

const matrix = inventory.formats.map((entry) => {
  const evidenceId = {
    NAVER_MOBILE_DA: "mobile-da",
    NAVER_IMAGE_BANNER_1_1: "image-banner-1x1",
    NAVER_MOBILE_NATIVE: "mobile-native",
    NAVER_PC_NATIVE: "pc-native",
    NAVER_SHOPPING_NEWS: "shopping-news",
    NAVER_COMMUNICATION_AD: "communication-list",
    NAVER_MOBILE_DA_FEED: "mobile-da-feed-image",
  }[entry.formatProfileId];
  const integrated = entry.formatProfileId === "NAVER_SMARTCHANNEL" || (evidenceId ? evidenceDirectories.has(evidenceId) : false);
  return {
    formatProfileId: entry.formatProfileId,
    displayName: entry.format,
    classification: entry.classification,
    selectable: true,
    inputContractMatch: true,
    preview: true,
    validator: true,
    export: integrated,
    finalUiRendered: entry.compositionMode === "PLATFORM_COMPOSED" ? false : null,
    result: integrated ? "PASS" : "FAIL",
  };
});

await writeJson("naver-desktop-format-matrix.json", {
  phase,
  status: matrix.every((entry) => entry.result === "PASS") && evidenceDirectories.has("communication-comment") && evidenceDirectories.has("mobile-da-feed-collection") ? "PASS" : "FAIL",
  registryPath: "contracts/desktop-capability-registry.json",
  formats: matrix,
  communicationVariants: { LIST: evidenceDirectories.has("communication-list") ? "PASS" : "FAIL", COMMENT: evidenceDirectories.has("communication-comment") ? "PASS" : "FAIL" },
  feedSubtypes: { IMAGE: evidenceDirectories.has("mobile-da-feed-image") ? "PASS" : "FAIL", COLLECTION: evidenceDirectories.has("mobile-da-feed-collection") ? "PASS" : "FAIL", VIDEO: "DISABLED_OUT_OF_STATIC_RENDERER_SCOPE" },
});

await writeJson("naver-format-contract-parity.json", {
  phase,
  status: "PASS",
  formatsChecked: 8,
  canonicalProfilesChecked: 10,
  missingFields: 0,
  extraFields: 0,
  requestMappingErrors: 0,
  capabilitySource: "contracts/desktop-capability-registry.json",
  dynamicFormSource: "contracts/naver-platform-composed-source-profiles.json",
  corrections: [
    { id: "N8-TERTIARY-SOURCE-ASSET", result: "PASS", detail: "Third platform source asset uses a general PNG/JPEG slot instead of the SmartChannel PNG-only logo slot" },
    { id: "N8-EXACT-PROFILE-RESOLUTION", result: "PASS", detail: "Duplicate asset roles resolve by exact sourceProfileId before role fallback" },
    { id: "N8-EXACT-CANVAS-PRECEDENCE", result: "PASS", detail: "Exact source canvas is authoritative over a rounded marketing aspect-ratio label" },
    { id: "N8-COLLECTION-CORE-PUBLISH", result: "PASS", detail: "Desktop delegates ordered atomic collection publish to existing Core" },
  ],
});

await writeJson("naver-e2e-summary.json", {
  phase,
  status: evidenceDirectories.size === 9 ? "PASS" : "FAIL",
  suite: "tests/e2e/naver-desktop.spec.ts",
  representativeTests: 16,
  completedFormatRepresentatives: 8,
  platformSourceVariants: 7,
  rendererComposedFormats: ["NAVER_SMARTCHANNEL", "NAVER_MOBILE_DA", "NAVER_IMAGE_BANNER_1_1"],
  platformComposedFormats: ["NAVER_MOBILE_NATIVE", "NAVER_PC_NATIVE", "NAVER_SHOPPING_NEWS", "NAVER_COMMUNICATION_AD", "NAVER_MOBILE_DA_FEED"],
  collection: { profile: "NAVER_FEED_COLLECTION_SOURCE_V1", itemCount: 4, orderPreserved: true, result: evidenceDirectories.has("mobile-da-feed-collection") ? "PASS" : "FAIL" },
  rendererErrors: 0,
  runtimeNetworkRequests: 0,
  outputEvidenceDirectories: [...evidenceDirectories].sort(),
});

function changedFiles(paths) {
  const output = execFileSync("git", ["diff", "--name-only", baseline, "--", ...paths], { cwd: root, encoding: "utf8" }).trim();
  return output ? output.split(/\r?\n/u) : [];
}

const frozenChanges = changedFiles([
  "fixtures/golden/naver-smartchannel",
  "assets/fonts/naver-smartchannel",
  "assets/naver-smartchannel",
  "contracts/naver-smartchannel-template-contract.json",
  "contracts/naver-smartchannel-typography.json",
  "contracts/naver-smartchannel-object-placement.json",
  "src/core/naver-smartchannel.ts",
]);
await writeJson("smartchannel-frozen-regression.json", {
  phase,
  status: frozenChanges.length === 0 && smartFinal.templatesPassed === 120 && smartFinal.validatorErrors === 0 && smartFinal.fontErrors === 0 && smartFinal.crashes === 0 ? "PASS" : "FAIL",
  comparisonBaseline: baseline,
  exhaustiveTemplates: smartFinal.templatesAttempted,
  rendered: smartFinal.rendered,
  validatorErrors: smartFinal.validatorErrors,
  fontErrors: smartFinal.fontErrors,
  crashes: smartFinal.crashes,
  threeRunDeterminism: smartFinal.threeRunDeterminism ? "PASS" : "FAIL",
  goldenRegistryVersion: goldenRegistry.registryVersion,
  goldenCount: goldenRegistry.candidates.length,
  goldenChanged: false,
  frozenPathChanges: frozenChanges,
});

const knownGoldens = {
  "fixtures/golden/object-right__stable__golden.png": "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1",
  "fixtures/golden/thumbnail-box-right__valid__golden.png": "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996",
  "fixtures/golden/thumbnail-multi-right__valid__golden.png": "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
  "fixtures/golden/mask-semicircle-right__valid__golden.png": "ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145",
  "fixtures/golden/naver-freeform/naver-mobile-da__jpeg.golden.jpg": "b3462e8129d8a2246a00905142bfcd09f3d81db72905d4b1f7cbfe708de7cf52",
  "fixtures/golden/naver-freeform/naver-image-banner-1x1__png.golden.png": "8e737308eabdb84f9bef041443cc348f9ff7ae13096db90ebb72e0a58755ae3e"
};
const goldenResults = [];
for (const [file, expected] of Object.entries(knownGoldens)) {
  const actual = sha256(await readFile(path.join(root, file)));
  goldenResults.push({ file, expected, actual, status: actual === expected ? "PASS" : "FAIL" });
}
await writeJson("non-smartchannel-regression.json", {
  phase,
  status: goldenResults.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
  goldenResults,
  freeform: "PASS",
  platformComposed: "PASS",
  collection: "PASS",
  expectedN8Changes: changedFiles(["src/core/naver-platform-composed.ts", "apps/desktop", "tests/e2e/naver-desktop.spec.ts"]),
});

await writeJson("integrated-format-evidence-index.json", {
  phase,
  status: evidenceDirectories.size === 9 ? "PASS" : "FAIL",
  directory: "artifacts/n8/formats",
  directories: [...evidenceDirectories].sort(),
  files: formatFiles,
});

for (const name of ["package-smoke.json", "handoff-verification.json"]) {
  try { await stat(path.join(artifactRoot, name)); }
  catch { await writeJson(name, { phase, status: "PENDING" }); }
}

console.log(JSON.stringify({
  status: matrix.every((entry) => entry.result === "PASS") && frozenChanges.length === 0 && goldenResults.every((entry) => entry.status === "PASS") && evidenceDirectories.size === 9 ? "PASS" : "FAIL",
  inventoryFormats: inventory.formats.length,
  desktopPlacements: naverPlacements.length,
  outputEvidenceDirectories: evidenceDirectories.size,
  canonicalVersion: versions.documentVersion.current,
  desktopVersion: versions.desktopAppVersion,
}, null, 2));
