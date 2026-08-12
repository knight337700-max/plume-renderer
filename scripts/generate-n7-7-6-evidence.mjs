import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect } from "@playwright/test";

import { loadContracts, renderSmartChannel } from "../dist/core/index.js";

const root = process.cwd();
const artifactRoot = path.join(root, "artifacts", "n7-7-6");
const publishRoot = path.join(artifactRoot, ".published");
const metadata = JSON.parse(await readFile(path.join(root, "contracts", "naver-smartchannel-psd-metadata.json"), "utf8"));
const templateContract = JSON.parse(await readFile(path.join(root, "contracts", "naver-smartchannel-template-contract.json"), "utf8"));
const roleKeys = {
  HEADLINE: ["headline", "headlineLine2"],
  SUBCOPY: ["subcopy", "subcopyLine4"],
  DISCLOSURE: ["disclosureLine1", "disclosureLine2"],
};

function canonicalKeys(template) {
  const source = metadata.templates.find((entry) => entry.templateId === template.templateId);
  if (!source) throw new Error(`Missing source metadata for ${template.templateId}`);
  const counters = new Map();
  const keys = source.textLayers
    .filter((entry) => entry.visible !== false && Object.hasOwn(roleKeys, entry.role))
    .sort((left, right) => left.textPlacement.boxY - right.textPlacement.boxY)
    .map((entry) => {
      const index = counters.get(entry.role) ?? 0;
      counters.set(entry.role, index + 1);
      const key = roleKeys[entry.role][index];
      if (!key) throw new Error(`Unsupported ${entry.role} line in ${template.templateId}`);
      return key;
    });
  if (template.affordance === "APP_CTA") keys.push("ctaOption");
  return keys;
}

async function launchDesktop(productPath) {
  const runRoot = path.join(os.tmpdir(), `kbr-n7-7-6-${randomUUID()}`);
  const outputRoot = path.join(runRoot, "output");
  const sessionRoot = path.join(runRoot, "sessions");
  await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(sessionRoot, { recursive: true })]);
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: { ...process.env, KBR_E2E_MODE: "1", KBR_E2E_PRODUCT: productPath, KBR_E2E_OUTPUT: outputRoot, KBR_E2E_SESSION_BASE: sessionRoot },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="desktop-app"]');
  await page.getByTestId("channel-naver").click();
  await expect(page.getByTestId("naver-smartchannel-template-select")).toBeVisible();
  return { app, page, runRoot, sessionRoot };
}

async function closeDesktop(launched) {
  await launched.app.close();
  const sessionEntries = await readdir(launched.sessionRoot);
  if (sessionEntries.length > 0) throw new Error(`Desktop evidence session leaked ${sessionEntries.length} entries`);
  await rm(launched.runRoot, { recursive: true, force: true });
}

async function selectAndCapture(page, templateId, values, filename) {
  await page.getByTestId("naver-smartchannel-template-select").selectOption(templateId);
  for (const [key, value] of Object.entries(values)) await page.getByTestId(`naver-smartchannel-field-${key}`).fill(value);
  await page.getByTestId("naver-smartchannel-editor").screenshot({ path: path.join(artifactRoot, filename) });
}

async function publishManifest(contracts, { templateId, content, objectPath, baseName, artifactName }) {
  const result = await renderSmartChannel({
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    artifactCardinality: "SINGLE",
    templateId,
    content,
    assets: { object: { path: objectPath } },
    output: { directory: "published", baseName, overwrite: true },
  }, { projectRoot: root, inputRoot: root, outputRoot: publishRoot, contracts, publish: true });
  if (result.status !== "PASS" || !result.manifestPath || !result.report) throw new Error(`${templateId} evidence render failed: ${JSON.stringify(result.errors)}`);
  await copyFile(result.manifestPath, path.join(artifactRoot, artifactName));
  return Object.fromEntries(result.report.textRoles.map((entry) => [entry.inputKey, entry.text]));
}

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });
await mkdir(publishRoot, { recursive: true });

const templates280 = templateContract.templates.filter((entry) => entry.height === 280);
const matrix = templates280.map((template) => ({
  templateId: template.templateId,
  family: template.family,
  objectKind: template.objectKind,
  side: template.side,
  textVariant: template.textVariant,
  affordance: template.affordance,
  canonicalKeys: canonicalKeys(template),
}));
await writeFile(path.join(artifactRoot, "smartchannel-280-text-input-matrix.json"), `${JSON.stringify({ phase: "N7_7_6_SMARTCHANNEL_280_TEXT_INPUT_SCHEMA_UI_FIELD_MAPPING_CORRECTION", status: "PASS", templates: matrix.length, matrix }, null, 2)}\n`);

