import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { buildCanonicalGoogleStaticRequest } from "../../../../shared/src/index.js";
import type { ExportRequest, GoogleStaticUiRequest, PreviewResult, ProductSelectionResult } from "../../../../shared/src/index.js";
import profilesRegistry from "../../../../../../contracts/google/static-asset-profiles.g1.json" with { type: "json" };
import desktopQaRegistry from "../../../../../../contracts/google/desktop-qa.g3.json" with { type: "json" };
import goldensRegistry from "../../../../../../contracts/google/goldens.g2.1.json" with { type: "json" };
import { INTEGRATION_SCHEMA_VERSION, type ImagePlacementPlan } from "../../../../../../packages/renderer-contract/src/index.js";
import { issueMessage, localizedMessage } from "../validation/messages.js";
import { formatProductMetadata } from "../product-file/format.js";

type Profile = (typeof profilesRegistry.geometryProfiles)[number] | (typeof profilesRegistry.uploadedDisplayStaticProfiles)[number];
type SelectedProduct = Extract<ProductSelectionResult, { status: "SELECTED" }>;
type PreviewView = "FIT" | "ACTUAL";

const background = { r: 245, g: 247, b: 250, alpha: 255 } as const;
const DEFAULT_PLACEMENT = Object.freeze({ x: 0.5, y: 0.5, scale: 1 });
type PlacementValues = { x: number; y: number; scale: number };

function profileList(): Profile[] {
  return [...profilesRegistry.geometryProfiles, ...profilesRegistry.uploadedDisplayStaticProfiles] as Profile[];
}

function capabilityFor(profile: Profile): string {
  if (profile.role === "UPLOADED_DISPLAY_STATIC") return "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC";
  if (profile.targetIds.includes("RDA")) return "GOOGLE_RDA_ASSET_SET";
  if (profile.targetIds.includes("PMAX")) return "GOOGLE_PMAX_ASSET_GROUP_STATIC";
  return "GOOGLE_DEMAND_GEN_SINGLE_IMAGE";
}

function defaultOutputFormat(profileId: string): "PNG" | "JPEG" {
  const entry = goldensRegistry.entries.find((candidate) => candidate.profileId === profileId);
  return entry?.mime === "image/jpeg" ? "JPEG" : "PNG";
}

function formatLabel(format: "PNG" | "JPEG"): string {
  return format === "JPEG" ? "JPG (image/jpeg)" : "PNG (image/png)";
}

function coverCrop(sourceWidth: number, sourceHeight: number, canvasWidth: number, canvasHeight: number, scale: number): { width: number; height: number } {
  const sourceRatio = sourceWidth / sourceHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  const baseWidth = sourceRatio > canvasRatio ? canvasRatio / sourceRatio : 1;
  const baseHeight = sourceRatio > canvasRatio ? 1 : sourceRatio / canvasRatio;
  return { width: Math.min(1, baseWidth / scale), height: Math.min(1, baseHeight / scale) };
}

function manualCrop(sourceWidth: number, sourceHeight: number, canvasWidth: number, canvasHeight: number, values: PlacementValues) {
  const size = coverCrop(sourceWidth, sourceHeight, canvasWidth, canvasHeight, values.scale);
  return {
    x: Math.min(1 - size.width, Math.max(0, values.x - size.width / 2)),
    y: Math.min(1 - size.height, Math.max(0, values.y - size.height / 2)),
    width: size.width,
    height: size.height,
  };
}

