import type {
  NaverSmartChannelTextInputFieldDescriptor,
  NaverSmartChannelTextInputKey,
} from "./types.js";

type JsonObject = Record<string, unknown>;
type SupportedRole = NaverSmartChannelTextInputFieldDescriptor["role"];

const ROLE_KEYS: Readonly<Record<Exclude<SupportedRole, "CTA_LABEL">, readonly NaverSmartChannelTextInputKey[]>> = {
  HEADLINE: ["headline", "headlineLine2"],
  SUBCOPY: ["subcopy", "subcopyLine4"],
  DISCLOSURE: ["disclosureLine1", "disclosureLine2"],
};

const LABEL_KEYS: Readonly<Record<NaverSmartChannelTextInputKey, string>> = {
  headline: "naver_smartchannel.field.headline",
  headlineLine2: "naver_smartchannel.field.headline_line_2",
  subcopy: "naver_smartchannel.field.subcopy",
  subcopyLine4: "naver_smartchannel.field.subcopy_line_2",
  disclosureLine1: "naver_smartchannel.field.disclosure_line_1",
  disclosureLine2: "naver_smartchannel.field.disclosure_line_2",
  ctaOption: "naver_smartchannel.field.cta_option",
};

function object(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function layerY(layer: JsonObject): number {
  const value = Number(object(layer.textPlacement).boxY);
  if (!Number.isFinite(value)) throw new Error(`SmartChannel text layer has no finite boxY: ${String(layer.name ?? "UNKNOWN")}`);
  return value;
}

/**
 * Derives Desktop-editable fields from the same exact PSD text-layer metadata
 * that Core uses to validate and map SmartChannel content. Template or mode
 * names are deliberately not interpreted here.
 */
export function deriveNaverSmartChannelTextInputFields(
  psdMetadata: JsonObject,
  templateId: string,
  affordance: string,
): readonly NaverSmartChannelTextInputFieldDescriptor[] {
  const template = array(psdMetadata.templates).find((entry) => entry.templateId === templateId);
  if (!template) throw new Error(`SmartChannel PSD metadata is missing template ${templateId}`);

  const roleCounts = new Map<Exclude<SupportedRole, "CTA_LABEL">, number>();
  const descriptors: NaverSmartChannelTextInputFieldDescriptor[] = [];
  const layers = array(template.textLayers)
    .filter((entry) => entry.visible !== false && ["HEADLINE", "SUBCOPY", "DISCLOSURE"].includes(String(entry.role)))
    .sort((left, right) => layerY(left) - layerY(right));

  for (const layer of layers) {
    const role = String(layer.role) as Exclude<SupportedRole, "CTA_LABEL">;
    const roleIndex = roleCounts.get(role) ?? 0;
    const key = ROLE_KEYS[role][roleIndex];
    if (!key) throw new Error(`SmartChannel template ${templateId} has unsupported ${role} line ${String(roleIndex + 1)}`);
    roleCounts.set(role, roleIndex + 1);
    descriptors.push({
      key,
      role,
      required: true,
      order: descriptors.length,
      labelKey: LABEL_KEYS[key],
      sourceLayerName: String(layer.name ?? ""),
    });
  }

  if (affordance === "APP_CTA") {
    descriptors.push({
      key: "ctaOption",
      role: "CTA_LABEL",
      required: true,
      order: descriptors.length,
      labelKey: LABEL_KEYS.ctaOption,
      sourceLayerName: "APP_CTA_OPTION_REGISTRY",
    });
  }

  if (descriptors.length === 0) throw new Error(`SmartChannel template ${templateId} has no canonical editable text fields`);
  return descriptors;
}
