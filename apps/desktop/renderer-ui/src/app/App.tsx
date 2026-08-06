import { useEffect, useMemo, useReducer, useState } from "react";

import type { AppInfo, ExportRequest, UiRenderInput } from "../../../shared/src/index.js";
import type { TextMeasurement } from "../../../../../src/core/types.js";
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

export function App() {
  const [state, dispatch] = useReducer(uiReducer, initialUiState);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const issues = useMemo(
    () => [...(state.preview?.errors ?? []), ...(state.preview?.warnings ?? [])],
    [state.preview],
  );

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

  async function clearProduct() {
    await window.kbrDesktop.clearProduct();
    dispatch({ type: "PRODUCT_CLEARED" });
  }

  async function requestPreview() {
    if (!state.product || !canRequestPreview(state)) return;
    const requestSequence = state.requestSequence + 1;
    const input: UiRenderInput = {
      assetToken: state.product.assetToken,
      ...state.fields,
      requestSequence,
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
      ...state.fields,
      previewToken: state.preview.previewToken,
      outputDirectoryToken: state.output.outputDirectoryToken,
    };
    dispatch({ type: "EXPORT_STARTED" });
    try {
      dispatch({ type: "EXPORT_RESOLVED", result: await window.kbrDesktop.exportRender(request) });
    } catch {
      dispatch({ type: "INTERNAL_ERROR", message: "Export 요청을 처리하지 못했습니다." });
    }
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
          <p>OBJECT_RIGHT · 1029×258 · CTA 없음 · Runtime network 0</p>
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
            <span className="field-label">제품 PNG</span>
            <div className="button-row">
              <button type="button" onClick={() => void selectProduct()} data-testid="select-product">
                PNG 선택
              </button>
              {state.product ? (
                <button type="button" className="secondary" onClick={() => void clearProduct()}>
                  지우기
                </button>
              ) : null}
            </div>
            {state.product ? (
              <div className="asset-card" data-testid="product-metadata">
                <strong>{state.product.fileName}</strong>
                <span>{formatProductMetadata(state.product)}</span>
                <code>SHA-256 {state.product.sha256.slice(0, 16)}…</code>
              </div>
            ) : (
              <p className="hint">원본 절대 경로는 UI에 전달하거나 표시하지 않습니다.</p>
            )}
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
            <span>Template</span><strong>OBJECT_RIGHT</strong>
            <span>Font</span><strong>Spoqa Han Sans</strong>
            <span>Baseline</span><strong>Headline 120 · Subcopy 178</strong>
          </div>

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
                <div className="guide-object"><span>Object slot 666,0,315,258</span></div>
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
