import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const auditPath = path.join(repoRoot, "contracts", "audits", "naver-smartchannel-typography-audit.json");
const templatePath = path.join(repoRoot, "contracts", "naver-smartchannel-template-contract.json");
const typographyPath = path.join(repoRoot, "contracts", "naver-smartchannel-typography.json");
const sourceRoot = "C:\\Users\\Lenovo\\Desktop\\SMARTCHANNEL_GUIDE 12";
const expectedGroups = [
  "스마트채널DA_160_제작용_PSD",
  "스마트채널DA_200_제작용_PSD",
  "스페셜DA_성과형280_제작용_PSD (260526)",
];
const expectedCounts = new Map([[expectedGroups[0], 32], [expectedGroups[1], 32], [expectedGroups[2], 56]]);
const expectedTemplateCount = 120;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function walkPsd(root, current = root, result = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walkPsd(root, full, result);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".psd")) result.push(full);
  }
  return result.sort();
}

function fail(message, details = {}) {
  console.error(JSON.stringify({ status: "FAIL", message, ...details }, null, 2));
  process.exitCode = 1;
}

if (!fs.existsSync(auditPath)) fail("N7.6 audit JSON is missing", { auditPath });
else if (!fs.existsSync(sourceRoot)) {
  const audit = readJson(auditPath);
  const inventoryCount = Array.isArray(audit?.source?.inventory) ? audit.source.inventory.length : 0;
  const templateCount = Array.isArray(audit?.templates) ? audit.templates.length : 0;
  const unresolved = Number(audit?.summary?.unresolved ?? -1);
  const snapshotValid = audit?.phase?.id === "N7_6_SMARTCHANNEL_GLOBAL_TYPOGRAPHY_AUDIT"
    && inventoryCount === expectedTemplateCount
    && templateCount === expectedTemplateCount
    && unresolved === 0
    && (audit?.templates ?? []).every((row) => !(row.issues ?? []).some((issue) => issue.severity === "UNRESOLVED"));
  if (snapshotValid) {
    console.log(JSON.stringify({
      status: "PASS",
      phase: audit.phase.id,
      auditStatus: audit.phase.status,
      sourceStatus: "EXTERNAL_ROOT_UNAVAILABLE_AUDIT_SNAPSHOT_ONLY",
      sourceRoot,
      psdInventory: { actual: null, audited: inventoryCount },
      templates: { current: null, audited: templateCount, unresolved },
      runtimeBehaviorChanged: false,
      note: "Canonical PSD bytes were not re-read because the external source root is absent; the committed N7.6 audit snapshot was checked without synthesizing assets or digests.",
    }, null, 2));
  } else {
    fail("Canonical PSD source root is missing and audit snapshot is incomplete", { sourceRoot, inventoryCount, templateCount, unresolved });
  }
}
else {
  const audit = readJson(auditPath);
  const templateContract = readJson(templatePath);
  const typography = readJson(typographyPath);
  const errors = [];
  if (audit?.$id !== "https://kbr.local/contracts/audits/naver-smartchannel-typography-audit-v1.0.0.json") errors.push("audit $id mismatch");
  if (audit?.phase?.id !== "N7_6_SMARTCHANNEL_GLOBAL_TYPOGRAPHY_AUDIT") errors.push("phase id mismatch");
  if (!["PASS", "MISMATCH_FOUND"].includes(audit?.phase?.status)) errors.push(`unexpected audit status: ${audit?.phase?.status}`);

  const actualPsd = walkPsd(sourceRoot);
  const actualRows = actualPsd.map((filePath) => {
    const relative = path.relative(sourceRoot, filePath).split(path.sep).join("/");
    const [group] = relative.split("/");
    return { path: relative, group, sha256: sha256(filePath) };
  });
  const inventory = Array.isArray(audit?.source?.inventory) ? audit.source.inventory : [];
  const byPath = new Map(inventory.map((row) => [row.path, row]));
  if (actualRows.length !== expectedTemplateCount) errors.push(`actual PSD count ${actualRows.length} != ${expectedTemplateCount}`);
  if (inventory.length !== actualRows.length) errors.push(`audit inventory count ${inventory.length} != actual ${actualRows.length}`);
  const actualGroups = [...new Set(actualRows.map((row) => row.group))].sort();
  if (JSON.stringify(actualGroups) !== JSON.stringify([...expectedGroups].sort())) errors.push(`group set mismatch: ${actualGroups.join(", ")}`);
  for (const group of expectedGroups) {
    const actualCount = actualRows.filter((row) => row.group === group).length;
    if (actualCount !== expectedCounts.get(group)) errors.push(`${group}: ${actualCount} != ${expectedCounts.get(group)}`);
  }
  for (const row of actualRows) {
    const audited = byPath.get(row.path);
    if (!audited) errors.push(`PSD not inventoried: ${row.path}`);
    else {
      if (audited.sha256 !== row.sha256) errors.push(`PSD SHA mismatch: ${row.path}`);
      if (audited.readable !== true) errors.push(`PSD not readable in audit: ${row.path}`);
    }
  }

  const currentTemplateIds = new Set((templateContract.templates ?? []).map((row) => String(row.templateId)));
  const auditedTemplateIds = new Set((audit.templates ?? []).map((row) => String(row.templateId)));
  if (currentTemplateIds.size !== expectedTemplateCount) errors.push(`current template count ${currentTemplateIds.size} != ${expectedTemplateCount}`);
  if (auditedTemplateIds.size !== expectedTemplateCount) errors.push(`audited template count ${auditedTemplateIds.size} != ${expectedTemplateCount}`);
  for (const id of currentTemplateIds) if (!auditedTemplateIds.has(id)) errors.push(`template not audited: ${id}`);
  if (audit.summary?.templates?.unresolved !== 0) errors.push(`silent/unresolved template count: ${audit.summary?.templates?.unresolved}`);
  if (audit.summary?.unresolved !== 0) errors.push(`silent/unresolved audit count: ${audit.summary?.unresolved}`);
  for (const row of audit.templates ?? []) {
    for (const issue of row.issues ?? []) if (issue.severity === "UNRESOLVED") errors.push(`unresolved template issue: ${row.templateId}/${issue.code}`);
    for (const layer of row.textLayers ?? []) if (layer.roleCandidate === "UNRESOLVED") errors.push(`unresolved layer role: ${row.templateId}/${layer.layerPath}`);
  }

  const currentTokenIds = new Set((typography.tokens ?? []).map((row) => String(row.id)));
  const auditedTokenIds = new Set((audit.tokens ?? []).map((row) => String(row.tokenId)));
  if (currentTokenIds.size !== Number(audit.summary?.tokenAudit?.total)) errors.push("frozen token count does not match audit summary");
  for (const id of currentTokenIds) if (!auditedTokenIds.has(id)) errors.push(`typography token not audited: ${id}`);
  for (const token of audit.tokens ?? []) {
    for (const issue of token.issues ?? []) if (["TOKEN_NOT_FROZEN", "FROZEN_TOKEN_ORPHAN", "TOKEN_RUNTIME_MAPPING_UNRESOLVED"].includes(issue.code)) errors.push(`token unresolved: ${token.tokenId}/${issue.code}`);
  }
  if (audit.phase?.runtimeBehaviorChanged !== false) errors.push("runtimeBehaviorChanged is not false");
  if (audit.phase?.canonicalVersionChanged !== false) errors.push("canonicalVersionChanged is not false");
  if (!fs.existsSync(path.join(repoRoot, "docs", "implementation", "naver-smartchannel-global-typography-audit-n7-6.md"))) errors.push("human audit report is missing");

  if (errors.length > 0) fail("N7.6 audit verification failed", { errors, actualPsdCount: actualRows.length, auditedPsdCount: inventory.length });
  else {
    console.log(JSON.stringify({
      status: "PASS",
      phase: audit.phase.id,
      auditStatus: audit.phase.status,
      psdInventory: { actual: actualRows.length, audited: inventory.length, groups: Object.fromEntries(expectedGroups.map((group) => [group, actualRows.filter((row) => row.group === group).length])) },
      templates: { current: currentTemplateIds.size, audited: auditedTemplateIds.size, unresolved: audit.summary.templates.unresolved },
      typographyTokens: { current: currentTokenIds.size, audited: auditedTokenIds.size, unresolved: audit.summary.unresolved },
      runtimeBehaviorChanged: false,
    }, null, 2));
  }
}
