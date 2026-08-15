import { useEffect, useMemo, useRef, useState } from "react";

import { buildCanonicalGoogleStaticRequest } from "../../../../shared/src/index.js";
import type { ExportRequest, GoogleStaticUiRequest, PreviewResult, ProductSelectionResult } from "../../../../shared/src/index.js";
import profilesRegistry from "../../../../../../contracts/google/static-asset-profiles.g1.json" with { type: "json" };
import desktopQaRegistry from "../../../../../../contracts/google/desktop-qa.g3.json" with { type: "json" };
import { issueMessage } from "../validation/messages.js";
import { formatProductMetadata } from "../product-file/format.js";

type Profile = (typeof profilesRegistry.geometryProfiles)[number] | (typeof profilesRegistry.uploadedDisplayStaticProfiles)[number];
type SelectedProduct = Extract<ProductSelectionResult, { status: "SELECTED" }>;
type PreviewView = "FIT" | "ACTUAL";

const background = { r: 245, g: 247, b: 250, alpha: 255 } as const;

function profileList(): Profile[] {
  return [...profilesRegistry.geometryProfiles, ...profilesRegistry.uploadedDisplayStaticProfiles] as Profile[];
}

function capabilityFor(profile: Profile): string {
  if (profile.role === "UPLOADED_DISPLAY_STATIC") return "GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC";
  if (profile.targetIds.includes("RDA")) return "GOOGLE_RDA_ASSET_SET";
  if (profile.targetIds.includes("PMAX")) return "GOOGLE_PMAX_ASSET_GROUP_STATIC";
  return "GOOGLE_DEMAND_GEN_SINGLE_IMAGE";
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
    outputFormat: "PNG",
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
  const [deliveryMetadataText, setDeliveryMetadataText] = useState("{}");
  const [output, setOutput] = useState<{ outputDirectoryToken: string; displayName: string } | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [exported, setExported] = useState<Extract<Awaited<ReturnType<typeof window.kbrDesktop.exportRender>>, { status: "EXPORTED" }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PreviewView>("FIT");
  const [localError, setLocalError] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!profile) return;
    const next = defaultPlan(profile);
    setPlan(next);
    setPlanText(pretty(next));
    setPreview(null);
    setExported(null);
    setLocalError(null);
  }, [profileId]);

  function markDirty() {
    sequence.current += 1;
    setPreview(null);
    setExported(null);
    setLocalError(null);
  }

  async function selectAsset() {
    const result = await window.kbrDesktop.selectProductPng();
    if (result.status === "SELECTED") {
      setAsset(result);
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
      markDirty();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Plan JSON을 해석할 수 없습니다.");
    }
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
  const canExport = Boolean(asset && output && preview?.previewToken && preview.validationStatus !== "ERROR" && preview.errors.length === 0 && !busy);

  return (
    <section className="google-lab" data-testid="google-static-editor">
      <aside className="google-sidebar" aria-label="Google Static QA 입력">
        <div className="section-heading">
          <h2>Google Static QA</h2>
          <span className={`status-pill status-${preview?.validationStatus?.toLowerCase() ?? "empty"}`} data-testid="google-validation-status">{preview?.validationStatus ?? "READY"}</span>
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
            <span>mime · {profilesRegistry.rendererOutputMime.join(", ")}</span>
            <span>target · {profile.targetIds.join(", ")}</span>
            <span>policy · {profile.allowedPlacementPolicies.join(", ") || "NONE (explicit element plan)"}</span>
          </div>
        </div>

        <div className="google-card">
          <span className="field-label">Asset</span>
          <button type="button" onClick={() => void selectAsset()} data-testid="google-select-asset">로컬 Asset 선택</button>
          {asset ? <div className="asset-card" data-testid="google-asset-metadata"><strong>{asset.displayName}</strong><span>{formatProductMetadata(asset)}</span><code>SHA-256 {asset.checksumSha256}</code></div> : <p className="hint">PNG/JPG/JPEG · 파일은 Main/Core trusted root에서만 읽습니다.</p>}
        </div>

        <div className="google-card">
          <div className="section-heading"><h3>Explicit placement plan</h3><span className="capability-pill">Raster input</span></div>
          <textarea className="google-plan-json" data-testid="google-plan-json" value={planText} onChange={(event) => { setPlanText(event.target.value); markDirty(); }} />
          <div className="button-row"><button type="button" onClick={applyPlan} data-testid="google-apply-plan">Plan 적용</button><button type="button" className="secondary" onClick={() => { const next = defaultPlan(profile); setPlan(next); setPlanText(pretty(next)); markDirty(); }} data-testid="google-reset-plan">Profile 기본값</button></div>
          <small className="hint">destinationRect는 profile canvas 안에 있어야 합니다. Platform fields는 이 plan에 포함되지 않습니다.</small>
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
        <div className={`google-canvas google-canvas-${view.toLowerCase()}`} data-testid="google-preview-canvas"><div className="google-canvas-inner" style={view === "ACTUAL" && metadata ? { width: `${metadata.width}px`, height: `${metadata.height}px` } : undefined}>{preview?.previewUrl ? <img src={preview.previewUrl} alt="Google Static preview" data-testid="google-preview-image" style={previewStyle} /> : <div className="preview-empty">Preview가 없습니다.</div>}</div></div>
        <div className="validation-summary google-validation-summary"><div><span>상태</span><strong data-testid="google-status">{preview?.validationStatus ?? "READY"}</strong></div><div><span>Canvas</span><strong>{metadata ? `${metadata.width}×${metadata.height}` : "—"}</strong></div><div><span>Format</span><strong>{metadata?.format ?? "—"}</strong></div><div><span>Bytes</span><strong>{metadata?.bytes ?? 0}</strong></div><div><span>Fingerprint</span><strong>{preview?.googleStatic?.renderFingerprint?.slice(0, 10) ?? "—"}</strong></div></div>
        <div className="google-issues" data-testid="google-diagnostics"><h3>Diagnostics</h3>{issueList(preview?.errors ?? [], "ERROR 없음")}{issueList(preview?.warnings ?? [], "WARNING 없음")}{issueList(preview?.info ?? [], "INFO 없음")}</div>
        {preview?.googleStatic ? <pre className="google-contract-summary" data-testid="google-contract-summary">{pretty(preview.googleStatic)}</pre> : null}
      </section>

      <footer className="google-export-bar">
        <div><strong>출력 폴더</strong><span>{output?.displayName ?? "선택하지 않음"}</span></div>
        <button type="button" className="secondary" onClick={() => void selectOutput()} data-testid="google-select-output">출력 폴더 선택</button>
        <button type="button" className="primary" disabled={!canExport} onClick={() => void exportRender()} data-testid="google-download">PNG/JPEG 및 Manifest 저장</button>
        {exported ? <div className="export-result" data-testid="google-export-result"><span>{exported.jobName}\\{exported.pngFileName}</span><code>{exported.artifactDigest ?? exported.pngDigest}</code><button type="button" className="secondary" onClick={() => void window.kbrDesktop.revealExportedFile(exported.exportToken)}>폴더 열기</button></div> : null}
        <p className="legal-note">Google Static Desktop QA artifact를 로컬로 저장합니다. Google Ads 업로드 승인이나 정책 적합성을 보장하지 않습니다.</p>
      </footer>
    </section>
  );
}
