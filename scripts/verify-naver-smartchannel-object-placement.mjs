import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const placement = readJson("contracts/naver-smartchannel-object-placement.json");
const placementSchema = readJson("contracts/naver-smartchannel-object-placement.schema.json");
const template = readJson("contracts/naver-smartchannel-template-contract.json");
const templateSchema = readJson("contracts/naver-smartchannel-template.schema.json");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const ajv = new Ajv2020({ strict: false, allErrors: true });
try {
  const validatePlacement = ajv.compile(placementSchema);
  expect(validatePlacement(placement), `object placement schema validation failed: ${JSON.stringify(validatePlacement.errors)}`);
  const validateTemplate = ajv.compile(templateSchema);
  expect(validateTemplate(template), `template contract schema validation failed: ${JSON.stringify(validateTemplate.errors)}`);
} catch (error) {
  failures.push(`schema compilation failed: ${error instanceof Error ? error.message : String(error)}`);
}

expect(placement.registryVersion === "1.0.0", "object placement registry must be v1.0.0");
expect(placement.templateContractVersion === "1.10.0", "object placement template contract must be v1.10.0");
expect(placement.status === "SOURCE_RESOLVED_PROJECT_CONTRACT", "object placement status mismatch");
expect(template.registryVersion === "1.4.0" && template.templateContractVersion === "1.10.0", "SmartChannel template registry/version mismatch");
expect(template.objectPlacementContractRef === "contracts/naver-smartchannel-object-placement.json", "template placement registry reference missing");
expect(template.objectPlacementSchemaRef === "contracts/naver-smartchannel-object-placement.schema.json", "template placement schema reference missing");
expect(template.objectPlacementStatus === "SOURCE_RESOLVED_PROJECT_CONTRACT", "template placement status mismatch");

const tokens = placement.tokens ?? [];
const tokenIds = tokens.map((token) => token.token);
const tokenById = new Map(tokens.map((token) => [token.token, token]));
expect(tokens.length === 39, `expected 39 placement tokens, got ${tokens.length}`);
expect(new Set(tokenIds).size === tokenIds.length, "placement token IDs are not unique");
expect(tokens.every((token) => token.runtimeEnabled === true), "all mapped placement tokens must be runtime-enabled");
expect(tokens.every((token) => token.anchor?.mode === "SOURCE_DEFINED"), "anchor policy must be SOURCE_DEFINED");
expect(tokens.every((token) => ["NONE", "FIXED_FRAME", "SOURCE_TRANSFORM"].includes(token.fitMode)), "token fit mode is outside frozen source-backed set");
expect(tokens.every((token) => token.autoDesign && Object.values(token.autoDesign).every((value) => value === "FORBIDDEN")), "auto-design heuristic was enabled");
expect(tokens.every((token) => (token.objectKind === "THUMBNAIL" && token.family === "EMPHASIS") || (token.objectKind === "PERSON_MOVIE" && token.family === "EMPHASIS") || (token.objectKind === "STANDARD" && ["BASIC", "BOTTOM_DISCLOSURE"].includes(token.family))), "unsupported objectKind/family combination was registered");

const mappings = placement.templateMappings ?? [];
const mappingByTemplate = new Map(mappings.map((mapping) => [mapping.templateId, mapping]));
expect(mappings.length === 120, `expected 120 template mappings, got ${mappings.length}`);
expect(new Set(mappings.map((mapping) => mapping.templateId)).size === mappings.length, "template mapping IDs are not unique");
expect(template.templates.length === 120, "SmartChannel template registry does not contain 120 entries");
expect(template.templates.every((entry) => mappingByTemplate.get(entry.templateId)?.objectPlacementToken === entry.objectPlacementToken), "template registry and placement mapping disagree");
expect(mappings.every((mapping) => tokenById.has(mapping.objectPlacementToken)), "mapping references an unknown placement token");
expect(mappings.every((mapping) => mapping.sourceClassification === "DERIVED_FROM_EXACT_SOURCE_METADATA"), "mapping provenance classification missing");

