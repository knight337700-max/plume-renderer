import { useEffect, useMemo, useReducer, useState } from "react";

import type { AppInfo, ExportRequest, ProductSelectionResult, UiRenderInput, UiTemplate } from "../../../shared/src/index.js";
import type { TextMeasurement } from "../../../../../src/core/types.js";
import {
  INTEGRATION_SCHEMA_VERSION,
  OBJECT_RIGHT_IMAGE_SLOT_ID,
  THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
  THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID,
  THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID,
  parsePlacementPlan,
  serializePlacementPlan,
  type CropCandidate,
  type ImagePlacementPlan,
} from "../../../../../packages/renderer-contract/src/index.js";
import { formatProductMetadata } from "../features/product-file/format.js";
import { fieldHasError, issueMessage } from "../features/validation/messages.js";
import { canExport, canRequestPreview, initialUiState, uiReducer, type UiField } from "./state.js";

const fieldConfig: Array<{ id: UiField; label: string; pointer: string; multiline?: boolean }> = [
  { id: "advertiser", label: "광고주체", pointer: "/advertiser" },
  { id: "headline", label: "Headline", pointer: "/copy/headline" },
  { id: "subcopy", label: "Subcopy", pointer: "/copy/subcopy" },
  { id: "jobName", label: "결과 폴더명", pointer: "/output" },
];

function TextMetric({ field, measurement }: { field: "headline" | "subcopy"; measurement: TextMeasurement | null }) {
  if (!measurement) {
    return <small className="text-metric text-metric-pending">Core 검증 후 실제 폭과 한글 환산값이 표시됩니다.</small>;
  }
  const status = measurement.metrics.limitStatus.toLowerCase();
  const label = field === "headline" ? "헤드라인" : "서브카피";
  return (
    <small className={`text-metric text-metric-${status}`} data-testid={`text-metrics-${field}`}>
      {label} · 한글 환산 {measurement.metrics.koreanEquivalentUnits} / {measurement.metrics.maxKoreanEquivalentUnits}자 · 실제 폭 {measurement.metrics.occupiedWidthPx} / {measurement.metrics.maxOccupiedWidthPx}px
      <span> · 공백 포함 {measurement.metrics.graphemeCountIncludingSpaces}자</span>
    </small>
  );
}

type SelectedProduct = Extract<ProductSelectionResult, { status: "SELECTED" }>;

function defaultMultiPlan(imageSlotId: string, assetId: string): ImagePlacementPlan {
  return {
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    imageSlotId,
    assetId,
    policy: "SEMANTIC_CROP_COVER",
    source: "AGENT",
    fitMode: "COVER",
    cropRect: { x: 0, y: 0, width: 1, height: 1 },
    anchor: "CENTER",
    subjectProtection: "NONE",
  };
}