function quantize(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function withoutPlacementFields(current: GoogleStaticUiRequest): GoogleStaticUiRequest {
  return Object.fromEntries(Object.entries(current).filter(([key]) => !["sourceRect", "semanticPlan", "placementPlan"].includes(key))) as GoogleStaticUiRequest;
}

function placementPlanFor(profile: Profile, asset: SelectedProduct, values: PlacementValues, current: GoogleStaticUiRequest): GoogleStaticUiRequest {
  const canvas = profile.projectOutputPreset;
  if (profile.role !== "LOGO" && profile.role !== "LANDSCAPE_LOGO" && profile.role !== "UPLOADED_DISPLAY_STATIC") {
    const rest = withoutPlacementFields(current);
    const cropRect = manualCrop(asset.width, asset.height, canvas.width, canvas.height, values);
    const placementPlan: ImagePlacementPlan = {
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      imageSlotId: "GOOGLE_STATIC_PRIMARY",
      assetId: asset.checksumSha256,
      policy: "MANUAL_CROP",
      source: "MANUAL",
      fitMode: "COVER",
      cropRect: Object.fromEntries(Object.entries(cropRect).map(([key, value]) => [key, quantize(value)])) as typeof cropRect,
      anchor: "CENTER",
      subjectProtection: "NONE",
    };
    return { ...rest, placementPolicy: "MANUAL_CROP", placementPlan };
  }

  const rest = withoutPlacementFields(current);
  const fitScale = profile.role === "UPLOADED_DISPLAY_STATIC"
    ? { width: canvas.width, height: canvas.height }
    : (() => {
      const ratio = Math.min(canvas.width / asset.width, canvas.height / asset.height);
      return { width: Math.max(1, Math.round(asset.width * ratio)), height: Math.max(1, Math.round(asset.height * ratio)) };
    })();
  const width = Math.min(canvas.width, Math.max(1, Math.round(fitScale.width * values.scale)));
  const height = Math.min(canvas.height, Math.max(1, Math.round(fitScale.height * values.scale)));
  const x = Math.min(canvas.width - width, Math.max(0, Math.round(values.x * canvas.width - width / 2)));
  const y = Math.min(canvas.height - height, Math.max(0, Math.round(values.y * canvas.height - height / 2)));
  return { ...rest, destinationRect: { x, y, width, height } };
}

function valuesFromPlan(profile: Profile, asset: SelectedProduct | null, plan: GoogleStaticUiRequest): PlacementValues {
  const crop = plan.placementPlan?.cropRect;
  if (!asset || !crop) return { ...DEFAULT_PLACEMENT };
  const size = coverCrop(asset.width, asset.height, profile.projectOutputPreset.width, profile.projectOutputPreset.height, 1);
  return {
    x: quantize(crop.x + crop.width / 2),
    y: quantize(crop.y + crop.height / 2),
    scale: quantize(Math.max(size.width / crop.width, size.height / crop.height)),
  };
}

function defaultPlan(profile: Profile): GoogleStaticUiRequest {
  const uploaded = profile.role === "UPLOADED_DISPLAY_STATIC";
  const logo = profile.role === "LOGO" || profile.role === "LANDSCAPE_LOGO";
  const policy: GoogleStaticUiRequest["placementPolicy"] = uploaded ? "NONE" : logo ? "ALPHA_TRIM_CONTAIN" : "CENTER_CONTAIN";
  return {
    profileId: profile.profileId,
    capabilityId: capabilityFor(profile),
    placementPolicy: policy,
    destinationRect: { x: 0, y: 0, width: profile.projectOutputPreset.width, height: profile.projectOutputPreset.height },
    background,
    ...(uploaded ? { explicitElementPlan: true } : {}),
    outputFormat: defaultOutputFormat(profile.profileId),
    ...(defaultOutputFormat(profile.profileId) === "JPEG" ? { jpegQuality: 88 } : {}),
  };
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function issueList(issues: readonly PreviewResult["errors"][number][], emptyText: string) {
  if (issues.length === 0) return <p className="hint">{emptyText}</p>;
  return issues.map((issue) => (
    <article className={`issue issue-${issue.severity.toLowerCase()}`} key={`${issue.code}-${issue.path}`}>
      <div><strong>{issue.severity}</strong><code>{issue.code}</code></div>
      <p>{issueMessage(issue)}</p>
      <small>{issue.path}</small>
    </article>
  ));
}

export function GoogleStaticEditor() {
  const profiles = useMemo(profileList, []);
  const firstProfile = profiles[0];
  if (!firstProfile) return <section className="google-lab" data-testid="google-static-editor"><p className="scope-blocked">Google Static profile registry가 비어 있습니다.</p></section>;
  const [profileId, setProfileId] = useState(firstProfile?.profileId ?? "");
  const profile = profiles.find((entry) => entry.profileId === profileId) ?? firstProfile;
  const [asset, setAsset] = useState<SelectedProduct | null>(null);
  const [planText, setPlanText] = useState(() => pretty(defaultPlan(firstProfile)));
  const [plan, setPlan] = useState<GoogleStaticUiRequest>(() => defaultPlan(firstProfile));
  const [placementValues, setPlacementValues] = useState<PlacementValues>({ ...DEFAULT_PLACEMENT });
  const [deliveryMetadataText, setDeliveryMetadataText] = useState("{}");
  const [output, setOutput] = useState<{ outputDirectoryToken: string; displayName: string } | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [exported, setExported] = useState<Extract<Awaited<ReturnType<typeof window.kbrDesktop.exportRender>>, { status: "EXPORTED" }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PreviewView>("FIT");
  const [localError, setLocalError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const sequence = useRef(0);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; values: PlacementValues } | null>(null);

  useEffect(() => {
    if (!profile) return;
    const next = defaultPlan(profile);
    setPlan(next);
    setPlanText(pretty(next));
    setPlacementValues({ ...DEFAULT_PLACEMENT });
    setPreview(null);
    setExported(null);
    setStale(false);
    setLocalError(null);
  }, [profileId]);

  function markDirty() {
    sequence.current += 1;
    setStale((current) => current || Boolean(preview));
    setPreview(null);
    setExported(null);
    setLocalError(null);
  }

  async function selectAsset() {
    const result = await window.kbrDesktop.selectProductPng();
    if (result.status === "SELECTED") {
      setAsset(result);
      const next = defaultPlan(profile);
      setPlan(next);
      setPlanText(pretty(next));
      setPlacementValues({ ...DEFAULT_PLACEMENT });
      markDirty();
    } else if (result.status === "ERROR") setLocalError(result.message);
  }

  async function selectOutput() {
    const result = await window.kbrDesktop.selectOutputDirectory();
    if (result.status === "SELECTED") {
      setOutput(result);
      markDirty();
    } else if (result.status === "ERROR") setLocalError(result.message);
  }

  function applyPlan() {
    try {
      const next = JSON.parse(planText) as GoogleStaticUiRequest;
      if (!next || next.profileId !== profile.profileId) throw new Error("Plan profileId가 선택한 profile과 다릅니다.");
      setPlan(next);
      setPlacementValues(valuesFromPlan(profile, asset, next));
      markDirty();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Plan JSON을 해석할 수 없습니다.");
    }
  }

  function updatePlacement(next: PlacementValues) {
    if (![next.x, next.y, next.scale].every(Number.isFinite) || next.x < 0 || next.x > 1 || next.y < 0 || next.y > 1 || next.scale <= 0 || next.scale > 4) {
      setLocalError(localizedMessage("google.placement_invalid"));
      markDirty();
      return;
    }
    const normalized = { x: quantize(next.x), y: quantize(next.y), scale: quantize(next.scale) };
    setPlacementValues(normalized);
    if (asset) {
      const nextPlan = placementPlanFor(profile, asset, normalized, plan);
      setPlan(nextPlan);
      setPlanText(pretty(nextPlan));
    }
    markDirty();
  }

  function resetPlacement() {
    const defaults = defaultPlan(profile);
    const next = {
      ...defaults,
      outputFormat: plan.outputFormat,
      ...(plan.outputFormat === "JPEG" ? { jpegQuality: plan.jpegQuality ?? 88 } : {}),
    } as GoogleStaticUiRequest;
    setPlan(next);
    setPlanText(pretty(next));
    setPlacementValues({ ...DEFAULT_PLACEMENT });
    markDirty();
  }

  function updateFormat(nextFormat: "PNG" | "JPEG") {
    const next = nextFormat === "JPEG"
      ? { ...plan, outputFormat: nextFormat, jpegQuality: plan.jpegQuality ?? 88 }
      : Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "jpegQuality").concat([["outputFormat", nextFormat]])) as GoogleStaticUiRequest;
    setPlan(next);
    setPlanText(pretty(next));
    markDirty();
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!asset) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, values: placementValues };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = bounds.width > 0 ? (event.clientX - drag.startX) / bounds.width : 0;
    const dy = bounds.height > 0 ? (event.clientY - drag.startY) / bounds.height : 0;
    updatePlacement({ x: drag.values.x + dx, y: drag.values.y + dy, scale: drag.values.scale });
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function readDeliveryMetadata(): Readonly<Record<string, unknown>> {
    return buildCanonicalGoogleStaticRequest(plan, JSON.parse(deliveryMetadataText)).deliveryMetadata ?? {};
  }

  async function requestPreview() {
    if (!asset) {
      setLocalError("먼저 제품 또는 Google Static Asset을 선택하세요.");
      return;
    }
    try {
      const deliveryMetadata = readDeliveryMetadata();
      const canonicalGoogleStaticRequest = buildCanonicalGoogleStaticRequest(plan, deliveryMetadata);
      const requestSequence = ++sequence.current;
      setBusy(true);
      setStale(false);
      setPreview(null);
      setExported(null);
      try {
        const result = await window.kbrDesktop.requestPreview({
          assetToken: asset.assetToken,
          advertiser: "",
          headline: "",
          subcopy: "",
          jobName: "google-static",
          requestSequence,
          googleStatic: canonicalGoogleStaticRequest,
        });
        if (result.requestSequence === sequence.current) setPreview(result);
      } finally {
        setBusy(false);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Delivery metadata JSON을 해석할 수 없습니다.");
    }
  }

  async function exportRender() {
    if (!asset || !output || !preview?.previewToken || preview.validationStatus === "ERROR") return;
    try {
      const request: ExportRequest = {
        assetToken: asset.assetToken,
        advertiser: "",
        headline: "",
        subcopy: "",
        jobName: "google-static",
        previewToken: preview.previewToken,
        outputDirectoryToken: output.outputDirectoryToken,
        googleStatic: buildCanonicalGoogleStaticRequest(plan, JSON.parse(deliveryMetadataText)),
      };
      setBusy(true);
      const result = await window.kbrDesktop.exportRender(request);
      setBusy(false);
      if (result.status === "EXPORTED") setExported(result);
      else setLocalError(result.message);
    } catch (error) {
      setBusy(false);
      setLocalError(error instanceof Error ? error.message : "Delivery metadata JSON을 해석할 수 없습니다.");
    }
  }

  const metadata = preview?.pngMetadata;
  const previewStyle = view === "ACTUAL" && metadata ? { width: `${metadata.width}px`, height: `${metadata.height}px`, maxWidth: "none", maxHeight: "none" } : undefined;
  const allowedFormats = (profilesRegistry.rendererOutputMime ?? []).map((mime) => mime === "image/jpeg" ? "JPEG" : "PNG").filter((format, index, all) => all.indexOf(format) === index) as Array<"PNG" | "JPEG">;
  const canExport = Boolean(asset && output && preview?.previewToken && !stale && preview.validationStatus !== "ERROR" && preview.errors.length === 0 && !busy);
  const status = stale ? "STALE" : preview?.validationStatus ?? "READY";

  return (
    <section className="google-lab" data-testid="google-static-editor">
      <aside className="google-sidebar" aria-label="Google Static QA 입력">
        <div className="section-heading">
          <h2>Google Static QA</h2>
          <span className={`status-pill status-${status.toLowerCase()}`} data-testid="google-validation-status">{status}</span>
        </div>
        <p className="scope-blocked">Desktop QA 전용 · Google Ads Upload/API, OAuth, 플랫폼 screenshot chrome, runtime network는 지원하지 않습니다.</p>

        <div className="google-card">
          <label className="field-label" htmlFor="google-profile-select">Static profile</label>
          <select id="google-profile-select" data-testid="google-profile-select" value={profile.profileId} onChange={(event) => { setProfileId(event.target.value); markDirty(); }}>
            <optgroup label={desktopQaRegistry.groups[0]?.label ?? "Geometry"}>
              {profilesRegistry.geometryProfiles.map((entry: Profile) => <option key={entry.profileId} value={entry.profileId}>{entry.profileId}</option>)}
            </optgroup>
            <optgroup label={desktopQaRegistry.groups[1]?.label ?? "Uploaded Display Static"}>
              {profilesRegistry.uploadedDisplayStaticProfiles.map((entry: Profile) => <option key={entry.profileId} value={entry.profileId}>{entry.profileId}</option>)}
            </optgroup>
          </select>
          <div className="google-profile-summary" data-testid="google-profile-summary">
            <strong>{profile.profileId}</strong>
            <span>role · {profile.role}</span>
            <span>canvas · {profile.projectOutputPreset.width}×{profile.projectOutputPreset.height}px</span>
            <span>mime · {allowedFormats.map(formatLabel).join(", ")}</span>
            <span>target · {profile.targetIds.join(", ")}</span>
            <span>policy · {profile.allowedPlacementPolicies.join(", ") || "NONE (explicit element plan)"}</span>
          </div>
        </div>

        <div className="google-card">
          <span className="field-label">Asset</span>
          <button type="button" onClick={() => void selectAsset()} data-testid="google-select-asset">로컬 Asset 선택</button>
          {asset ? <div className="asset-card" data-testid="google-asset-metadata"><strong>{asset.displayName}</strong><span>{formatProductMetadata(asset)}</span><code>SHA-256 {asset.checksumSha256}</code></div> : <p className="hint">PNG/JPG/JPEG · 파일은 Main/Core trusted root에서만 읽습니다.</p>}
        </div>

        <div className="google-card" data-testid="google-output-format-card">
          <div className="section-heading"><h3>{localizedMessage("google.output_format")}</h3><span className="capability-pill">PNG / JPG</span></div>
          <label className="field-group" htmlFor="google-output-format"><span className="field-label">{localizedMessage("google.output_format_label")}</span><select id="google-output-format" data-testid="google-output-format" value={plan.outputFormat} onChange={(event) => updateFormat(event.currentTarget.value as "PNG" | "JPEG")}>
            {allowedFormats.map((format) => <option key={format} value={format}>{formatLabel(format)}</option>)}
          </select><small className="hint">{plan.outputFormat === "JPEG" ? "output.jpg · deterministic JPEG encoder" : "output.png · RGBA PNG-32"}</small></label>
        </div>

        <div className="google-card">
          <div className="section-heading"><h3>Image placement</h3><span className="capability-pill">{plan.placementPolicy}</span></div>
          <p className="hint" data-testid="google-placement-status">{stale ? localizedMessage("google.placement_stale") : localizedMessage("google.placement_hint")}</p>
          <div className="google-placement-controls">
            <label><span>{localizedMessage("google.placement_x")}</span><input data-testid="google-placement-x" type="number" min="0" max="1" step="0.01" value={placementValues.x} onChange={(event) => updatePlacement({ ...placementValues, x: Number(event.currentTarget.value) })} /></label>
            <label><span>{localizedMessage("google.placement_y")}</span><input data-testid="google-placement-y" type="number" min="0" max="1" step="0.01" value={placementValues.y} onChange={(event) => updatePlacement({ ...placementValues, y: Number(event.currentTarget.value) })} /></label>
            <label><span>{localizedMessage("google.placement_scale")}</span><input data-testid="google-placement-scale" type="number" min="0.25" max="4" step="0.01" value={placementValues.scale} onChange={(event) => updatePlacement({ ...placementValues, scale: Number(event.currentTarget.value) })} /></label>
          </div>
          <div className="button-row google-placement-buttons"><button type="button" className="secondary" onClick={() => updatePlacement({ ...placementValues, scale: Math.max(0.25, quantize(placementValues.scale - 0.1)) })} disabled={!asset} data-testid="google-placement-zoom-out">−</button><button type="button" className="secondary" onClick={() => updatePlacement({ ...placementValues, scale: Math.min(4, quantize(placementValues.scale + 0.1)) })} disabled={!asset} data-testid="google-placement-zoom-in">+</button><button type="button" className="secondary" onClick={resetPlacement} data-testid="google-reset-placement">{localizedMessage("google.reset_placement")}</button></div>
          <small className="hint">{localizedMessage("google.placement_normalized_hint")}</small>
        </div>

        <div className="google-card">
          <div className="section-heading"><h3>Explicit placement plan</h3><span className="capability-pill">Canonical JSON</span></div>
          <textarea className="google-plan-json" data-testid="google-plan-json" value={planText} onChange={(event) => { setPlanText(event.target.value); markDirty(); }} />
          <div className="button-row"><button type="button" onClick={applyPlan} data-testid="google-apply-plan">Plan 적용</button><button type="button" className="secondary" onClick={resetPlacement} data-testid="google-reset-plan">Profile 기본값</button></div>
          <small className="hint">destinationRect와 ImagePlacementPlan은 profile canvas 안의 정규화된 입력입니다. Platform fields는 이 plan에 포함되지 않습니다.</small>
        </div>

        <div className="google-card" data-testid="google-delivery-metadata">
          <div className="section-heading"><h3>Delivery metadata</h3><span className="capability-pill">Metadata only</span></div>
          <textarea className="google-metadata-json" value={deliveryMetadataText} onChange={(event) => { setDeliveryMetadataText(event.target.value); markDirty(); }} aria-label="Delivery metadata JSON" />
          <small className="hint">이 값은 digest와 진단용이며 raster pixels에 들어가지 않습니다.</small>
        </div>

        {localError ? <p className="placement-plan-status status-error" data-testid="google-local-error">{localError}</p> : null}
        <button type="button" className="primary full" disabled={!asset || busy} onClick={() => void requestPreview()} data-testid="google-request-preview">{busy ? "검증 중…" : "Preview 및 Validator 실행"}</button>
      </aside>

      <section className="google-preview-panel" aria-label="Google Static QA Preview">
        <div className="section-heading"><div><h2>Preview</h2><p className="hint">실제 artifact만 표시 · platform chrome 없음</p></div><div className="button-row"><button type="button" className={view === "FIT" ? "primary" : "secondary"} onClick={() => setView("FIT")} data-testid="google-fit-view">Fit</button><button type="button" className={view === "ACTUAL" ? "primary" : "secondary"} onClick={() => setView("ACTUAL")} data-testid="google-actual-view">100% actual pixels</button></div></div>
        <div className={`google-canvas google-canvas-${view.toLowerCase()} google-placement-surface`} data-testid="google-preview-canvas" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}><div className="google-canvas-inner" style={view === "ACTUAL" && metadata ? { width: `${metadata.width}px`, height: `${metadata.height}px` } : undefined}>{preview?.previewUrl ? <img src={preview.previewUrl} alt="Google Static preview" data-testid="google-preview-image" style={previewStyle} draggable={false} /> : <div className="preview-empty">Preview가 없습니다.</div>}</div></div>
        <div className="validation-summary google-validation-summary"><div><span>상태</span><strong data-testid="google-status">{status}</strong></div><div><span>Canvas</span><strong>{metadata ? `${metadata.width}×${metadata.height}` : "—"}</strong></div><div><span>Format</span><strong>{metadata?.format ?? plan.outputFormat}</strong></div><div><span>Bytes</span><strong>{metadata?.bytes ?? 0}</strong></div><div><span>Fingerprint</span><strong>{preview?.googleStatic?.renderFingerprint?.slice(0, 10) ?? "—"}</strong></div></div>
        <div className="google-issues" data-testid="google-diagnostics"><h3>Diagnostics</h3>{issueList(preview?.errors ?? [], "ERROR 없음")}{issueList(preview?.warnings ?? [], "WARNING 없음")}{issueList(preview?.info ?? [], "INFO 없음")}</div>
        {preview?.googleStatic ? <pre className="google-contract-summary" data-testid="google-contract-summary">{pretty(preview.googleStatic)}</pre> : null}
      </section>

      <footer className="google-export-bar">
        <div><strong>출력 폴더</strong><span>{output?.displayName ?? "선택하지 않음"}</span></div>
        <button type="button" className="secondary" onClick={() => void selectOutput()} data-testid="google-select-output">출력 폴더 선택</button>
        <button type="button" className="primary" disabled={!canExport} onClick={() => void exportRender()} data-testid="google-download">{plan.outputFormat} 및 Manifest 저장</button>
        {exported ? <div className="export-result" data-testid="google-export-result"><span>{exported.jobName}\\{exported.pngFileName}</span><code>{exported.artifactDigest ?? exported.pngDigest}</code><button type="button" className="secondary" onClick={() => void window.kbrDesktop.revealExportedFile(exported.exportToken)}>폴더 열기</button></div> : null}
        <p className="legal-note">Google Static Desktop QA artifact를 로컬로 저장합니다. Google Ads 업로드 승인이나 정책 적합성을 보장하지 않습니다.</p>
      </footer>
    </section>
  );
}
