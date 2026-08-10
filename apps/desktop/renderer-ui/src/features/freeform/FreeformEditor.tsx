import { useEffect, useMemo, useState, type KeyboardEvent, type ReactElement } from "react";

import type {
  CreativeElement,
  CreativeLayoutPlan,
  FormatProfile,
  FreeformFontRegistry,
  ImagePlacementSpec,
} from "../../../../../../packages/renderer-contract/src/index.js";
import { CROP_KEYBOARD_STEPS } from "../placement/crop-rect.js";
import type {
  ExportRequest,
  ExportResult,
  PreviewResult,
  ProductSelectionResult,
  UiRenderInput,
} from "../../../../shared/src/index.js";
import formatCatalogJson from "../../../../../../contracts/freeform-format-profiles.json" with { type: "json" };
import fontRegistryJson from "../../../../../../contracts/freeform-font-registry.json" with { type: "json" };
import { formatProductMetadata } from "../product-file/format.js";
import { issueMessage } from "../validation/messages.js";
import {
  applyImagePlacementPreset,
  calculateContainedDestination,
  createNeutralImageElement,
  type ImagePlacementPreset,
  type RasterDimensions,
} from "./image-placement-presets.js";

type SelectedProduct = Extract<ProductSelectionResult, { status: "SELECTED" }>;
type EditableElement = CreativeLayoutPlan["elements"][number];
type ElementType = "IMAGE" | "TEXT" | "LOGO";
type GeometryField = "x" | "y" | "width" | "height";
type OutputQuality = number | "AUTO_FIT";

const formatCatalog = formatCatalogJson as unknown as { profiles: readonly FormatProfile[] };
const fontRegistry = fontRegistryJson as unknown as FreeformFontRegistry;
const profiles = formatCatalog.profiles.filter((profile) => profile.channelNamespace !== "NAVER_GFA" && profile.implementationStatus === "IMPLEMENTED" && profile.catalogStatus !== "INTERNAL_TEST_ONLY");
const catalogOnlyProfiles = formatCatalog.profiles.filter((profile) => profile.channelNamespace !== "NAVER_GFA" && (profile.implementationStatus !== "IMPLEMENTED" || profile.catalogStatus === "INTERNAL_TEST_ONLY")).filter((profile) => profile.catalogStatus !== "INTERNAL_TEST_ONLY");
const defaultProfile = profiles[0];

function placementFor(type: "IMAGE" | "LOGO", policy: ImagePlacementSpec["policy"] = type === "LOGO" ? "ALPHA_TRIM_CONTAIN" : "CENTER_CONTAIN"): ImagePlacementSpec {
  const cover = policy === "MANUAL_CROP" || policy === "SEMANTIC_CROP_COVER";
  return {
    policy,
    source: "MANUAL",
    fitMode: cover ? "COVER" : "CONTAIN",
    ...(policy === "MANUAL_CROP" ? { cropRect: { x: 0, y: 0, width: 1, height: 1 } } : {}),
    anchor: "CENTER",
    subjectProtection: "NONE",
  };
}

function makeElement(type: ElementType, id: string, assetId: string): EditableElement {
  if (type === "IMAGE") {
    return createNeutralImageElement(id, assetId);
  }
  if (type === "LOGO") {
    return { id, type, assetId, bounds: { x: 0.76, y: 0.06, width: 0.18, height: 0.14 }, zIndex: 0, placement: placementFor(type) };
  }
  return {
    id,
    type,
    bounds: { x: 0.06, y: 0.12, width: 0.62, height: 0.24 },
    zIndex: 0,
    text: "새 텍스트",
    fontId: "SPOQA_HAN_SANS_REGULAR",
    fontSizePx: 48,
    color: "#20262D",
    lineHeightPx: 58,
    textAlign: "LEFT",
    verticalAlign: "TOP",
    wrapMode: "NO_WRAP",
    overflowMode: "ERROR",
    letterSpacingPx: 0,
  };
}

function nextId(elements: readonly EditableElement[], type: ElementType): string {
  const prefix = type.toLowerCase();
  const used = new Set(elements.map((element) => element.id));
  let number = 1;
  while (used.has(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function nextAssetId(type: ElementType, id: string, assetTokens: Readonly<Record<string, string>>): string {
  const preferred = type === "LOGO" ? "asset-logo" : "asset-primary";
  if (assetTokens[preferred]) return preferred;
  return `${id}-asset`;
}

function safeZoneInfo(profile: FormatProfile): { classification: "REQUIRED" | "RECOMMENDED" | "UNKNOWN"; insets: { top: number; right: number; bottom: number; left: number } | null } {
  const policy = profile.safeZonePolicy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return { classification: "UNKNOWN", insets: null };
  const record = policy as Record<string, unknown>;
  const classification = record.classification === "REQUIRED" || record.classification === "RECOMMENDED" ? record.classification : "UNKNOWN";
  const candidate = record.required ?? record.avoid ?? record.edgeSafeZone;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { classification, insets: null };
  const values = candidate as Record<string, unknown>;
  if (![values.top, values.right, values.bottom, values.left].every((value) => typeof value === "number" && Number.isFinite(value))) return { classification, insets: null };
  return {
    classification,
    insets: {
      top: values.top as number,
      right: values.right as number,
      bottom: values.bottom as number,
      left: values.left as number,
    },
  };
}

function formatCollectionRule(profile: FormatProfile): string {
  if (!profile.collectionRule) return "없음 (단일 이미지)";
  return JSON.stringify(profile.collectionRule);
}

function jsonValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function GeometryEditor({ element, onChange }: { element: EditableElement; onChange: (patch: Partial<EditableElement>) => void }) {
  const updateBounds = (field: GeometryField, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onChange({ bounds: { ...element.bounds, [field]: parsed } });
  };
  const adjust = (field: GeometryField, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const step = event.altKey ? CROP_KEYBOARD_STEPS.alt : event.shiftKey ? CROP_KEYBOARD_STEPS.shift : CROP_KEYBOARD_STEPS.default;
    const delta = event.key === "ArrowUp" ? step : -step;
    updateBounds(field, String(Number(element.bounds[field]) + delta));
  };
  return (
    <div className="freeform-geometry" data-testid={`freeform-geometry-${element.id}`}>
      {(["x", "y", "width", "height"] as const).map((field) => (
        <label key={field}>
          <span>{field.toUpperCase()}</span>
          <input
            type="number"
            step="any"
            data-testid={`freeform-geometry-${element.id}-${field}`}
            value={String(element.bounds[field])}
            onChange={(event) => updateBounds(field, event.currentTarget.value)}
            onKeyDown={(event) => adjust(field, event)}
          />
        </label>
      ))}
      <label><span>Z</span><input type="number" step="1" data-testid={`freeform-geometry-${element.id}-z-index`} value={String(element.zIndex)} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) onChange({ zIndex: value }); }} /></label>
      <label><span>Opacity</span><input type="number" step="any" data-testid={`freeform-geometry-${element.id}-opacity`} value={String(element.opacity ?? 1)} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) onChange({ opacity: value }); }} /></label>
    </div>
  );
}