export function App() {
  const [state, dispatch] = useReducer(uiReducer, initialUiState);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [template, setTemplate] = useState<UiTemplate>("OBJECT_RIGHT");
  const [secondaryProduct, setSecondaryProduct] = useState<SelectedProduct | null>(null);
  const [policy, setPolicy] = useState<ImagePlacementPlan["policy"]>("ALPHA_TRIM_CONTAIN");
  const [anchor, setAnchor] = useState<ImagePlacementPlan["anchor"]>("CENTER");
  const [subjectProtection, setSubjectProtection] = useState<ImagePlacementPlan["subjectProtection"]>("NONE");
  const [cropRectText, setCropRectText] = useState("0,0,1,1");
  const [candidateId, setCandidateId] = useState("");
  const thumbnailCandidate: CropCandidate = {
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    candidateId: "full-frame",
    assetId: "selected-product",
    imageSlotId: THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
    cropRect: { x: 0, y: 0, width: 1, height: 1 },
    preservedSubjectIds: [],
    clippedSubjectIds: [],
    fillRatio: 1,
    subjectCoverageRatio: 1,
    warnings: [],
  };
  const [placementPlanText, setPlacementPlanText] = useState(() => JSON.stringify({
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    imageSlotId: OBJECT_RIGHT_IMAGE_SLOT_ID,
    assetId: "selected-product",
    policy: "ALPHA_TRIM_CONTAIN",
    source: "DETERMINISTIC",
    fitMode: "CONTAIN",
    anchor: "CENTER",
    subjectProtection: "NONE",
  }, null, 2));
  const [placementPlan, setPlacementPlan] = useState<ImagePlacementPlan | null>(() => ({
    schemaVersion: INTEGRATION_SCHEMA_VERSION,
    imageSlotId: OBJECT_RIGHT_IMAGE_SLOT_ID,
    assetId: "selected-product",
    policy: "ALPHA_TRIM_CONTAIN",
    source: "DETERMINISTIC",
    fitMode: "CONTAIN",
    anchor: "CENTER",
    subjectProtection: "NONE",
  }));
  const [multiPlans, setMultiPlans] = useState<Record<string, ImagePlacementPlan>>(() => ({
    [THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID]: defaultMultiPlan(THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, "selected-primary"),
    [THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]: defaultMultiPlan(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID, "selected-secondary"),
  }));
  const [multiPlanText, setMultiPlanText] = useState("");
  const multiPlanList = [multiPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID], multiPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]].filter((plan): plan is ImagePlacementPlan => Boolean(plan));
  const multiCropCandidates = multiPlanList.flatMap((plan) => {
    const candidateId = `${plan.imageSlotId}-full-frame`;
    return plan.cropCandidateId === candidateId
      ? [{
          schemaVersion: INTEGRATION_SCHEMA_VERSION,
          candidateId,
          assetId: plan.assetId,
          imageSlotId: plan.imageSlotId,
          cropRect: plan.cropRect ?? { x: 0, y: 0, width: 1, height: 1 },
          preservedSubjectIds: [],
          clippedSubjectIds: [],
          fillRatio: 1,
          subjectCoverageRatio: 1,
          warnings: [],
        } satisfies CropCandidate]
      : [];
  });
  const [placementPlanMessage, setPlacementPlanMessage] = useState("PASS · OBJECT_RIGHT 기본 Plan을 사용합니다.");
  const issues = useMemo(
    () => [...(state.preview?.errors ?? []), ...(state.preview?.warnings ?? [])],
    [state.preview],
  );
  const assetTemplateMismatch = state.product !== null && template === "OBJECT_RIGHT" && state.product.detectedMimeType !== "image/png";

  function setTemplateMode(next: UiTemplate) {
    setTemplate(next);
    dispatch({ type: "FIELD_CHANGED", field: "jobName", value: state.fields.jobName });
    if (next === "OBJECT_RIGHT") {
      setPolicy("ALPHA_TRIM_CONTAIN");
      setAnchor("CENTER");
      setSubjectProtection("NONE");
      setCandidateId("");
      const plan: ImagePlacementPlan = {
        schemaVersion: INTEGRATION_SCHEMA_VERSION,
        imageSlotId: OBJECT_RIGHT_IMAGE_SLOT_ID,
        assetId: "selected-product",
        policy: "ALPHA_TRIM_CONTAIN",
        source: "DETERMINISTIC",
        fitMode: "CONTAIN",
        anchor: "CENTER",
        subjectProtection: "NONE",
      };
      setPlacementPlan(plan);
      setPlacementPlanText(JSON.stringify(plan, null, 2));
      setPlacementPlanMessage("PASS · OBJECT_RIGHT 기본 Plan을 사용합니다.");
      return;
    }
    if (next === "THUMBNAIL_MULTI_RIGHT") {
      const nextPlans = {
        [THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID]: defaultMultiPlan(THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, "selected-primary"),
        [THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]: defaultMultiPlan(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID, "selected-secondary"),
      };
      setMultiPlans(nextPlans);
      setMultiPlanText(JSON.stringify({ schemaVersion: "1.0.0", templateId: "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT", imagePlacementPlans: Object.values(nextPlans) }, null, 2));
      setPlacementPlan(null);
      setPlacementPlanMessage("PASS · THUMBNAIL_MULTI_RIGHT에는 IMAGE_PRIMARY와 IMAGE_SECONDARY Plan이 필요합니다.");
      return;
    }
    setPolicy("SEMANTIC_CROP_COVER");
    const plan: ImagePlacementPlan = {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
      assetId: "selected-product",
      policy: "SEMANTIC_CROP_COVER",
      source: "DETERMINISTIC",
      fitMode: "COVER",
      anchor,
      subjectProtection,
      cropRect: { x: 0, y: 0, width: 1, height: 1 },
    };
    setPlacementPlan(plan);
    setPlacementPlanText(JSON.stringify(plan, null, 2));
    setCropRectText("0,0,1,1");
    setPlacementPlanMessage("PASS · THUMBNAIL_BOX_RIGHT direct crop를 사용합니다.");
  }

  function updateThumbnailPlan(next: Partial<ImagePlacementPlan>, selectedCandidateId = candidateId) {
    if (template !== "THUMBNAIL_BOX_RIGHT") return;
    const current = placementPlan;
    const nextPlan: ImagePlacementPlan = {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
      assetId: "selected-product",
      policy,
      source: policy === "MANUAL_CROP" ? "MANUAL" : "DETERMINISTIC",
      fitMode: "COVER",
      anchor,
      subjectProtection,
      ...(!selectedCandidateId && current?.cropRect ? { cropRect: current.cropRect } : {}),
      ...(selectedCandidateId ? { cropCandidateId: selectedCandidateId } : {}),
      ...next,
    };
    setPlacementPlan(nextPlan);
    setPlacementPlanText(JSON.stringify(nextPlan, null, 2));
  }

  type MultiPlanPatch = Omit<Partial<ImagePlacementPlan>, "cropRect" | "cropCandidateId"> & { cropRect?: ImagePlacementPlan["cropRect"] | undefined; cropCandidateId?: string | undefined };

  function updateMultiPlan(imageSlotId: string, next: MultiPlanPatch) {
    if (template !== "THUMBNAIL_MULTI_RIGHT") return;
    const current = multiPlans[imageSlotId] ?? defaultMultiPlan(imageSlotId, imageSlotId === THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID ? "selected-primary" : "selected-secondary");
    const nextPlanRaw: Record<string, unknown> = { ...current, ...next, schemaVersion: INTEGRATION_SCHEMA_VERSION, imageSlotId };
    if (next.cropRect === undefined && Object.prototype.hasOwnProperty.call(next, "cropRect")) {
      delete nextPlanRaw.cropRect;
    }
    if (next.cropCandidateId === undefined && Object.prototype.hasOwnProperty.call(next, "cropCandidateId")) {
      delete nextPlanRaw.cropCandidateId;
    }
    const nextPlan = nextPlanRaw as ImagePlacementPlan;
    const nextPlans = { ...multiPlans, [imageSlotId]: nextPlan };
    setMultiPlans(nextPlans);
    setMultiPlanText(JSON.stringify({ schemaVersion: "1.0.0", templateId: "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT", imagePlacementPlans: [nextPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID], nextPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]], cropCandidates: multiCropCandidates }, null, 2));
  }

  function applyCropRect() {
    const values = cropRectText.split(",").map((value) => Number(value.trim()));
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
      setPlacementPlanMessage("BLOCKED · Crop Rect는 x,y,width,height 숫자 4개여야 합니다.");
      return;
    }
    setCandidateId("");
    updateThumbnailPlan({ cropRect: { x: values[0] ?? 0, y: values[1] ?? 0, width: values[2] ?? 0, height: values[3] ?? 0 } });
    setPlacementPlanMessage("PASS · direct crop rect를 적용했습니다.");
  }

  useEffect(() => {
    void window.kbrDesktop.getAppInfo().then(setAppInfo).catch(() => {
      dispatch({ type: "INTERNAL_ERROR", message: "앱 정보를 불러오지 못했습니다." });
    });
  }, []);

  async function selectProduct() {
    const result = await window.kbrDesktop.selectProductPng();
    if (result.status === "SELECTED") dispatch({ type: "PRODUCT_SELECTED", product: result });
    else if (result.status === "ERROR") dispatch({ type: "INTERNAL_ERROR", message: result.message });
  }

  async function selectSecondaryProduct() {
    const result = await window.kbrDesktop.selectSecondaryProductPng();
    if (result.status === "SELECTED") {
      setSecondaryProduct(result);
      dispatch({ type: "FIELD_CHANGED", field: "jobName", value: state.fields.jobName });
    } else if (result.status === "ERROR") dispatch({ type: "INTERNAL_ERROR", message: result.message });
  }

  async function clearProduct() {
    await window.kbrDesktop.clearProduct();
    dispatch({ type: "PRODUCT_CLEARED" });
  }

  async function clearSecondaryProduct() {
    await window.kbrDesktop.clearSecondaryProduct();
    setSecondaryProduct(null);
    dispatch({ type: "FIELD_CHANGED", field: "jobName", value: state.fields.jobName });
  }

  async function requestPreview() {
    if (!state.product || !canRequestPreview(state)) return;
    const requestSequence = state.requestSequence + 1;
    const input: UiRenderInput = {
      assetToken: state.product.assetToken,
      ...(template === "THUMBNAIL_MULTI_RIGHT" && secondaryProduct ? { secondaryAssetToken: secondaryProduct.assetToken } : {}),
      ...state.fields,
      requestSequence,
      ...(template === "THUMBNAIL_BOX_RIGHT" ? { template, ...(placementPlan ? { placementPlan } : {}), ...(candidateId ? { cropCandidates: [thumbnailCandidate] } : {}) } : {}),
      ...(template === "THUMBNAIL_MULTI_RIGHT" ? { template, placementPlans: multiPlanList, cropCandidates: multiCropCandidates } : {}),
    };
    dispatch({ type: "PREVIEW_STARTED", requestSequence });
    try {
      const result = await window.kbrDesktop.requestPreview(input);
      dispatch({ type: "PREVIEW_RESOLVED", result });
    } catch {
      dispatch({ type: "INTERNAL_ERROR", message: "Preview 요청을 처리하지 못했습니다." });
    }
  }

  async function selectOutputDirectory() {
    const result = await window.kbrDesktop.selectOutputDirectory();
    if (result.status === "SELECTED") dispatch({ type: "OUTPUT_SELECTED", output: result });
    else if (result.status === "ERROR") dispatch({ type: "INTERNAL_ERROR", message: result.message });
  }

  async function exportRender() {
    if (!canExport(state) || !state.product || !state.preview?.previewToken || !state.output) return;
    const request: ExportRequest = {
      assetToken: state.product.assetToken,
      ...(template === "THUMBNAIL_MULTI_RIGHT" && secondaryProduct ? { secondaryAssetToken: secondaryProduct.assetToken } : {}),
      ...state.fields,
      previewToken: state.preview.previewToken,
      outputDirectoryToken: state.output.outputDirectoryToken,
      ...(template === "THUMBNAIL_BOX_RIGHT" ? { template, ...(placementPlan ? { placementPlan } : {}), ...(candidateId ? { cropCandidates: [thumbnailCandidate] } : {}) } : {}),
      ...(template === "THUMBNAIL_MULTI_RIGHT" ? { template, placementPlans: multiPlanList, cropCandidates: multiCropCandidates } : {}),
    };
    dispatch({ type: "EXPORT_STARTED" });
    try {
      dispatch({ type: "EXPORT_RESOLVED", result: await window.kbrDesktop.exportRender(request) });
    } catch {
      dispatch({ type: "INTERNAL_ERROR", message: "Export 요청을 처리하지 못했습니다." });
    }
  }

  function importPlacementPlan(text = placementPlanText) {
    try {
      const parsedJson: unknown = JSON.parse(text);
      if (template === "THUMBNAIL_MULTI_RIGHT") {
        if (!parsedJson || typeof parsedJson !== "object" || !Array.isArray((parsedJson as { imagePlacementPlans?: unknown }).imagePlacementPlans)) {
          setMultiPlans({});
          setPlacementPlanMessage("BLOCKED · 다중 Slot JSON에는 imagePlacementPlans 배열이 필요합니다.");
          return;
        }
        const parsedPlans = (parsedJson as { imagePlacementPlans: unknown[] }).imagePlacementPlans.map((value) => parsePlacementPlan(value));
        const errors = parsedPlans.flatMap((entry) => entry.errors);
        const plans = parsedPlans.flatMap((entry) => entry.plan ? [entry.plan] : []);
        const ids = plans.map((plan) => plan.imageSlotId);
        if (errors.length > 0 || plans.length !== 2 || new Set(ids).size !== 2 || !ids.includes(THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID) || !ids.includes(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID)) {
          setMultiPlans({});
          setPlacementPlanMessage(`BLOCKED · ${errors.map((error) => error.code).join(", ") || "두 Slot Plan이 필요합니다."}`);
          return;
        }
        const nextPlans = Object.fromEntries(plans.map((plan) => [plan.imageSlotId, plan]));
        setMultiPlans(nextPlans);
        setMultiPlanText(JSON.stringify({ schemaVersion: "1.0.0", templateId: "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT", imagePlacementPlans: [nextPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID], nextPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]] }, null, 2));
        setPlacementPlanMessage(`PASS · 두 Slot Plan을 ID 기준으로 매핑했습니다.`);
        return;
      }
      const parsed = parsePlacementPlan(parsedJson);
      if (parsed.errors.length > 0 || !parsed.plan) {
        setPlacementPlan(null);
        setPlacementPlanMessage(`BLOCKED · ${parsed.errors.map((error) => error.code).join(", ")}`);
        return;
      }
      if (template === "OBJECT_RIGHT" && (parsed.plan.imageSlotId !== OBJECT_RIGHT_IMAGE_SLOT_ID || parsed.plan.policy !== "ALPHA_TRIM_CONTAIN" || parsed.plan.fitMode !== "CONTAIN")) {
        setPlacementPlan(null);
        setPlacementPlanMessage("BLOCKED · OBJECT_RIGHT는 ALPHA_TRIM_CONTAIN + CONTAIN만 허용합니다.");
        return;
      }
      if (template === "THUMBNAIL_BOX_RIGHT" && (parsed.plan.imageSlotId !== THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID || !["SEMANTIC_CROP_COVER", "MANUAL_CROP"].includes(parsed.plan.policy) || parsed.plan.fitMode !== "COVER")) {
        setPlacementPlan(null);
        setPlacementPlanMessage("BLOCKED · THUMBNAIL_BOX_RIGHT는 COVER + Crop 정책만 허용합니다.");
        return;
      }
      setPolicy(parsed.plan.policy);
      setAnchor(parsed.plan.anchor);
      setSubjectProtection(parsed.plan.subjectProtection);
      setCandidateId(parsed.plan.cropCandidateId ?? "");
      if (parsed.plan.cropRect) setCropRectText([parsed.plan.cropRect.x, parsed.plan.cropRect.y, parsed.plan.cropRect.width, parsed.plan.cropRect.height].join(","));
      setPlacementPlan(parsed.plan);
      setPlacementPlanText(JSON.stringify(parsed.plan, null, 2));
      setPlacementPlanMessage(`PASS · source=${parsed.plan.source} · 변경 없이 저장됨`);
    } catch {
      setPlacementPlan(null);
      setPlacementPlanMessage("BLOCKED · JSON을 파싱할 수 없습니다.");
    }
  }

  function exportPlacementPlan() {
    if (template === "THUMBNAIL_MULTI_RIGHT") {
      const primary = multiPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID];
      const secondary = multiPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID];
      if (!primary || !secondary) {
        setPlacementPlanMessage("BLOCKED · IMAGE_PRIMARY/IMAGE_SECONDARY Plan이 모두 필요합니다.");
        return;
      }
      const text = JSON.stringify({ schemaVersion: "1.0.0", templateId: "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT", imagePlacementPlans: [primary, secondary], cropCandidates: multiCropCandidates }, null, 2);
      setMultiPlanText(text);
      setPlacementPlanMessage("EXPORTED · 두 Slot을 Template 순서로 정렬했습니다.");
      return;
    }
    if (!placementPlan) {
      setPlacementPlanMessage("BLOCKED · 먼저 유효한 Plan을 Import하세요.");
      return;
    }
    setPlacementPlanText(serializePlacementPlan(placementPlan));
    setPlacementPlanMessage(`EXPORTED · source=${placementPlan.source} · canonical JSON`);
  }

  function loadAgentFixture() {
    if (template === "THUMBNAIL_MULTI_RIGHT") {
      const nextPlans: Record<string, ImagePlacementPlan> = {
        [THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID]: { ...(multiPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID] ?? defaultMultiPlan(THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, "selected-primary")), source: "AGENT", policy: "SEMANTIC_CROP_COVER", fitMode: "COVER" },
        [THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]: { ...(multiPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID] ?? defaultMultiPlan(THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID, "selected-secondary")), source: "AGENT", policy: "SEMANTIC_CROP_COVER", fitMode: "COVER" },
      };
      setMultiPlans(nextPlans);
      setMultiPlanText(JSON.stringify({ schemaVersion: "1.0.0", templateId: "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT", imagePlacementPlans: [nextPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID], nextPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]], cropCandidates: multiCropCandidates }, null, 2));
      setPlacementPlanMessage("PASS · Agent source를 두 Slot에 적용했습니다.");
      return;
    }
    const fixture: ImagePlacementPlan = template === "THUMBNAIL_BOX_RIGHT" ? {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: THUMBNAIL_BOX_RIGHT_IMAGE_SLOT_ID,
      assetId: "selected-product",
      policy: "SEMANTIC_CROP_COVER",
      source: "AGENT",
      fitMode: "COVER",
      anchor: "CENTER",
      subjectProtection: "NONE",
      cropRect: { x: 0, y: 0, width: 1, height: 1 },
      confidence: 0.99,
      rationale: "Agent fixture uses the same serializable semantic crop path.",
    } : {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: OBJECT_RIGHT_IMAGE_SLOT_ID,
      assetId: "selected-product",
      policy: "ALPHA_TRIM_CONTAIN",
      source: "AGENT",
      fitMode: "CONTAIN",
      anchor: "CENTER",
      subjectProtection: "NONE",
      confidence: 0.99,
      rationale: "Agent fixture uses the same serializable PlacementPlan path.",
    };
    importPlacementPlan(JSON.stringify(fixture));
  }

  const statusLabel = {
    EMPTY: "제품과 카피를 입력하세요",
    DIRTY: "입력이 변경되어 Preview가 필요합니다",
    VALIDATING: "Core Validator 실행 중",
    VALID_ERROR: "오류가 있어 Export할 수 없습니다",
    VALID_WARNING: "경고가 있지만 Export할 수 있습니다",
    VALID_PASS: "검증 통과",
    EXPORTING: "PNG와 manifest 저장 중",
    EXPORTED: "저장 완료",
    INTERNAL_ERROR: "내부 오류",
  }[state.phase];

  return (
    <main className="app-shell" data-testid="desktop-app">
      <header className="app-header">
        <div>
          <p className="eyebrow">비공식 내부 제작 도구</p>
          <h1>카카오 비즈보드 로컬 Renderer</h1>
          <p>{template} · 1029×258 · CTA 없음 · Runtime network 0</p>
        </div>
        <div className="app-version">v{appInfo?.version ?? "…"}</div>
      </header>

      <section className="workspace">
        <aside className="input-panel" aria-label="입력 패널">
          <div className="section-heading">
            <h2>입력</h2>
            <span className={`status-pill status-${state.phase.toLowerCase()}`} data-testid="workflow-status">
              {state.phase}
            </span>
          </div>

          <div className="field-group">
            <span className="field-label">제품 이미지</span>
            <div className="button-row">
              <button type="button" onClick={() => void selectProduct()} data-testid="select-product">
                이미지 선택
              </button>
              {state.product ? (
                <button type="button" className="secondary" onClick={() => void clearProduct()}>
                  지우기
                </button>
              ) : null}
            </div>
            {state.product ? (
              <div className="asset-card" data-testid="product-metadata">
                <strong>{state.product.displayName}</strong>
                <span>{formatProductMetadata(state.product)}</span>
                <code>SHA-256 {state.product.checksumSha256.slice(0, 16)}…</code>
              </div>
            ) : (
              <p className="hint">지원 파일: PNG, JPG, JPEG · 원본 절대 경로는 UI에 전달하거나 표시하지 않습니다.</p>
            )}
            {template === "OBJECT_RIGHT" ? <p className="hint">지원 파일: 투명 배경 PNG · 누끼 이미지 전용 유형입니다.</p> : <p className="hint">지원 파일: PNG, JPG, JPEG · {template === "THUMBNAIL_MULTI_RIGHT" ? "두 Slot을 독립적으로 지정하거나 하나의 Asset을 재사용합니다." : "배경이 포함된 이미지도 사용할 수 있습니다."}</p>}
            {assetTemplateMismatch ? <p className="placement-plan-status status-error" data-testid="asset-template-mismatch">BLOCKED · OBJECT_RIGHT는 투명 배경 PNG만 허용합니다. 새 파일을 선택하세요.</p> : null}
            {template === "THUMBNAIL_MULTI_RIGHT" ? (
              <div className="multi-slot-assets" data-testid="multi-slot-assets">
                <div className="slot-asset-panel" data-testid="slot-panel-IMAGE_PRIMARY">
                  <strong>IMAGE_PRIMARY</strong>
                  <span>{state.product ? formatProductMetadata(state.product) : "Asset 없음"}</span>
                </div>
                <div className="slot-asset-panel" data-testid="slot-panel-IMAGE_SECONDARY">
                  <strong>IMAGE_SECONDARY</strong>
                  <span>{secondaryProduct ? formatProductMetadata(secondaryProduct) : "Asset 없음 · Primary 재사용 또는 별도 선택"}</span>
                  <div className="button-row">
                    <button type="button" onClick={() => void selectSecondaryProduct()} data-testid="select-secondary-product">두 번째 이미지 선택</button>
                    <button type="button" className="secondary" onClick={() => {
                      if (state.product) setSecondaryProduct(state.product);
                      dispatch({ type: "FIELD_CHANGED", field: "jobName", value: state.fields.jobName });
                    }} data-testid="reuse-primary-product">Primary 재사용</button>
                    {secondaryProduct ? <button type="button" className="secondary" onClick={() => void clearSecondaryProduct()} data-testid="clear-secondary-product">지우기</button> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {fieldConfig.map(({ id, label, pointer }) => {
            const error = fieldHasError(state.preview?.errors ?? [], pointer);
            const measurement = id === "headline"
              ? state.preview?.measurements?.headline ?? null
              : id === "subcopy"
                ? state.preview?.measurements?.subcopy ?? null
                : null;
            return (
              <label className="field-group" key={id}>
                <span className="field-label">{label}</span>
                <input
                  data-testid={`input-${id}`}
                  value={state.fields[id]}
                  aria-invalid={error}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: id, value: event.target.value })}
                  autoComplete="off"
                  spellCheck={false}
                />
                {id === "headline" || id === "subcopy" ? (
                  <TextMetric field={id} measurement={measurement} />
                ) : null}
              </label>
            );
          })}

          <div className="fixed-contract">
            <span>CTA</span><strong>없음 (NONE)</strong>
            <span>Template</span><strong>{template}</strong>
            <span>Font</span><strong>Spoqa Han Sans</strong>
            <span>Baseline</span><strong>Headline 120 · Subcopy 178</strong>
          </div>

          <section className="placement-panel" aria-label="Placement Plan">
            <div className="section-heading">
              <h2>Placement Plan</h2>
              <span className="capability-pill">IMPLEMENTED</span>
            </div>
            <label className="field-group"><span className="field-label">Template</span><select data-testid="template-select" value={template} onChange={(event) => setTemplateMode(event.target.value as UiTemplate)}><option value="OBJECT_RIGHT">OBJECT_RIGHT</option><option value="THUMBNAIL_BOX_RIGHT">THUMBNAIL_BOX_RIGHT</option><option value="THUMBNAIL_MULTI_RIGHT">THUMBNAIL_MULTI_RIGHT</option></select></label>
            <p className="hint">Capability · {template === "OBJECT_RIGHT" ? "KAKAO_BIZBOARD_OBJECT_RIGHT" : template === "THUMBNAIL_BOX_RIGHT" ? "KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT" : "KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT"} · Agent-independent Contract v{INTEGRATION_SCHEMA_VERSION}</p>
            {template !== "THUMBNAIL_MULTI_RIGHT" ? <>
            <div className="placement-grid">
              <label><span className="field-label">Policy</span><select data-testid="policy-select" value={policy} disabled={template === "OBJECT_RIGHT"} onChange={(event) => { const next = event.target.value as ImagePlacementPlan["policy"]; setPolicy(next); setCandidateId(""); updateThumbnailPlan({ policy: next, source: next === "MANUAL_CROP" ? "MANUAL" : "DETERMINISTIC", fitMode: "COVER", cropRect: placementPlan?.cropRect ?? { x: 0, y: 0, width: 1, height: 1 } }); }}><option value="ALPHA_TRIM_CONTAIN">ALPHA_TRIM_CONTAIN</option><option value="SEMANTIC_CROP_COVER">SEMANTIC_CROP_COVER</option><option value="MANUAL_CROP">MANUAL_CROP</option></select></label>
              <label><span className="field-label">Fit Mode</span><select value={template === "OBJECT_RIGHT" ? "CONTAIN" : "COVER"} disabled><option>{template === "OBJECT_RIGHT" ? "CONTAIN" : "COVER"}</option></select></label>
              <label><span className="field-label">Anchor</span><select data-testid="anchor-select" value={anchor} disabled={template === "OBJECT_RIGHT"} onChange={(event) => { const next = event.target.value as ImagePlacementPlan["anchor"]; setAnchor(next); updateThumbnailPlan({ anchor: next }); }}><option value="CENTER">CENTER</option><option value="CENTER_LEFT">CENTER_LEFT</option><option value="CENTER_RIGHT">CENTER_RIGHT</option><option value="TOP_CENTER">TOP_CENTER</option><option value="BOTTOM_CENTER">BOTTOM_CENTER</option></select></label>
              <label><span className="field-label">Protection</span><select data-testid="subject-protection-select" value={subjectProtection} disabled={template === "OBJECT_RIGHT"} onChange={(event) => { const next = event.target.value as ImagePlacementPlan["subjectProtection"]; setSubjectProtection(next); updateThumbnailPlan({ subjectProtection: next }); }}><option value="NONE">NONE</option><option value="PREFERRED">PREFERRED</option><option value="REQUIRED">REQUIRED</option></select></label>
            </div>
            {template === "THUMBNAIL_BOX_RIGHT" ? (
              <>
                <label className="field-group"><span className="field-label">Crop Rect (normalized x,y,w,h)</span><input data-testid="crop-rect-input" value={cropRectText} onChange={(event) => setCropRectText(event.target.value)} /><button type="button" className="secondary" onClick={applyCropRect} data-testid="crop-rect-apply">Apply Crop Rect</button></label>
                <label className="field-group"><span className="field-label">Crop Candidate</span><select data-testid="crop-candidate-select" value={candidateId} onChange={(event) => { const next = event.target.value; setCandidateId(next); if (next) updateThumbnailPlan({ cropCandidateId: next }, next); else updateThumbnailPlan({ cropRect: { x: 0, y: 0, width: 1, height: 1 } }, ""); }}><option value="">Direct crop</option><option value="full-frame">full-frame</option></select></label>
                <small className="hint">Candidate가 없으면 입력한 direct crop만 사용합니다. Renderer는 crop을 자동 추정하지 않습니다.</small>
              </>
            ) : (
              <>
                <label className="field-group placement-disabled-field"><span className="field-label">Crop Rect / Focal Point / Candidate</span><input value="비활성 · OBJECT_RIGHT는 Alpha Trim만 지원" disabled /></label>
                <small className="hint">수동 Crop과 semantic candidate는 OBJECT_RIGHT에서 지원하지 않습니다.</small>
              </>
            )}
            </> : null}
            {template === "THUMBNAIL_MULTI_RIGHT" ? (
              <div className="multi-placement-panels" data-testid="multi-placement-panels">
                {[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID, THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID].map((slotId) => {
                  const plan = multiPlans[slotId];
                  if (!plan) return null;
                  const slotLabel = slotId === THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID ? "PRIMARY" : "SECONDARY";
                  return (
                    <fieldset className="slot-placement-panel" key={slotId} data-testid={`placement-panel-${slotId}`}>
                      <legend>{slotId}</legend>
                      <small className="hint">Slot별 Asset · {plan.assetId} · source={plan.source}</small>
                      <div className="placement-grid">
                        <label><span className="field-label">Policy</span><select data-testid={`policy-${slotLabel}`} value={plan.policy} onChange={(event) => { const next = event.target.value as ImagePlacementPlan["policy"]; updateMultiPlan(slotId, { policy: next, source: next === "MANUAL_CROP" ? "MANUAL" : plan.source, fitMode: "COVER", ...(next === "MANUAL_CROP" ? { cropCandidateId: undefined, cropRect: plan.cropRect ?? { x: 0, y: 0, width: 1, height: 1 } } : {}) }); }}><option value="SEMANTIC_CROP_COVER">SEMANTIC_CROP_COVER</option><option value="MANUAL_CROP">MANUAL_CROP</option></select></label>
                        <label><span className="field-label">Source</span><select data-testid={`source-${slotLabel}`} value={plan.source} onChange={(event) => updateMultiPlan(slotId, { source: event.target.value as ImagePlacementPlan["source"] })}><option value="MANUAL">MANUAL</option><option value="AGENT">AGENT</option></select></label>
                        <label><span className="field-label">Anchor</span><select data-testid={`anchor-${slotLabel}`} value={plan.anchor} onChange={(event) => updateMultiPlan(slotId, { anchor: event.target.value as ImagePlacementPlan["anchor"] })}><option value="CENTER">CENTER</option><option value="CENTER_LEFT">CENTER_LEFT</option><option value="CENTER_RIGHT">CENTER_RIGHT</option><option value="TOP_CENTER">TOP_CENTER</option><option value="BOTTOM_CENTER">BOTTOM_CENTER</option></select></label>
                        <label><span className="field-label">Protection</span><select data-testid={`protection-${slotLabel}`} value={plan.subjectProtection} onChange={(event) => updateMultiPlan(slotId, { subjectProtection: event.target.value as ImagePlacementPlan["subjectProtection"] })}><option value="NONE">NONE</option><option value="PREFERRED">PREFERRED</option><option value="REQUIRED">REQUIRED</option></select></label>
                        <label><span className="field-label">Crop Candidate</span><select data-testid={`candidate-${slotLabel}`} value={plan.cropCandidateId ?? ""} disabled={plan.policy === "MANUAL_CROP"} onChange={(event) => {
                          const next = event.target.value;
                          if (next) updateMultiPlan(slotId, { cropCandidateId: next, cropRect: undefined });
                          else updateMultiPlan(slotId, { cropCandidateId: undefined, cropRect: plan.cropRect ?? { x: 0, y: 0, width: 1, height: 1 } });
                        }}><option value="">Direct crop</option><option value={`${slotId}-full-frame`}>Full-frame candidate</option></select></label>
                      </div>
                      <label className="field-group"><span className="field-label">Crop Rect (normalized x,y,w,h)</span><input data-testid={`crop-${slotLabel}`} disabled={Boolean(plan.cropCandidateId)} value={plan.cropRect ? [plan.cropRect.x, plan.cropRect.y, plan.cropRect.width, plan.cropRect.height].join(",") : ""} onChange={(event) => { const values = event.target.value.split(",").map((value) => Number(value.trim())); if (values.length === 4 && values.every((value) => Number.isFinite(value))) updateMultiPlan(slotId, { cropRect: { x: values[0] ?? 0, y: values[1] ?? 0, width: values[2] ?? 0, height: values[3] ?? 0 }, cropCandidateId: undefined }); }} /></label>
                      <small className="hint">Destination · {slotId === THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID ? "x=621 y=43 w=172 h=172" : "x=809 y=43 w=172 h=172"} · radius=12</small>
                      <small className="hint" data-testid={`applied-crop-${slotLabel}`}>Applied crop · {state.preview?.appliedImagePlacements?.find((placement) => placement.imageSlotId === slotId)?.resolvedSourceCropRect ? JSON.stringify(state.preview.appliedImagePlacements.find((placement) => placement.imageSlotId === slotId)?.resolvedSourceCropRect) : "pending"}</small>
                      <small className="hint" data-testid={`applied-destination-${slotLabel}`}>Applied destination · {state.preview?.appliedImagePlacements?.find((placement) => placement.imageSlotId === slotId)?.destinationRect ? JSON.stringify(state.preview.appliedImagePlacements.find((placement) => placement.imageSlotId === slotId)?.destinationRect) : "pending"}</small>
                    </fieldset>
                  );
                })}
              </div>
            ) : null}
            <label className="field-group"><span className="field-label">ImagePlacementPlan JSON</span><textarea data-testid="placement-plan-json" value={template === "THUMBNAIL_MULTI_RIGHT" ? multiPlanText : placementPlanText} onChange={(event) => template === "THUMBNAIL_MULTI_RIGHT" ? setMultiPlanText(event.target.value) : setPlacementPlanText(event.target.value)} rows={template === "THUMBNAIL_MULTI_RIGHT" ? 14 : 9} spellCheck={false} /></label>
            <div className="button-row">
              <button type="button" onClick={() => importPlacementPlan()} data-testid="placement-plan-import">Plan Import</button>
              <button type="button" className="secondary" onClick={exportPlacementPlan} data-testid="placement-plan-export">Plan Export</button>
              <button type="button" className="secondary" onClick={loadAgentFixture} data-testid="placement-agent-fixture">Agent Fixture</button>
            </div>
            <small className={`placement-plan-status ${(template === "THUMBNAIL_MULTI_RIGHT" ? Boolean(multiPlans[THUMBNAIL_MULTI_RIGHT_PRIMARY_SLOT_ID] && multiPlans[THUMBNAIL_MULTI_RIGHT_SECONDARY_SLOT_ID]) : Boolean(placementPlan)) ? "status-pass" : "status-error"}`} data-testid="placement-plan-status">{placementPlanMessage}</small>
            <small className="hint" data-testid="applied-crop">Applied crop · {state.preview?.appliedImagePlacement?.resolvedSourceCropRect ? JSON.stringify(state.preview.appliedImagePlacement.resolvedSourceCropRect) : template === "OBJECT_RIGHT" ? "none (ALPHA_TRIM_CONTAIN preserves source alpha bounds)" : "pending"}</small>
            {state.preview?.appliedImagePlacement?.destinationRect ? <small className="hint" data-testid="applied-destination-rect">Applied destinationRect · x={state.preview.appliedImagePlacement.destinationRect.x}, y={state.preview.appliedImagePlacement.destinationRect.y}, w={state.preview.appliedImagePlacement.destinationRect.width}, h={state.preview.appliedImagePlacement.destinationRect.height}</small> : state.preview?.measurements?.productPlacedBox ? <small className="hint" data-testid="applied-destination-rect">Applied destinationRect · x={state.preview.measurements.productPlacedBox.x}, y={state.preview.measurements.productPlacedBox.y}, w={state.preview.measurements.productPlacedBox.width}, h={state.preview.measurements.productPlacedBox.height}</small> : null}
          </section>

          <button
            type="button"
            className="primary full"
            disabled={!canRequestPreview(state)}
            onClick={() => void requestPreview()}
            data-testid="request-preview"
          >
            Preview 검증
          </button>
        </aside>

        <section className="preview-panel" aria-label="Preview">
          <div className="section-heading">
            <div>
              <h2>Preview</h2>
              <p className="hint">원본 1029×258 · 화면에서는 비율을 유지해 축소</p>
            </div>
            <label className="guide-toggle">
              <input
                type="checkbox"
                checked={state.guideVisible}
                onChange={() => dispatch({ type: "GUIDE_TOGGLED" })}
              />
              가이드 보기
            </label>
          </div>

          <div className="preview-frame" data-testid="preview-frame">
            {state.preview?.previewUrl ? (
              <img src={state.preview.previewUrl} alt="Core Renderer Preview" data-testid="preview-image" />
            ) : (
              <div className="preview-empty">Core Preview가 여기에 표시됩니다.</div>
            )}
            {state.guideVisible ? (
              <div className="guide-overlay" aria-hidden="true" data-testid="guide-overlay">
                <div className="guide-object"><span>{template === "OBJECT_RIGHT" ? "Object slot 666,0,315,258" : template === "THUMBNAIL_BOX_RIGHT" ? "Image slot 666,36,315,186 · r12" : "IMAGE_PRIMARY 621,43,172,172 · IMAGE_SECONDARY 809,43,172,172 · gap 16 · r12"}</span></div>
                <div className="guide-hard-edge" />
                <div className="guide-gap" />
                <div className="guide-right-margin" />
              </div>
            ) : null}
          </div>

          <div className="validation-summary">
            <div>
              <span>상태</span>
              <strong data-testid="status-label">{statusLabel}</strong>
            </div>
            <div><span>오류</span><strong>{state.preview?.errors.length ?? 0}</strong></div>
            <div><span>경고</span><strong>{state.preview?.warnings.length ?? 0}</strong></div>
            <div><span>PNG</span><strong>{state.preview?.pngMetadata?.bytes ?? 0} bytes</strong></div>
            <div><span>Gap</span><strong>{state.preview?.measurements?.copyObjectGapPx ?? "—"} px</strong></div>
          </div>

          <div className="issue-list" aria-live="polite" data-testid="issue-list">
            {issues.length === 0 ? <p className="hint">표시할 오류나 경고가 없습니다.</p> : null}
            {issues.map((issue) => (
              <article className={`issue issue-${issue.severity.toLowerCase()}`} key={`${issue.code}-${issue.path}`}>
                <div><strong>{issue.severity}</strong><code>{issue.code}</code></div>
                <p>{issueMessage(issue)}</p>
                <small>{issue.path}</small>
              </article>
            ))}
            {state.internalError ? <article className="issue issue-error"><strong>INTERNAL_ERROR</strong><p>{state.internalError}</p></article> : null}
          </div>
        </section>
      </section>

      <footer className="export-bar">
        <div>
          <strong>출력 폴더</strong>
          <span>{state.output?.displayName ?? "선택하지 않음"}</span>
        </div>
        <button type="button" className="secondary" onClick={() => void selectOutputDirectory()} data-testid="select-output">
          출력 폴더 선택
        </button>
        <button type="button" className="primary" disabled={!canExport(state)} onClick={() => void exportRender()} data-testid="export-render">
          PNG 및 Manifest 저장
        </button>
        {state.exported ? (
          <div className="export-result" data-testid="export-result">
            <span>{state.exported.jobName}\output.png</span>
            <code>{state.exported.pngDigest}</code>
            <button type="button" className="secondary" onClick={() => {
              if (state.exported) void window.kbrDesktop.revealExportedFile(state.exported.exportToken);
            }}>
              폴더 열기
            </button>
          </div>
        ) : null}
        <p className="legal-note">카카오 공식 제작툴이 아니며 실제 광고 심사 승인을 보장하지 않습니다. 코드 서명이 없어 SmartScreen 경고가 표시될 수 있습니다.</p>
      </footer>
    </main>
  );
}
