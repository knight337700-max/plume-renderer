import {
  validateNormalizedRect,
  type NormalizedRect,
} from "../../../../../../packages/renderer-contract/src/index.js";

export const CROP_RECT_FIELDS = ["x", "y", "width", "height"] as const;
export type CropRectField = (typeof CROP_RECT_FIELDS)[number];
export type CropRectDraft = Record<CropRectField, string>;

export const CROP_RECT_STEPS = {
  fine: 0.0001,
  normal: 0.001,
  coarse: 0.01,
} as const;

const COMPLETE_DECIMAL_PATTERN = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u;

export function emptyCropRectDraft(): CropRectDraft {
  return { x: "", y: "", width: "", height: "" };
}

export function cropRectToDraft(rect: NormalizedRect | undefined): CropRectDraft {
  if (!rect) return emptyCropRectDraft();
  return {
    x: String(rect.x),
    y: String(rect.y),
    width: String(rect.width),
    height: String(rect.height),
  };
}

export function cropRectToTuple(rect: NormalizedRect | undefined): string {
  if (!rect) return "";
  return CROP_RECT_FIELDS.map((field) => String(rect[field])).join(",");
}

export function tupleToCropRectDraft(value: string): CropRectDraft {
  const values = value.split(",");
  return {
    x: values[0]?.trim() ?? "",
    y: values[1]?.trim() ?? "",
    width: values[2]?.trim() ?? "",
    height: values[3]?.trim() ?? "",
  };
}

function isCompleteDecimal(value: string): boolean {
  return COMPLETE_DECIMAL_PATTERN.test(value.trim());
}

export type CropDraftValidation = Readonly<{
  rect?: NormalizedRect;
  reason?: "INCOMPLETE" | "NOT_FINITE" | "OUT_OF_BOUNDS";
}>;

export function validateCropRectDraft(draft: CropRectDraft): CropDraftValidation {
  if (CROP_RECT_FIELDS.some((field) => !draft[field].trim() || !isCompleteDecimal(draft[field]))) {
    return { reason: "INCOMPLETE" };
  }
  const values = CROP_RECT_FIELDS.map((field) => Number(draft[field].trim()));
  if (values.some((value) => !Number.isFinite(value))) return { reason: "NOT_FINITE" };
  const rect: NormalizedRect = {
    x: values[0] ?? Number.NaN,
    y: values[1] ?? Number.NaN,
    width: values[2] ?? Number.NaN,
    height: values[3] ?? Number.NaN,
  };
  if (validateNormalizedRect(rect).length > 0) return { reason: "OUT_OF_BOUNDS" };
  return { rect };
}

export function decimalStepLabel(step: number): string {
  return step.toString();
}

function addDecimalStrings(base: string, delta: string): string {
  const parse = (value: string): { sign: bigint; digits: string; fraction: number } | null => {
    const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/u);
    if (!match) return null;
    const sign = match[1] === "-" ? -1n : 1n;
    const integer = match[2] ?? "0";
    const fractionText = match[3] ?? "";
    return { sign, digits: integer + fractionText, fraction: fractionText.length };
  };
  const parsedBase = parse(base);
  const parsedDelta = parse(delta);
  if (!parsedBase || !parsedDelta) return String(Number(base) + Number(delta));
  const scale = Math.max(parsedBase.fraction, parsedDelta.fraction);
  const baseInteger = parsedBase.sign * BigInt(parsedBase.digits) * (10n ** BigInt(scale - parsedBase.fraction));
  const deltaInteger = parsedDelta.sign * BigInt(parsedDelta.digits) * (10n ** BigInt(scale - parsedDelta.fraction));
  const sum = baseInteger + deltaInteger;
  const sign = sum < 0n ? "-" : "";
  const absolute = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, "0");
  const integer = absolute.slice(0, -scale || undefined) || "0";
  const fraction = scale > 0 ? absolute.slice(-scale).replace(/0+$/u, "") : "";
  return `${sign}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function nudgeCropRectDraft(draft: CropRectDraft, field: CropRectField, delta: number): CropRectDraft {
  const current = Number(draft[field]);
  if (!Number.isFinite(current)) return { ...draft, [field]: draft[field] };
  // A nudge is a deliberate decimal operation. It never clamps to the contract
  // boundary; the caller validates the resulting draft before committing it.
  const nextText = addDecimalStrings(draft[field], String(delta));
  return { ...draft, [field]: nextText };
}

export function cropDraftErrorMessage(validation: CropDraftValidation): string {
  if (validation.reason === "INCOMPLETE") return "BLOCKED · Crop Rect 4개 필드를 완성된 decimal 값으로 입력하세요.";
  if (validation.reason === "NOT_FINITE") return "BLOCKED · Crop Rect 값은 finite 숫자여야 합니다.";
  if (validation.reason === "OUT_OF_BOUNDS") return "BLOCKED · Crop Rect는 0~1 범위, 양의 width/height, 내부 경계를 만족해야 합니다.";
  return "";
}
