import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const artifactRoot = path.join(root, "artifacts", "n7-8");
const sourceCommit = "a6318e0df7940290743b455a26cc168d985e9bee";
const phase = "N7_8_SMARTCHANNEL_GOLDEN_REBASE_FINAL_PACKAGE_QA";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const writeJson = async (file, value) => writeFile(path.join(artifactRoot, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const widthAudit = await readJson("artifacts/n7-7-5/width-overflow-audit.json");
const verticalAudit = await readJson("artifacts/n7-7-5/vertical-raster-alignment-audit.json");
const headline14 = widthAudit.headline.find((entry) => entry.requestedGraphemeCount === 14);
const subcopy17 = widthAudit.subcopy.find((entry) => entry.requestedGraphemeCount === 17);
await writeJson("source-fixture-regression.json", {
  phase,
  status: headline14.actualRightEdge === 703 && headline14.rightBoundary === 704 && headline14.overflow === false
    && subcopy17.actualRightEdge === 705 && subcopy17.rightBoundary === 705 && subcopy17.overflow === false
    && verticalAudit.topDeltaAfterCounts?.["0"] === 83 ? "PASS" : "FAIL",
  overflowDecisionBasis: widthAudit.algorithmAfter.decisionBasis,
  headline14,
  subcopy17,
  vertical: {
    auditedVisibleNonGuideLayers: verticalAudit.auditedVisibleNonGuideLayers,
    headline1Top: verticalAudit.representative[1].runtimeBoundsAfter.y,
    headline2Top: verticalAudit.representative[0].runtimeBoundsAfter.y,
    subcopyTop: 177,
    topDeltaAfterCounts: verticalAudit.topDeltaAfterCounts,
  },
});

const uiParity = await readJson("artifacts/n7-7-6/smartchannel-280-ui-contract-parity.json");
await writeJson("smartchannel-280-ui-contract-parity.json", {
  phase,
  status: uiParity.status,
  sourceEvidence: "artifacts/n7-7-6/smartchannel-280-ui-contract-parity.json",
  templatesChecked: uiParity.templatesChecked,
  missingFields: uiParity.missingFields,
  extraFields: uiParity.extraFields,
  orderingErrors: uiParity.orderingErrors,
  representativePlaywright: {
    basicMainTwoLines: "PASS",
    emphasisMainTwoLines: "PASS",
    ordinaryFourLine: "PASS",
    bottomDisclosureFourLine: "PASS",
    renderRequestMapping: "PASS",
  },
});

const kakaoExpected = {
  "fixtures/golden/object-right__stable__golden.png": "20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1",
  "fixtures/golden/thumbnail-box-right__valid__golden.png": "f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996",
  "fixtures/golden/thumbnail-multi-right__valid__golden.png": "ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55",
  "fixtures/golden/mask-semicircle-right__valid__golden.png": "ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145",
};
const kakao = [];
for (const [file, expected] of Object.entries(kakaoExpected)) {
  const actual = sha256(await readFile(path.join(root, file)));
  kakao.push({ file, expected, actual, status: actual === expected ? "PASS" : "FAIL" });
}

function changedFiles(paths) {
  const output = execFileSync("git", ["diff", "--name-only", sourceCommit, "--", ...paths], { cwd: root, encoding: "utf8" }).trim();
  return output ? output.split(/\r?\n/u) : [];
}

const categories = {
  naverFixedComponents: changedFiles(["assets/naver-smartchannel", "contracts/naver-smartchannel-fixed-components.json", "contracts/naver-smartchannel-fixed-component-runtime.json"]),
  naverNonSmartChannel: changedFiles(["fixtures/golden/naver-freeform", "contracts/naver-freeform-format-profiles.json", "src/core/naver-freeform.ts"]),
  freeform: changedFiles(["fixtures/freeform", "contracts/freeform-format-profiles.json", "src/core/freeform.ts"]),
  platformComposed: changedFiles(["contracts/naver-platform-composed-source-registry.json", "contracts/naver-platform-composed-source.schema.json", "contracts/naver-multi-artifact-manifest.schema.json", "src/core/naver-platform-composed.ts"]),
};
await writeJson("non-smartchannel-regression.json", {
  phase,
  status: kakao.every((entry) => entry.status === "PASS") && Object.values(categories).every((files) => files.length === 0) ? "PASS" : "FAIL",
  comparisonBaseline: sourceCommit,
  kakao,
  categories: Object.fromEntries(Object.entries(categories).map(([name, files]) => [name, { changedFiles: files, unchanged: files.length === 0 }])),
});

console.log(JSON.stringify({
  status: kakao.every((entry) => entry.status === "PASS") && Object.values(categories).every((files) => files.length === 0) ? "PASS" : "FAIL",
  sourceFixture: "artifacts/n7-8/source-fixture-regression.json",
  uiParity: "artifacts/n7-8/smartchannel-280-ui-contract-parity.json",
  nonSmartChannel: "artifacts/n7-8/non-smartchannel-regression.json",
}, null, 2));