export function FreeformEditor({ channel = "KAKAO", initialProfileId }: { channel?: "KAKAO" | "NAVER"; initialProfileId?: string } = {}) {
  const availableProfiles = useMemo(
    () => channel === "NAVER"
      ? formatCatalog.profiles.filter((profile) => profile.channelNamespace === "NAVER_GFA" && profile.implementationStatus === "IMPLEMENTED" && profile.catalogStatus !== "INTERNAL_TEST_ONLY")
      : profiles,
    [channel],
  );
  const availableCatalogOnlyProfiles = channel === "NAVER" ? [] : catalogOnlyProfiles;
  const initialProfile = channel === "NAVER"
    ? availableProfiles.find((entry) => entry.formatProfileId === initialProfileId)
    : availableProfiles.find((entry) => entry.formatProfileId === initialProfileId) ?? availableProfiles[0] ?? defaultProfile;
  const [profileId, setProfileId] = useState(initialProfile?.formatProfileId ?? "");
  const profile = useMemo(() => formatCatalog.profiles.find((entry) => entry.formatProfileId === profileId) ?? initialProfile, [initialProfile, profileId]);
  const [plan, setPlan] = useState<CreativeLayoutPlan>(() => ({
    schemaVersion: "1.0.0",
    formatProfileId: initialProfile?.formatProfileId ?? "",
    source: "MANUAL",
    background: { type: "SOLID", color: "#FFFFFF" },
    elements: [],
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetTokens, setAssetTokens] = useState<Record<string, string>>({});
  const [assetSelections, setAssetSelections] = useState<Record<string, SelectedProduct>>({});
  const [outputFormat, setOutputFormat] = useState<"PNG" | "JPEG">("PNG");
  const [outputQuality, setOutputQuality] = useState<OutputQuality>("AUTO_FIT");
  const [jobName, setJobName] = useState("freeform-render");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [requestSequence, setRequestSequence] = useState(0);
  const [validating, setValidating] = useState(false);
  const [output, setOutput] = useState<{ outputDirectoryToken: string; displayName: string } | null>(null);
  const [exported, setExported] = useState<Extract<ExportResult, { status: "EXPORTED" }> | null>(null);
  const [safeZoneVisible, setSafeZoneVisible] = useState(true);
  const [planJson, setPlanJson] = useState(() => JSON.stringify(plan, null, 2));
  const [notice, setNotice] = useState("");

  useEffect(() => { setPlanJson(JSON.stringify(plan, null, 2)); }, [plan]);

  const selectedElement = plan.elements.find((element) => element.id === selectedId) ?? null;
  const safeZone = profile ? safeZoneInfo(profile) : { classification: "UNKNOWN" as const, insets: null };
  const allowedFormats = (profile?.allowedOutputFormats ?? ["PNG"]).map((format) => format === "JPG" ? "JPEG" : format).filter((format, index, all) => all.indexOf(format) === index) as Array<"PNG" | "JPEG">;
  const formatSupports = (type: ElementType): boolean => {
    if (type === "IMAGE") return profile?.elementConstraints?.allowImage !== false;
    if (type === "TEXT") return profile?.elementConstraints?.allowText !== false;
    return profile?.elementConstraints?.allowLogo !== false;
  };
  const previewCurrent = Boolean(preview && preview.requestSequence === requestSequence);
  const previewAvailable = Boolean(previewCurrent && preview?.previewUrl && (preview.eligibility?.previewAllowed ?? true));
  const previewFresh = Boolean(previewCurrent && (preview?.eligibility?.downloadAllowed ?? (preview?.validationStatus !== "ERROR" && preview?.errors.length === 0)));
  const issues = [...(preview?.errors ?? []), ...(preview?.warnings ?? [])];
  const formatChanged = (next: "PNG" | "JPEG") => {
    setOutputFormat(next);
    setPreview(null);
    setExported(null);
    setRequestSequence((value) => value + 1);
  };
  const updatePlan = (updater: (current: CreativeLayoutPlan) => CreativeLayoutPlan) => {
    setPlan((current) => updater(current));
    setPreview(null);
    setExported(null);
    setRequestSequence((value) => value + 1);
  };
  const updateElement = (elementId: string, patch: Partial<EditableElement>) => {
    updatePlan((current) => ({ ...current, elements: current.elements.map((element) => element.id === elementId ? { ...element, ...patch } as CreativeElement : element) }));
  };
  const renameElement = (elementId: string, nextId: string) => {
    setSelectedId(nextId);
    updateElement(elementId, { id: nextId });
  };
  const addElement = (type: ElementType) => {
    if (!formatSupports(type)) return;
    const id = nextId(plan.elements, type);
    const assetId = nextAssetId(type, id, assetTokens);
    const element = makeElement(type, id, assetId);
    updatePlan((current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(id);
  };
  const deleteElement = (elementId: string) => {
    updatePlan((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== elementId) }));
    setSelectedId(null);
  };
  const selectAssetFor = (elementId: string, assetId: string) => {
    updateElement(elementId, { assetId });
  };

  async function selectProduct(): Promise<void> {
    const result = await window.kbrDesktop.selectProductPng();
    if (result.status !== "SELECTED") { if (result.status === "ERROR") setNotice(result.message); return; }
    const assetId = "asset-primary";
    setAssetTokens((current) => ({ ...current, [assetId]: result.assetToken }));
    setAssetSelections((current) => ({ ...current, [assetId]: result }));
    const image = plan.elements.find((element): element is Extract<EditableElement, { type: "IMAGE" }> => element.type === "IMAGE");
    if (image) selectAssetFor(image.id, assetId);
    else {
      const id = nextId(plan.elements, "IMAGE");
      updatePlan((current) => ({ ...current, elements: [...current.elements, makeElement("IMAGE", id, assetId)] }));
      setSelectedId(id);
    }
    setNotice(`${result.displayName} · ${formatProductMetadata(result)}`);
  }

  async function selectLogo(): Promise<void> {
    const result = await window.kbrDesktop.selectLogoPng();
    if (result.status !== "SELECTED") { if (result.status === "ERROR") setNotice(result.message); return; }
    const assetId = "asset-logo";
    setAssetTokens((current) => ({ ...current, [assetId]: result.assetToken }));
    setAssetSelections((current) => ({ ...current, [assetId]: result }));
    const logo = plan.elements.find((element): element is Extract<EditableElement, { type: "LOGO" }> => element.type === "LOGO");
    if (logo) selectAssetFor(logo.id, assetId);
    else {
      const id = nextId(plan.elements, "LOGO");
      updatePlan((current) => ({ ...current, elements: [...current.elements, makeElement("LOGO", id, assetId)] }));
      setSelectedId(id);
    }
    setNotice(`${result.displayName} · 투명 PNG 로고`);
  }

  function inputForRender(): UiRenderInput | null {
    const firstToken = Object.values(assetTokens)[0] ?? "00000000-0000-4000-8000-000000000000";
    const freeform = {
      formatProfileId: profileId,
      creativeLayoutPlan: plan,
      assetTokens,
      outputFormat,
      ...(outputQuality !== undefined ? { outputQuality } : {}),
    } as const;
    return {
      assetToken: firstToken,
      advertiser: "FREEFORM",
      headline: "FREEFORM",
      subcopy: "FREEFORM",
      jobName,
      requestSequence,
      layoutMode: "FREEFORM",
      freeform,
    };
  }

  async function requestPreview(): Promise<void> {
    const input = inputForRender();
    if (!input) return;
    setValidating(true);
    setExported(null);
    try {
      const result = await window.kbrDesktop.requestPreview(input);
      setPreview(result);
      if (result.validationStatus === "ERROR" && result.eligibility?.previewAllowed) {
        setNotice("프리뷰는 생성되었습니다. 다만 최종 매체 규격을 통과하지 못해 Export가 차단되었습니다.");
      } else if (result.validationStatus === "ERROR") {
        setNotice("프리뷰를 생성할 수 없습니다. 렌더 전에 해결해야 하는 오류가 있습니다.");
      }
      else setNotice(result.validationStatus === "WARNING" ? "Core Preview PASS · 수동 검토 경고가 있습니다." : "Core Preview PASS");
    } catch (error) {
      setPreview(null);
      setNotice(error instanceof Error ? error.message : "Preview IPC 호출에 실패했습니다.");
    } finally { setValidating(false); }
  }

  async function selectOutputDirectory(): Promise<void> {
    const result = await window.kbrDesktop.selectOutputDirectory();
    if (result.status === "SELECTED") setOutput({ outputDirectoryToken: result.outputDirectoryToken, displayName: result.displayName });
    else if (result.status === "ERROR") setNotice(result.message);
  }

  async function exportRender(): Promise<void> {
    const input = inputForRender();
    if (!input || !preview?.previewToken || !output || !previewFresh) return;
    const { requestSequence: ignoredSequence, ...requestWithoutSequence } = input;
    void ignoredSequence;
    const request: ExportRequest = { ...requestWithoutSequence, previewToken: preview.previewToken, outputDirectoryToken: output.outputDirectoryToken };
    try {
      const result = await window.kbrDesktop.exportRender(request);
      if (result.status === "EXPORTED") {
        setExported(result);
        setNotice("PNG/JPEG와 manifest가 원자적으로 저장되었습니다.");
      } else setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export IPC 호출에 실패했습니다.");
    }
  }

  function importPlan(): void {
    try {
      const parsed = JSON.parse(planJson) as CreativeLayoutPlan;
      setPlan(parsed);
      setProfileId(parsed.formatProfileId);
      setSelectedId(parsed.elements[0]?.id ?? null);
      setPreview(null);
      setExported(null);
      setRequestSequence((value) => value + 1);
      setNotice("Plan JSON을 Import했습니다. Preview를 다시 실행하세요.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Plan JSON을 읽을 수 없습니다."); }
  }

  function copyPlan(): void {
    const value = JSON.stringify(plan, null, 2);
    setPlanJson(value);
    void navigator.clipboard?.writeText(value).then(() => setNotice("Plan JSON을 클립보드에 복사했습니다."));
  }

  function geometryFor(element: EditableElement): ReactElement {
    return <GeometryEditor element={element} onChange={(patch) => updateElement(element.id, patch)} />;
  }

  function applyPreset(
    element: Extract<EditableElement, { type: "IMAGE" }>,
    preset: ImagePlacementPreset,
  ): void {
    const selectedAsset = assetSelections[element.assetId];
    const selectedCanvas = profile?.formatProfileId === plan.formatProfileId ? profile.canvas : undefined;
    let next: Extract<EditableElement, { type: "IMAGE" }>;
    if (preset === "FILL_CANVAS") {
      if (!selectedAsset || !selectedCanvas) {
        setNotice("캔버스 채우기는 선택된 이미지의 실제 크기와 현재 고정 Canvas Profile이 필요합니다.");
        return;
      }
      next = applyImagePlacementPreset(element, preset, {
          source: { width: selectedAsset.width, height: selectedAsset.height },
          canvas: selectedCanvas,
        });
    } else {
      next = applyImagePlacementPreset(element, preset);
    }
    updateElement(element.id, { bounds: next.bounds, placement: next.placement });
    setNotice(preset === "FILL_CANVAS"
      ? "캔버스 채우기 배치를 Plan에 적용했습니다. Preview를 다시 실행하세요."
      : preset === "RESET_PLACEMENT"
        ? "이미지 배치를 전체 캔버스 맞춤 상태로 초기화했습니다."
        : "캔버스에 맞춤 배치를 Plan에 적용했습니다. Preview를 다시 실행하세요.");
  }

  if (channel === "NAVER" && !initialProfile) {
    return (
      <section className="freeform-lab" data-testid="freeform-editor">
        <div className="issue issue-error" data-testid="freeform-resolution-error">
          <strong>DESKTOP-CAPABILITY-004</strong>
          <p>선택한 NAVER FREEFORM Format Profile을 registry에서 찾을 수 없습니다. 다른 placement를 선택하세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="freeform-lab" data-testid="freeform-editor">
      <aside className="freeform-sidebar" aria-label="FREEFORM editor">
        <div className="section-heading"><div><h2>FREEFORM Format Lab</h2><p className="hint">Registry-driven Thin Client · Core Validator가 Source of Truth</p></div><span className="capability-pill">FREEFORM</span></div>
        <label className="field-group"><span className="field-label">Format</span><select data-testid="freeform-format-select" value={profileId} onChange={(event) => { const value = event.currentTarget.value; setProfileId(value); updatePlan((current) => ({ ...current, formatProfileId: value })); }}>
          {availableProfiles.map((entry) => <option key={entry.formatProfileId} value={entry.formatProfileId}>{entry.displayName ?? `${entry.formatProfileId} — ${entry.canvas.width}×${entry.canvas.height}`}</option>)}
          {availableCatalogOnlyProfiles.map((entry) => <option key={entry.formatProfileId} value={entry.formatProfileId} disabled data-testid="freeform-scroll-option">{entry.displayName ?? entry.formatProfileId} · 지원 예정</option>)}
        </select></label>
        {profile ? <div className="freeform-summary" data-testid="freeform-format-summary">
          <strong>{profile.displayName ?? profile.formatProfileId}</strong>
          <span>Canvas · {profile.canvas.width}×{profile.canvas.height}</span>
          <span>Renderer 출력 · {profile.canvas.width}×{profile.canvas.height} 고정</span>
          <span>Ratio · {profile.officialRatio ?? `${profile.canvas.width}:${profile.canvas.height}`}</span>
          <span>공식 Size Rule · {profile.officialSizeRule ?? "UNKNOWN"}</span>
          <span>Output · {(profile.allowedOutputFormats ?? []).join(", ") || "—"}</span>
          <span>Max bytes · {profile.outputConstraints?.maximumBytes ?? "—"}</span>
          <span>Opaque · {profile.outputConstraints?.requiresOpaqueOutput === true ? "REQUIRED" : profile.outputConstraints?.requiresOpaqueOutput === false ? "NOT REQUIRED" : "UNSPECIFIED"}</span>
          <span>Elements · {profile.elementConstraints ? [profile.elementConstraints.allowImage ? "IMAGE" : "", profile.elementConstraints.allowText ? "TEXT" : "", profile.elementConstraints.allowLogo ? "LOGO" : ""].filter(Boolean).join(", ") || "NONE" : "UNKNOWN"}</span>
          <span>Collection · {formatCollectionRule(profile)}</span>
          <span>Status · {profile.implementationStatus}</span>
        </div> : null}

        <div className="field-group"><span className="field-label">Background</span><div className="button-row"><button type="button" className={plan.background.type === "SOLID" ? "primary" : "secondary"} onClick={() => updatePlan((current) => ({ ...current, background: { type: "SOLID", color: current.background.type === "SOLID" ? current.background.color : "#FFFFFF" } }))} data-testid="freeform-background-solid">Solid</button><button type="button" className={plan.background.type === "TRANSPARENT" ? "primary" : "secondary"} onClick={() => updatePlan((current) => ({ ...current, background: { type: "TRANSPARENT" } }))} data-testid="freeform-background-transparent">Transparent</button></div>{plan.background.type === "SOLID" ? <input data-testid="freeform-background-color" value={plan.background.color} onChange={(event) => updatePlan((current) => ({ ...current, background: { type: "SOLID", color: event.currentTarget.value } }))} /> : null}{profile?.outputConstraints?.requiresOpaqueOutput === true && plan.background.type === "TRANSPARENT" ? <small className="hint status-error">Transparent는 Core Validator ERROR를 발생시킵니다. 자동 보정하지 않습니다.</small> : null}</div>

        <div className="field-group"><span className="field-label">Assets</span><div className="button-row"><button type="button" onClick={() => void selectProduct()} data-testid="freeform-select-image">Image 선택</button><button type="button" onClick={() => void selectLogo()} data-testid="freeform-select-logo">Logo PNG 선택</button></div>{Object.entries(assetSelections).map(([assetId, asset]) => <div className="asset-card" key={assetId}><strong>{assetId}</strong><span>{asset.displayName}</span><small>{formatProductMetadata(asset)}</small></div>)}</div>

        <section className="freeform-elements" aria-label="Elements"><div className="section-heading"><h3>Elements</h3><span className="hint">zIndex → array order</span></div><div className="button-row"><button type="button" onClick={() => addElement("IMAGE")} disabled={!formatSupports("IMAGE")} data-testid="freeform-add-image">+ Image</button><button type="button" onClick={() => addElement("TEXT")} disabled={!formatSupports("TEXT")} data-testid="freeform-add-text">+ Text</button><button type="button" onClick={() => addElement("LOGO")} disabled={!formatSupports("LOGO")} data-testid="freeform-add-logo">+ Logo</button><button type="button" disabled data-testid="freeform-add-shape">+ Shape · 준비 중</button></div>
          <div className="freeform-element-list">{plan.elements.map((element) => <button type="button" key={element.id} className={`freeform-element-row${selectedId === element.id ? " selected" : ""}`} onClick={() => setSelectedId(element.id)} data-testid={`freeform-element-${element.id}`}><span>{element.type}</span><strong>{element.id}</strong><small>z{element.zIndex}</small><em>{element.opacity ?? 1}</em></button>)}</div>
        </section>

        {selectedElement ? <section className="freeform-element-editor" aria-label={`${selectedElement.type} editor`} data-testid="freeform-element-editor"><div className="section-heading"><h3>{selectedElement.type} Editor</h3><button type="button" className="secondary" onClick={() => deleteElement(selectedElement.id)}>삭제</button></div><label className="field-group"><span className="field-label">Element ID</span><input value={selectedElement.id} onChange={(event) => renameElement(selectedElement.id, event.currentTarget.value)} /></label>
          {selectedElement.type === "IMAGE" ? <ImagePresetEditor
            sourceDimensions={assetSelections[selectedElement.assetId]}
            canvasDimensions={profile?.formatProfileId === plan.formatProfileId ? profile.canvas : undefined}
            onApply={(preset) => applyPreset(selectedElement, preset)}
          /> : null}
          {geometryFor(selectedElement)}
          {selectedElement.type === "IMAGE" ? <ImageEditor element={selectedElement} assetTokens={assetTokens} onChange={(patch) => updateElement(selectedElement.id, patch)} /> : null}
          {selectedElement.type === "LOGO" ? <LogoEditor element={selectedElement} assetTokens={assetTokens} onChange={(patch) => updateElement(selectedElement.id, patch)} /> : null}
          {selectedElement.type === "TEXT" ? <TextEditor element={selectedElement} onChange={(patch) => updateElement(selectedElement.id, patch)} /> : null}
        </section> : <p className="hint">Element를 추가하거나 목록에서 선택하세요.</p>}

        <label className="field-group"><span className="field-label">Output format</span><select data-testid="freeform-output-format" value={outputFormat} onChange={(event) => formatChanged(event.currentTarget.value as "PNG" | "JPEG")} >{allowedFormats.map((format) => <option key={format} value={format}>{format}</option>)}</select>{profile?.outputConstraints?.maximumBytes ? <small className="hint">Profile byte limit · {profile.outputConstraints.maximumBytes} bytes</small> : null}</label>
        {outputFormat === "JPEG" ? <label className="field-group"><span className="field-label">JPEG quality</span><select value={String(outputQuality)} onChange={(event) => { const value = event.currentTarget.value; setOutputQuality(value === "AUTO_FIT" ? "AUTO_FIT" : Number(value)); setPreview(null); setExported(null); setRequestSequence((current) => current + 1); }}><option value="AUTO_FIT">AUTO_FIT</option>{[92, 88, 84, 80, 76, 72, 68, 64].map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
        <label className="field-group"><span className="field-label">Job name</span><input value={jobName} onChange={(event) => { setJobName(event.currentTarget.value); setPreview(null); setExported(null); setRequestSequence((current) => current + 1); }} /></label>

        <div className="button-row"><button type="button" onClick={importPlan} data-testid="freeform-plan-import">Import Plan JSON</button><button type="button" className="secondary" onClick={() => setPlanJson(JSON.stringify(plan, null, 2))} data-testid="freeform-plan-export">Export Plan JSON</button><button type="button" className="secondary" onClick={copyPlan} data-testid="freeform-plan-copy">Copy Plan JSON</button></div>
        <textarea className="freeform-plan-json" value={planJson} onChange={(event) => setPlanJson(event.currentTarget.value)} rows={10} spellCheck={false} data-testid="freeform-plan-json" />
        {notice ? <small className="placement-plan-status" data-testid="freeform-notice">{notice}</small> : null}
      </aside>

      <section className="freeform-preview-panel" aria-label="FREEFORM Preview"><div className="section-heading"><div><h2>Preview</h2><p className="hint">{profile ? `${profile.canvas.width}×${profile.canvas.height} · UI scale only` : "Profile 선택"}</p></div><label className="guide-toggle"><input type="checkbox" checked={safeZoneVisible} onChange={() => setSafeZoneVisible((value) => !value)} data-testid="freeform-safe-zone-toggle" /> Safe Zone</label></div>
        <div className="freeform-canvas" data-testid="freeform-canvas" style={{ aspectRatio: profile ? `${profile.canvas.width} / ${profile.canvas.height}` : "1 / 1" }}><div className="freeform-canvas-label">{profile ? `${profile.canvas.width} × ${profile.canvas.height}` : "—"}</div>{previewAvailable && preview?.previewUrl ? <img src={preview.previewUrl} alt="FREEFORM Core Preview" data-preview-format={preview.previewArtifact?.format ?? preview.artifactFormat ?? outputFormat} data-preview-mime={preview.previewArtifact?.mimeType ?? ""} data-testid="freeform-preview-image" /> : <div className="preview-empty">{previewCurrent && preview?.validationStatus === "ERROR" ? "프리뷰를 생성할 수 없습니다." : "Render Preview를 실행하세요."}</div>}{safeZoneVisible && safeZone.insets ? <div className={`freeform-safe-zone safe-zone-${safeZone.classification.toLowerCase()}`} style={{ top: `${(safeZone.insets.top / (profile?.canvas.height || 1)) * 100}%`, right: `${(safeZone.insets.right / (profile?.canvas.width || 1)) * 100}%`, bottom: `${(safeZone.insets.bottom / (profile?.canvas.height || 1)) * 100}%`, left: `${(safeZone.insets.left / (profile?.canvas.width || 1)) * 100}%` }} data-testid="freeform-safe-zone-overlay" /> : safeZoneVisible ? <span className="freeform-safe-zone-unknown" data-testid="freeform-safe-zone-unknown">Safe Zone · {safeZone.classification} / MANUAL REVIEW</span> : null}</div>
        {previewCurrent && preview?.validationStatus === "ERROR" ? <p className="freeform-preview-eligibility status-error" data-testid="freeform-preview-eligibility">{previewAvailable ? "프리뷰는 생성되었습니다. 다만 최종 매체 규격을 통과하지 못했습니다." : "프리뷰를 생성할 수 없습니다. 렌더 전에 해결해야 하는 오류가 있습니다."}</p> : null}
        <div className="freeform-preview-actions"><button type="button" className="primary" onClick={() => void requestPreview()} disabled={validating || !profile || profile.implementationStatus !== "IMPLEMENTED"} data-testid="freeform-render-preview">{validating ? "Core Validator 실행 중…" : "Render Preview"}</button><button type="button" className="secondary" onClick={() => void selectOutputDirectory()} data-testid="freeform-select-output">출력 폴더 선택</button><button type="button" className="primary" onClick={() => void exportRender()} disabled={!previewFresh || !preview?.previewToken || !output} data-testid="freeform-export">{outputFormat} 및 Manifest 저장</button></div>
        <div className="freeform-output-summary"><span>상태</span><strong data-testid="freeform-status">{validating ? "VALIDATING" : previewCurrent ? (preview?.validationStatus ?? "PASS") : preview ? "STALE" : "DIRTY"}</strong><span>오류</span><strong>{preview?.errors.length ?? 0}</strong><span>경고</span><strong>{preview?.warnings.length ?? 0}</strong><span>Artifact</span><strong>{preview?.pngMetadata ? `${preview.pngMetadata.bytes} bytes · ${preview.artifactFormat ?? outputFormat}` : "—"}</strong>{preview?.outputEncoding && typeof preview.outputEncoding.qualityResolved === "number" ? <><span>JPEG quality</span><strong>{String(preview.outputEncoding.qualityResolved)}</strong></> : null}<span>Limit</span><strong>{profile?.outputConstraints?.maximumBytes ?? "—"}</strong></div>
        {output ? <p className="hint">출력 폴더 · {output.displayName}</p> : null}
        <div className="freeform-issues" data-testid="freeform-validation-panel"><h3>Core Validation</h3>{issues.length === 0 ? <p className="hint">Core 결과가 여기에 표시됩니다.</p> : issues.map((issue) => <article className={`issue issue-${issue.severity.toLowerCase()}`} key={`${issue.code}-${issue.path}-${issue.elementId ?? ""}`}><div><strong>{issue.severity}</strong><code>{issue.code}</code></div><p>{issueMessage(issue)}</p><small>stage · {issue.stage ?? "PRE_RENDER"} · elementId · {issue.elementId ?? "—"} · actual · {jsonValue(issue.actual)} · expected · {jsonValue(issue.expected)}</small><small>{issue.path}</small></article>)}</div>
        <div className="freeform-manual-review" data-testid="freeform-manual-review"><h3>Manual Review</h3>{profile?.safeZonePolicy && typeof profile.safeZonePolicy === "object" && JSON.stringify(profile.safeZonePolicy).includes("MANUAL_REVIEW_REQUIRED") ? <p>완성 이미지 안에 Bake된 텍스트/로고와 공식 좌표가 없는 가림 영역은 수동 검수가 필요합니다.</p> : null}{safeZone.classification === "UNKNOWN" ? <p>공식 Safe Zone geometry가 없어 자동으로 그리지 않습니다.</p> : null}{profile?.collectionRule ? <p>현재는 개별 이미지 1장을 제작합니다. 묶음/순서 관리 기능은 후속 단계에서 지원됩니다.</p> : null}{!profile?.safeZonePolicy && !profile?.collectionRule ? <p className="hint">수동 검토 항목 없음</p> : null}</div>
        {exported ? <div className="export-result" data-testid="freeform-export-result"><span>{exported.jobName}\{exported.artifactFileName ?? exported.pngFileName}</span><code>{exported.artifactDigest ?? exported.pngDigest}</code><button type="button" className="secondary" onClick={() => void window.kbrDesktop.revealExportedFile(exported.exportToken)}>폴더 열기</button></div> : null}
      </section>
    </section>
  );
}

function ImagePresetEditor({
  sourceDimensions,
  canvasDimensions,
  onApply,
}: {
  sourceDimensions: RasterDimensions | undefined;
  canvasDimensions: RasterDimensions | undefined;
  onApply: (preset: ImagePlacementPreset) => void;
}) {
  const fitDestination = sourceDimensions && canvasDimensions
    ? calculateContainedDestination(sourceDimensions, canvasDimensions)
    : null;
  const fillAvailable = Boolean(sourceDimensions && canvasDimensions);
  return (
    <div className="freeform-image-presets" data-testid="freeform-image-presets">
      <div className="section-heading">
        <h4>Image Preset</h4>
        <span className="hint">one-shot Plan edit</span>
      </div>
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          title="이미지 전체를 유지합니다. 원본과 캔버스 비율이 다르면 여백이 생길 수 있습니다."
          onClick={() => onApply("FIT_CANVAS")}
          data-testid="freeform-preset-fit-canvas"
        >캔버스에 맞춤</button>
        <button
          type="button"
          className="secondary"
          title="캔버스를 빈 공간 없이 채웁니다. 원본 비율을 유지하기 위해 일부 영역이 중앙 기준으로 잘릴 수 있습니다."
          disabled={!fillAvailable}
          onClick={() => onApply("FILL_CANVAS")}
          data-testid="freeform-preset-fill-canvas"
        >캔버스 채우기</button>
        <button
          type="button"
          className="secondary"
          title="이미지 배치를 전체 캔버스 맞춤 상태로 되돌립니다. zIndex와 opacity는 유지합니다."
          onClick={() => onApply("RESET_PLACEMENT")}
          data-testid="freeform-preset-reset-placement"
        >배치 초기화</button>
      </div>
      <small className="hint">맞춤은 원본 전체를 보존하고, 채우기는 실제 이미지 크기로 중앙 Crop을 Plan에 기록합니다.</small>
      {fitDestination && sourceDimensions && canvasDimensions ? <small className="hint" data-testid="freeform-fit-destination">
        맞춤 예상 · source {sourceDimensions.width}×{sourceDimensions.height} → destination {fitDestination.width}×{fitDestination.height} @ {fitDestination.x},{fitDestination.y} / canvas {canvasDimensions.width}×{canvasDimensions.height}
      </small> : <small className="hint">채우기를 사용하려면 먼저 IMAGE Asset을 선택하세요.</small>}
    </div>
  );
}

function ImageEditor({ element, assetTokens, onChange }: { element: Extract<EditableElement, { type: "IMAGE" }>; assetTokens: Readonly<Record<string, string>>; onChange: (patch: Partial<EditableElement>) => void }) {
  const placement = element.placement;
  const updatePlacement = (patch: Partial<ImagePlacementSpec>) => onChange({ placement: { ...placement, ...patch } });
  const updateCrop = (field: GeometryField, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const cropRect = placement.cropRect ?? { x: 0, y: 0, width: 1, height: 1 };
    updatePlacement({ cropRect: { ...cropRect, [field]: parsed } });
  };
  const adjustCrop = (field: GeometryField, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const step = event.altKey ? CROP_KEYBOARD_STEPS.alt : event.shiftKey ? CROP_KEYBOARD_STEPS.shift : CROP_KEYBOARD_STEPS.default;
    const delta = event.key === "ArrowUp" ? step : -step;
    const cropRect = placement.cropRect ?? { x: 0, y: 0, width: 1, height: 1 };
    updatePlacement({ cropRect: { ...cropRect, [field]: Number(cropRect[field]) + delta } });
  };
  return <div className="freeform-sub-editor"><label><span className="field-label">Asset</span><select value={element.assetId} onChange={(event) => onChange({ assetId: event.currentTarget.value })}><option value={element.assetId}>{assetTokens[element.assetId] ? `${element.assetId} · selected` : `${element.assetId} · missing`}</option>{Object.keys(assetTokens).filter((assetId) => assetId !== element.assetId).map((assetId) => <option key={assetId} value={assetId}>{assetId}</option>)}</select></label><label><span className="field-label">Policy</span><select data-testid="freeform-image-policy" value={placement.policy} onChange={(event) => { const policy = event.currentTarget.value as ImagePlacementSpec["policy"]; updatePlacement({ policy, fitMode: policy === "MANUAL_CROP" || policy === "SEMANTIC_CROP_COVER" ? "COVER" : "CONTAIN", source: "MANUAL", ...(policy === "MANUAL_CROP" ? { cropRect: placement.cropRect ?? { x: 0, y: 0, width: 1, height: 1 } } : {}) }); }}><option value="CENTER_CONTAIN">CENTER_CONTAIN</option><option value="ALPHA_TRIM_CONTAIN">ALPHA_TRIM_CONTAIN</option><option value="MANUAL_CROP">MANUAL_CROP</option><option value="SEMANTIC_CROP_COVER">SEMANTIC_CROP_COVER</option></select></label><label><span className="field-label">Anchor</span><select value={placement.anchor} onChange={(event) => updatePlacement({ anchor: event.currentTarget.value as ImagePlacementSpec["anchor"] })}><option value="CENTER">CENTER</option><option value="CENTER_LEFT">CENTER_LEFT</option><option value="CENTER_RIGHT">CENTER_RIGHT</option><option value="TOP_CENTER">TOP_CENTER</option><option value="BOTTOM_CENTER">BOTTOM_CENTER</option></select></label><label><span className="field-label">Subject Protection</span><select value={placement.subjectProtection} onChange={(event) => updatePlacement({ subjectProtection: event.currentTarget.value as ImagePlacementSpec["subjectProtection"] })}><option value="NONE">NONE</option><option value="PREFERRED">PREFERRED</option><option value="REQUIRED">REQUIRED</option></select></label>{placement.policy === "MANUAL_CROP" ? <div className="freeform-crop-fields"><span className="field-label">Crop Rect · decimal</span>{(["x", "y", "width", "height"] as const).map((field) => <label key={field}><span>{field}</span><input type="number" step="any" data-testid={`freeform-crop-${field}`} value={String(placement.cropRect?.[field] ?? (field === "width" || field === "height" ? 1 : 0))} onChange={(event) => updateCrop(field, event.currentTarget.value)} onKeyDown={(event) => adjustCrop(field, event)} /></label>)}</div> : <small className="hint">Crop Rect는 {placement.policy}에서 사용하지 않습니다.</small>}<label><span className="field-label">Crop Candidate</span><input value={placement.cropCandidateId ?? ""} onChange={(event) => updatePlacement({ cropCandidateId: event.currentTarget.value || undefined } as unknown as Partial<ImagePlacementSpec>)} placeholder="Core-resolved candidate id" /></label></div>;
}

function LogoEditor({ element, assetTokens, onChange }: { element: Extract<EditableElement, { type: "LOGO" }>; assetTokens: Readonly<Record<string, string>>; onChange: (patch: Partial<EditableElement>) => void }) {
  return <div className="freeform-sub-editor"><label><span className="field-label">Asset · transparent PNG</span><select value={element.assetId} onChange={(event) => onChange({ assetId: event.currentTarget.value })}><option value={element.assetId}>{assetTokens[element.assetId] ? `${element.assetId} · selected` : `${element.assetId} · missing`}</option>{Object.keys(assetTokens).filter((assetId) => assetId !== element.assetId).map((assetId) => <option key={assetId} value={assetId}>{assetId}</option>)}</select></label><small className="hint">Placement fixed · ALPHA_TRIM_CONTAIN · no crop · color restriction NONE</small></div>;
}

function TextEditor({ element, onChange }: { element: Extract<EditableElement, { type: "TEXT" }>; onChange: (patch: Partial<EditableElement>) => void }) {
  return <div className="freeform-sub-editor"><label><span className="field-label">Text</span><textarea value={element.text} onChange={(event) => onChange({ text: event.currentTarget.value })} rows={3} /></label><label><span className="field-label">Font · Registry only</span><select value={element.fontId} onChange={(event) => onChange({ fontId: event.currentTarget.value })}>{fontRegistry.entries.map((entry) => <option key={entry.fontId} value={entry.fontId}>{entry.fontId} · {entry.weight}</option>)}</select></label><div className="placement-grid"><label><span className="field-label">Font Size</span><input type="number" step="any" value={String(element.fontSizePx)} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) onChange({ fontSizePx: value }); }} /></label><label><span className="field-label">Line Height</span><input type="number" step="any" value={String(element.lineHeightPx)} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) onChange({ lineHeightPx: value }); }} /></label><label><span className="field-label">Letter Spacing</span><input type="number" step="any" value={String(element.letterSpacingPx ?? 0)} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isFinite(value)) onChange({ letterSpacingPx: value }); }} /></label><label><span className="field-label">Color</span><input value={element.color} onChange={(event) => onChange({ color: event.currentTarget.value })} /></label></div><div className="placement-grid"><label><span className="field-label">Text Align</span><select value={element.textAlign} onChange={(event) => onChange({ textAlign: event.currentTarget.value as Extract<EditableElement, { type: "TEXT" }>["textAlign"] })}><option>LEFT</option><option>CENTER</option><option>RIGHT</option></select></label><label><span className="field-label">Vertical Align</span><select value={element.verticalAlign} onChange={(event) => onChange({ verticalAlign: event.currentTarget.value as Extract<EditableElement, { type: "TEXT" }>["verticalAlign"] })}><option>TOP</option><option>CENTER</option><option>BOTTOM</option></select></label><label><span className="field-label">Wrap</span><select value={element.wrapMode} onChange={(event) => onChange({ wrapMode: event.currentTarget.value as Extract<EditableElement, { type: "TEXT" }>["wrapMode"] })}><option value="NO_WRAP">NO_WRAP</option><option value="EXPLICIT_NEWLINES">EXPLICIT_NEWLINES</option><option value="WORD_WRAP" disabled>WORD_WRAP · 준비 중</option></select></label><label><span className="field-label">Overflow</span><select value={element.overflowMode} onChange={(event) => onChange({ overflowMode: event.currentTarget.value as Extract<EditableElement, { type: "TEXT" }>["overflowMode"] })}><option>ERROR</option><option>CLIP</option></select></label></div></div>;
}