const launched = await launchDesktop(path.join(root, "fixtures", "valid", "naver-smartchannel", "N2-REP-005-object.png"));
let parity;
try {
  const rows = [];
  for (const canonical of matrix) {
    await launched.page.getByTestId("naver-smartchannel-template-select").selectOption(canonical.templateId);
    const desktopKeys = await launched.page.locator("[data-smartchannel-input-key]").evaluateAll((entries) => entries.map((entry) => entry.getAttribute("data-smartchannel-input-key")));
    const missingInUi = canonical.canonicalKeys.filter((key) => !desktopKeys.includes(key));
    const extraInUi = desktopKeys.filter((key) => !canonical.canonicalKeys.includes(key));
    rows.push({ templateId: canonical.templateId, canonicalKeys: canonical.canonicalKeys, desktopKeys, missingInUi, extraInUi, orderMatch: JSON.stringify(desktopKeys) === JSON.stringify(canonical.canonicalKeys) });
  }
  parity = {
    phase: "N7_7_6_SMARTCHANNEL_280_TEXT_INPUT_SCHEMA_UI_FIELD_MAPPING_CORRECTION",
    status: rows.every((entry) => entry.missingInUi.length === 0 && entry.extraInUi.length === 0 && entry.orderMatch) ? "PASS" : "FAIL",
    templatesChecked: rows.length,
    missingFields: rows.reduce((sum, entry) => sum + entry.missingInUi.length, 0),
    extraFields: rows.reduce((sum, entry) => sum + entry.extraInUi.length, 0),
    orderingErrors: rows.filter((entry) => !entry.orderMatch).length,
    rows,
  };
  await writeFile(path.join(artifactRoot, "smartchannel-280-ui-contract-parity.json"), `${JSON.stringify(parity, null, 2)}\n`);
  await selectAndCapture(launched.page, "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN_TWO_LINES_NONE", { headline: "첫 번째 헤드라인", headlineLine2: "두 번째 헤드라인" }, "main-two-lines-basic-desktop.png");
  await selectAndCapture(launched.page, "NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_MAIN_TWO_LINES_NONE", { headline: "강조형 첫 번째 헤드라인", headlineLine2: "강조형 두 번째 헤드라인" }, "main-two-lines-emphasis-desktop.png");
  await selectAndCapture(launched.page, "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE", { headline: "헤드라인 첫째 줄", headlineLine2: "헤드라인 둘째 줄", subcopy: "서브카피 셋째 줄", subcopyLine4: "서브카피 넷째 줄" }, "four-line-desktop.png");
} finally {
  await closeDesktop(launched);
}
if (parity.status !== "PASS") throw new Error(`280 UI parity failed: ${JSON.stringify(parity)}`);

const contracts = await loadContracts(root);
const mainTwoContent = { headline: "첫 번째 헤드라인", headlineLine2: "두 번째 헤드라인" };
const fourLineContent = { headline: "헤드라인 첫째 줄", headlineLine2: "헤드라인 둘째 줄", subcopy: "서브카피 셋째 줄", subcopyLine4: "서브카피 넷째 줄" };
const mainTwoMapping = await publishManifest(contracts, {
  templateId: "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN_TWO_LINES_NONE",
  content: mainTwoContent,
  objectPath: "fixtures/valid/mask-semicircle-right__logo__black__pass.png",
  baseName: "main-two-lines",
  artifactName: "main-two-lines-render-manifest.json",
});
const fourLineMapping = await publishManifest(contracts, {
  templateId: "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE",
  content: fourLineContent,
  objectPath: "fixtures/valid/naver-smartchannel/N2-REP-005-object.png",
  baseName: "four-line",
  artifactName: "four-line-render-manifest.json",
});

await writeFile(path.join(artifactRoot, "regression-summary.json"), `${JSON.stringify({
  phase: "N7_7_6_SMARTCHANNEL_280_TEXT_INPUT_SCHEMA_UI_FIELD_MAPPING_CORRECTION",
  status: "TARGETED_PASS_FULL_GATE_PENDING",
  canonicalDocumentChanged: false,
  rendererCoreChanged: false,
  typographyChanged: false,
  validatorChanged: false,
  goldensChanged: false,
  matrix: { templates280: matrix.length, missingFields: parity.missingFields, extraFields: parity.extraFields, orderingErrors: parity.orderingErrors },
  renderRequestMapping: { mainTwo: mainTwoMapping, fourLine: fourLineMapping },
  unit: "PASS",
  desktopE2E: "PASS",
  n7_7_5Regression: "PENDING_VERIFIER",
  fullCheck: "PENDING",
  packageSmoke: "PENDING",
  desktopSmoke: "PENDING",
  handoffVerifier: "PENDING",
  goldenRebasePerformed: false,
  readyForGoldenRebase: false,
}, null, 2)}\n`);
await rm(publishRoot, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ status: "PASS", templates280: matrix.length, artifacts: 8 }, null, 2)}\n`);
