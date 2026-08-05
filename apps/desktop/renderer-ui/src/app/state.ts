import type {
  ExportResult,
  OutputDirectoryResult,
  PreviewResult,
  ProductSelectionResult,
} from "../../../shared/src/index.js";

export type UiPhase =
  | "EMPTY"
  | "DIRTY"
  | "VALIDATING"
  | "VALID_ERROR"
  | "VALID_WARNING"
  | "VALID_PASS"
  | "EXPORTING"
  | "EXPORTED"
  | "INTERNAL_ERROR";

export type UiField = "advertiser" | "headline" | "subcopy" | "jobName";

export type UiState = {
  phase: UiPhase;
  fields: Record<UiField, string>;
  product: Extract<ProductSelectionResult, { status: "SELECTED" }> | null;
  preview: PreviewResult | null;
  output: Extract<OutputDirectoryResult, { status: "SELECTED" }> | null;
  exported: Extract<ExportResult, { status: "EXPORTED" }> | null;
  requestSequence: number;
  guideVisible: boolean;
  internalError: string | null;
};

export type UiAction =
  | { type: "FIELD_CHANGED"; field: UiField; value: string }
  | { type: "PRODUCT_SELECTED"; product: Extract<ProductSelectionResult, { status: "SELECTED" }> }
  | { type: "PRODUCT_CLEARED" }
  | { type: "PREVIEW_STARTED"; requestSequence: number }
  | { type: "PREVIEW_RESOLVED"; result: PreviewResult }
  | { type: "OUTPUT_SELECTED"; output: Extract<OutputDirectoryResult, { status: "SELECTED" }> }
  | { type: "EXPORT_STARTED" }
  | { type: "EXPORT_RESOLVED"; result: ExportResult }
  | { type: "GUIDE_TOGGLED" }
  | { type: "INTERNAL_ERROR"; message: string };

export const initialUiState: UiState = {
  phase: "EMPTY",
  fields: {
    advertiser: "",
    headline: "",
    subcopy: "",
    jobName: "bizboard-output",
  },
  product: null,
  preview: null,
  output: null,
  exported: null,
  requestSequence: 0,
  guideVisible: true,
  internalError: null,
};

function dirty(state: UiState): UiState {
  return {
    ...state,
    phase: state.product ? "DIRTY" : "EMPTY",
    preview: null,
    exported: null,
    internalError: null,
    requestSequence: state.requestSequence + 1,
  };
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "FIELD_CHANGED":
      return dirty({ ...state, fields: { ...state.fields, [action.field]: action.value } });
    case "PRODUCT_SELECTED":
      return dirty({ ...state, product: action.product });
    case "PRODUCT_CLEARED":
      return {
        ...state,
        product: null,
        preview: null,
        exported: null,
        phase: "EMPTY",
        internalError: null,
        requestSequence: state.requestSequence + 1,
      };
    case "PREVIEW_STARTED":
      return {
        ...state,
        phase: "VALIDATING",
        preview: null,
        exported: null,
        requestSequence: action.requestSequence,
        internalError: null,
      };
    case "PREVIEW_RESOLVED":
      if (action.result.requestSequence !== state.requestSequence) return state;
      return {
        ...state,
        preview: action.result,
        phase:
          action.result.validationStatus === "ERROR"
            ? "VALID_ERROR"
            : action.result.validationStatus === "WARNING"
              ? "VALID_WARNING"
              : "VALID_PASS",
      };
    case "OUTPUT_SELECTED":
      return { ...state, output: action.output };
    case "EXPORT_STARTED":
      return { ...state, phase: "EXPORTING", exported: null };
    case "EXPORT_RESOLVED":
      if (action.result.status === "EXPORTED") return { ...state, phase: "EXPORTED", exported: action.result };
      return { ...state, phase: action.result.status === "BLOCKED" ? "VALID_ERROR" : "INTERNAL_ERROR", internalError: action.result.message };
    case "GUIDE_TOGGLED":
      return { ...state, guideVisible: !state.guideVisible };
    case "INTERNAL_ERROR":
      return { ...state, phase: "INTERNAL_ERROR", internalError: action.message, exported: null };
  }
}

export function canRequestPreview(state: UiState): boolean {
  return Boolean(
    state.product &&
      state.fields.advertiser.trim() &&
      state.fields.headline.trim() &&
      state.fields.subcopy.trim() &&
      state.fields.jobName.trim() &&
      state.phase !== "VALIDATING" &&
      state.phase !== "EXPORTING",
  );
}

export function canExport(state: UiState): boolean {
  return Boolean(
    state.product &&
      state.preview?.previewToken &&
      state.preview.canonicalInputDigest &&
      state.preview.productAssetDigest === state.product.sha256 &&
      state.preview.errors.length === 0 &&
      state.output?.outputDirectoryToken &&
      (state.phase === "VALID_PASS" || state.phase === "VALID_WARNING"),
  );
}