const candidateIds = [
  "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_NONE",
  "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_RIGHT_THREE_LINE_NONE",
  "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_LANDING_ICON",
  "NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_APP_CTA",
  "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE",
  "NAVER_SMARTCHANNEL_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_MAIN2_DISCLOSURE_2LINE_NONE",
];
const candidateProofIds = new Set((placement.sourceAudit?.candidateProof ?? []).map((entry) => entry.templateId));
expect(candidateIds.every((id) => mappingByTemplate.has(id) && candidateProofIds.has(id)), "candidate template placement provenance is incomplete");
expect(placement.n2Gate?.candidateTemplatesResolved === true && placement.n2Gate?.unresolvedCandidateCount === 0 && placement.n2Gate?.ready === true, "N2A candidate gate is not ready");

const masks = placement.maskGeometry ?? [];
const maskIds = new Set(masks.map((mask) => mask.maskToken));
expect(masks.length === 6 && maskIds.size === 6, "expected six distinct source mask geometries");
expect(masks.find((mask) => mask.maskToken === "NAVER_SC_MASK_280_LEFT")?.frame && JSON.stringify(masks.find((mask) => mask.maskToken === "NAVER_SC_MASK_280_LEFT").frame) === JSON.stringify({ x: 40, y: 40, width: 200, height: 200 }), "280 LEFT mask frame mismatch");
expect(masks.find((mask) => mask.maskToken === "NAVER_SC_MASK_280_RIGHT")?.frame && JSON.stringify(masks.find((mask) => mask.maskToken === "NAVER_SC_MASK_280_RIGHT").frame) === JSON.stringify({ x: 510, y: 40, width: 200, height: 200 }), "280 RIGHT mask frame mismatch");
expect((masks.find((mask) => mask.maskToken === "NAVER_SC_MASK_200_RIGHT")?.pathDigests ?? []).length === 2, "200 RIGHT source path variants were not preserved");
expect(tokens.filter((token) => token.objectKind === "THUMBNAIL").every((token) => token.clip?.mode === "SOURCE_MASK" && maskIds.has(token.clip.maskToken)), "thumbnail token mask references are incomplete");
expect(tokens.filter((token) => token.objectKind !== "THUMBNAIL").every((token) => token.clip?.mode === "NO_CLIP"), "non-thumbnail token unexpectedly uses a clip");
expect(tokens.filter((token) => token.objectKind === "PERSON_MOVIE").every((token) => token.fitMode === (token.height >= 200 ? "SOURCE_TRANSFORM" : "NONE")), "PERSON_MOVIE policy was merged across source structures");
expect(placement.globalRules?.inheritedKakaoOrFreeformPlacementSemantics === false, "Kakao/FREEFORM placement semantics were inherited");
expect(placement.globalRules?.mirrorGeneration === "FORBIDDEN", "left/right mirror generation was not forbidden");
expect(placement.sourceAudit?.psdCount === 120 && placement.sourceAudit?.auditStatus === "SOURCE_AUDIT_COMPLETE", "PSD source audit provenance is incomplete");

try {
  const validatePlacement = new Ajv2020({ strict: false, allErrors: true }).compile(placementSchema);
  const missingToken = structuredClone(placement);
  missingToken.templateMappings = [{ ...missingToken.templateMappings[0], objectPlacementToken: "" }];
  expect(validatePlacement(missingToken) === false, "invalid/missing placement token fixture was accepted");
  const unknownToken = structuredClone(placement);
  unknownToken.templateMappings = [{ ...unknownToken.templateMappings[0], objectPlacementToken: "NAVER_SC_UNKNOWN" }];
  expect(validatePlacement(unknownToken) === false, "unknown placement token fixture was accepted");
} catch (error) {
  failures.push(`negative fixture validation failed: ${error instanceof Error ? error.message : String(error)}`);
}

const result = {
  status: failures.length === 0 ? "PASS" : "FAIL",
  registryVersion: placement.registryVersion,
  tokenCount: tokens.length,
  templateMappingCount: mappings.length,
  candidateCount: candidateIds.length,
  unresolvedCandidateCount: placement.n2Gate?.unresolvedCandidateCount,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
