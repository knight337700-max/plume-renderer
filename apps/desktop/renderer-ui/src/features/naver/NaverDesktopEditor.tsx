import { useEffect, useMemo, useState } from "react";

import type {
  NaverAssetRule,
  NaverCatalog,
  NaverCollectionItemRequest,
  NaverExportRequest,
  NaverExportResult,
  NaverFieldRule,
  NaverPlatformSourceRequest,
  NaverPreviewResult,
  NaverSmartChannelRequest,
  NaverTemplateOption,
  ProductSelectionResult,
} from "../../../../shared/src/index.js";
import { FreeformEditor } from "../freeform/FreeformEditor.js";
import { formatProductMetadata } from "../product-file/format.js";
import { issueMessage, localizedMessage } from "../validation/messages.js";
import { reportRendererDiagnostic, setRendererDiagnosticContext } from "../../diagnostics/renderer-diagnostics.js";

type SelectedProduct = Extract<ProductSelectionResult, { status: "SELECTED" }>;
type PlacementId = "NAVER_SMARTCHANNEL" | "NAVER_MOBILE_DA" | "NAVER_IMAGE_BANNER_1_1" | "NAVER_MOBILE_NATIVE" | "NAVER_PC_NATIVE" | "NAVER_SHOPPING_NEWS" | "NAVER_COMMUNICATION_AD" | "NAVER_MOBILE_DA_FEED";
const SMART_FILTER_KEYS = ["height", "family", "objectKind", "side", "textVariant", "affordance"] as const;
type SmartFilterKey = typeof SMART_FILTER_KEYS[number];
type SmartFilters = Record<SmartFilterKey, string>;

function smartFilterValue(template: NaverTemplateOption, key: SmartFilterKey): string {
  return key === "height" ? String(template.height) : template[key];
}

function uniqueSmartFilterValues(templates: readonly NaverTemplateOption[], key: SmartFilterKey): string[] {
  return Array.from(new Set(templates.map((entry) => smartFilterValue(entry, key))));
}

function filterSmartTemplates(templates: readonly NaverTemplateOption[], filters: SmartFilters): NaverTemplateOption[] {
  return templates.filter((entry) => SMART_FILTER_KEYS.every((key) => filters[key] === "ALL" || smartFilterValue(entry, key) === filters[key]));
}

function smartFilterOptions(templates: readonly NaverTemplateOption[], filters: SmartFilters, key: SmartFilterKey): string[] {
  const keyIndex = SMART_FILTER_KEYS.indexOf(key);
  const prefixCandidates = templates.filter((entry) => SMART_FILTER_KEYS.slice(0, keyIndex).every((prefixKey) => filters[prefixKey] === "ALL" || smartFilterValue(entry, prefixKey) === filters[prefixKey]));
  return uniqueSmartFilterValues(prefixCandidates, key);
}

function reconcileSmartFilters(templates: readonly NaverTemplateOption[], previous: SmartFilters, changedKey: SmartFilterKey, changedValue: string): SmartFilters {
  const next: SmartFilters = { ...previous, [changedKey]: changedValue };
  const changedIndex = SMART_FILTER_KEYS.indexOf(changedKey);
  const changedOptions = smartFilterOptions(templates, previous, changedKey);
  if (changedValue !== "ALL" && !changedOptions.includes(changedValue)) next[changedKey] = changedOptions[0] ?? "ALL";
  for (const key of SMART_FILTER_KEYS.slice(changedIndex + 1)) {
    const options = smartFilterOptions(templates, next, key);
    if (next[key] !== "ALL" && options.includes(next[key])) continue;
    next[key] = options[0] ?? "ALL";
  }
  return next;
}

const DEFAULT_TEXT: Record<string, string> = {
  headline: "브랜드의 새로운 시작",
  subcopy: "매일 더 나은 선택을 만나보세요",
  headlineLine2: "더 나은 내일",
  subcopyLine4: "지금 새로운 경험을 만나보세요",
  disclosureLine1: "심의필",
  disclosureLine2: "광고주 제공",
  ctaOption: "더 알아보기",
};

const DEFAULT_SOURCE_FIELDS: Record<string, unknown> = {
  advertiserName: "광고주",
  profileName: "브랜드",
  headline: "새로운 시작",
  description: "지금 확인해보세요",
  adDescription: "브랜드의 새로운 소식을 확인해보세요",
  adCopy: "매일 더 나은 선택을 만나보세요",
  itemDescription: "",
  landingButton: "NONE",
  landingUrl: "https://example.invalid/",
  notificationSubscriptionState: "NOT_SUBSCRIBED",
  adMute: true,
  presentationVariant: "GENERAL",
};

function sourcePlacement(id: PlacementId): NaverPlatformSourceRequest["placement"] {
  if (id === "NAVER_MOBILE_NATIVE") return "MOBILE_NATIVE";
  if (id === "NAVER_PC_NATIVE") return "PC_NATIVE";
  if (id === "NAVER_SHOPPING_NEWS") return "SHOPPING_NEWS";
  if (id === "NAVER_COMMUNICATION_AD") return "COMMUNICATION_AD";
  return "MOBILE_DA_FEED";
}

function initialItems() {
  return Array.from({ length: 4 }, (_, index) => ({
    id: "item-" + String(index + 1),
    description: "",
    landingUrl: "https://example.invalid/",
    assetToken: "",
  }));
}

function SourceField({ rule, value, onChange }: { rule: NaverFieldRule; value: unknown; onChange: (value: unknown) => void }) {
  if (rule.userEditable === false || rule.platformGenerated === true) {
    return <div className="source-field-readonly"><span>{rule.label || rule.id}</span><strong>{value === undefined ? "플랫폼 생성" : String(value)}</strong><small>PLATFORM_OWNED · 입력하지 않음</small></div>;
  }
  const allowed = rule.allowedValues ?? [];
  if (allowed.length > 0) {
    return <label className="field-group"><span className="field-label">{rule.label || rule.id}{rule.required === true ? " *" : ""}</span><select data-testid={"naver-source-field-" + rule.id} value={value === undefined ? "" : String(value)} onChange={(event) => onChange(event.currentTarget.value)}><option value="">선택</option>{allowed.map((entry) => <option key={String(entry)} value={String(entry)}>{String(entry)}</option>)}</select><small className="hint">{rule.sourceStatus || "SOURCE_BACKED"}</small></label>;
  }
  return <label className="field-group"><span className="field-label">{rule.label || rule.id}{rule.required === true ? " *" : ""}</span><input data-testid={"naver-source-field-" + rule.id} value={value === undefined ? "" : String(value)} maxLength={rule.maxLength ?? undefined} onChange={(event) => onChange(event.currentTarget.value)} /><small className="hint">{rule.sourceStatus || "SOURCE_BACKED"} · {rule.minLength ?? 0}..{rule.maxLength ?? "∞"}</small></label>;
}

export function NaverDesktopEditor() {
  const [catalog, setCatalog] = useState<NaverCatalog | null>(null);
  const [placementId, setPlacementId] = useState<PlacementId>("NAVER_SMARTCHANNEL");
  const [feedSubtype, setFeedSubtype] = useState<"IMAGE" | "COLLECTION" | "VIDEO">("IMAGE");
  const [communicationVariant, setCommunicationVariant] = useState<"LIST" | "COMMENT">("LIST");
  const [filters, setFilters] = useState<SmartFilters>({ height: "ALL", family: "ALL", objectKind: "ALL", side: "ALL", textVariant: "ALL", affordance: "ALL" });
  const [templateId, setTemplateId] = useState("");
  const [smartContent, setSmartContent] = useState<Record<string, string>>(() => ({ ...DEFAULT_TEXT }));
  const [fields, setFields] = useState<Record<string, unknown>>({ ...DEFAULT_SOURCE_FIELDS });
  const [primary, setPrimary] = useState<SelectedProduct | null>(null);
  const [secondary, setSecondary] = useState<SelectedProduct | null>(null);
  const [logo, setLogo] = useState<SelectedProduct | null>(null);
  const [sourceAssets, setSourceAssets] = useState<Record<string, SelectedProduct>>({});
  const [items, setItems] = useState(initialItems);
  const [jobName, setJobName] = useState("naver-render");
  const [preview, setPreview] = useState<NaverPreviewResult | null>(null);
  const [output, setOutput] = useState<{ outputDirectoryToken: string; displayName: string } | null>(null);
  const [exported, setExported] = useState<NaverExportResult | null>(null);
  const [sequence, setSequence] = useState(0);
  const [notice, setNotice] = useState("NAVER capability registry를 불러오는 중입니다.");
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    void window.kbrDesktop.getNaverCatalog().then((value) => {
      setCatalog(value);
      if (value.templates[0]) setTemplateId(value.templates[0].templateId);
      setNotice("Channel → Placement → Editor capability flow가 활성화되었습니다.");
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setCatalogError("DESKTOP-CAPABILITY-001 · NAVER capability registry를 불러오지 못했습니다.");
      setNotice("Registry 오류를 확인하고 다른 지면으로 이동하세요.");
      reportRendererDiagnostic({ kind: "window_error", name: "DESKTOP-CAPABILITY-001", message, ...(error instanceof Error && error.stack ? { stack: error.stack } : {}) });
    });
  }, []);

  const placements = catalog?.capabilities.find((entry) => entry.id === "NAVER")?.placements ?? [];
  const capability = placements.find((entry) => entry.id === placementId);
  const templates = catalog?.templates ?? [];
  const filteredTemplates = useMemo(() => filterSmartTemplates(templates, filters), [filters, templates]);
  const selectedTemplate = filteredTemplates.find((entry) => entry.templateId === templateId) ?? filteredTemplates[0];
  const resolvedTemplateId = selectedTemplate?.templateId ?? "";
  const sourceProfileId = placementId === "NAVER_COMMUNICATION_AD"
    ? communicationVariant === "LIST" ? "NAVER_COMMUNICATION_AD_LIST_SOURCE_V1" : "NAVER_COMMUNICATION_AD_COMMENT_SOURCE_V1"
    : placementId === "NAVER_MOBILE_DA_FEED"
      ? feedSubtype === "COLLECTION" ? "NAVER_FEED_COLLECTION_SOURCE_V1" : feedSubtype === "VIDEO" ? "NAVER_FEED_VIDEO_SOURCE_V1" : "NAVER_FEED_IMAGE_SOURCE_V1"
      : capability?.sourceProfileId || capability?.sourceProfileIds?.[0] || "";
  const sourceProfile = catalog?.sourceProfiles.find((entry) => entry.id === sourceProfileId);
  const smartFields = selectedTemplate?.textInputFields ?? [];
  const smartChannelUnresolved = placementId === "NAVER_SMARTCHANNEL" && templates.length > 0 && !selectedTemplate;
  const isSource = capability?.compositionMode === "PLATFORM_COMPOSED";
  const isCollection = placementId === "NAVER_MOBILE_DA_FEED" && isSource && feedSubtype === "COLLECTION";
  const isFreeformPlacement = placementId === "NAVER_MOBILE_DA" || placementId === "NAVER_IMAGE_BANNER_1_1";
  const placementSelector = <label className="field-group"><span className="field-label">Placement</span><select data-testid="naver-placement-select" value={placementId} onChange={(event) => { setPlacementId(event.currentTarget.value as PlacementId); invalidate(); }}>{placements.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>;

  useEffect(() => {
    setRendererDiagnosticContext({
      channel: "NAVER",
      placement: placementId,
      ...(placementId === "NAVER_MOBILE_DA_FEED" ? { subtype: feedSubtype } : {}),
      ...(placementId === "NAVER_SMARTCHANNEL" && selectedTemplate ? {
        templateId: selectedTemplate.templateId,
        selectedDimensions: {
          height: selectedTemplate.height,
          family: selectedTemplate.family,
          objectKind: selectedTemplate.objectKind,
          side: selectedTemplate.side,
          textVariant: selectedTemplate.textVariant,
          affordance: selectedTemplate.affordance,
        },
      } : {}),
    });
  }, [feedSubtype, placementId, resolvedTemplateId]);

  useEffect(() => {
    if (resolvedTemplateId !== templateId) setTemplateId(resolvedTemplateId);
  }, [resolvedTemplateId, templateId]);

  function updateSmartFilter(key: SmartFilterKey, value: string): void {
    const nextFilters = reconcileSmartFilters(templates, filters, key, value);
    const nextTemplates = filterSmartTemplates(templates, nextFilters);
    setFilters(nextFilters);
    setTemplateId(nextTemplates[0]?.templateId ?? "");
    invalidate();
  }

  function invalidate() {
    setPreview(null);
    setExported(null);
    setSequence((value) => value + 1);
  }

  async function selectPrimary() {
    const result = await window.kbrDesktop.selectProductPng();
    if (result.status === "SELECTED") {
      setPrimary(result);
      const firstRule = sourceProfile?.assets[0];
      if (firstRule) setSourceAssets((previous) => ({ ...previous, [firstRule.id]: result }));
      if (!isCollection) setItems((previous) => previous.map((item) => ({ ...item, assetToken: item.assetToken || result.assetToken })));
      invalidate();
    } else if (result.status === "ERROR") setNotice(result.code + ": " + result.message);
  }

  async function selectSecondary(targetItemId?: string) {
    const result = await window.kbrDesktop.selectSecondaryProductPng();
    if (result.status === "SELECTED") {
      setSecondary(result);
      const secondRule = sourceProfile?.assets[1];
      if (secondRule) setSourceAssets((previous) => ({ ...previous, [secondRule.id]: result }));
      if (targetItemId) setItems((previous) => previous.map((item) => item.id === targetItemId ? { ...item, assetToken: result.assetToken } : item));
      else if (isCollection) setItems((previous) => previous.map((item) => ({ ...item, assetToken: result.assetToken })));
      invalidate();
    } else if (result.status === "ERROR") setNotice(result.code + ": " + result.message);
  }

  async function selectTertiarySourceAsset() {
    const result = await window.kbrDesktop.selectTertiaryProductImage();
    if (result.status === "SELECTED") {
      setLogo(result);
      const rule = sourceProfile?.assets[2] || sourceProfile?.assets[1];
      if (rule) setSourceAssets((previous) => ({ ...previous, [rule.id]: result }));
      invalidate();
    } else if (result.status === "ERROR") setNotice(result.code + ": " + result.message);
  }

  async function selectLogo() {
    const result = await window.kbrDesktop.selectLogoPng();
    if (result.status === "SELECTED") {
      setLogo(result);
      invalidate();
    } else if (result.status === "ERROR") setNotice(result.code + ": " + result.message);
  }

  function ruleAsset(rule: NaverAssetRule, index: number): SelectedProduct | null {
    return sourceAssets[rule.id] || (index === 0 ? primary : index === 1 ? secondary || primary : logo || secondary || primary);
  }

  function buildSourceRequest(): NaverPlatformSourceRequest | null {
    if (!sourceProfile || !primary) return null;
    const requiredRules = sourceProfile.assets.filter((rule) => rule.required === true && !(isCollection && rule.assetRole === "collectionItemImage"));
    const assets = requiredRules.map((rule, index) => {
      const selected = ruleAsset(rule, index);
      return selected ? { assetId: rule.id, assetRole: rule.assetRole, sourceProfileId: rule.id, assetToken: selected.assetToken } : null;
    }).filter((entry): entry is NaverPlatformSourceRequest["assets"][number] => Boolean(entry));
    if (assets.length !== requiredRules.length) return null;
    const allowedFieldIds = new Set(sourceProfile.fields.map((rule) => rule.id));
    const normalizedFields = Object.fromEntries(Object.entries(fields).filter(([key]) => allowedFieldIds.has(key)));
    const collectionItems: NaverCollectionItemRequest[] | undefined = isCollection
      ? items.map((item) => ({ id: item.id, assetId: "collection-" + item.id, sourceProfileId: "NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600", assetToken: item.assetToken || secondary?.assetToken || primary.assetToken, fields: { itemDescription: item.description, landingUrl: item.landingUrl } }))
      : undefined;
    if (collectionItems) for (const item of collectionItems) assets.push({ assetId: item.assetId, assetRole: "collectionItemImage", sourceProfileId: item.sourceProfileId, assetToken: item.assetToken });
    return { kind: "PLATFORM_SOURCE", placement: sourcePlacement(placementId), sourceProfileId, fields: normalizedFields, assets, ...(collectionItems ? { collectionItems } : {}), jobName };
  }

  async function requestPreview() {
    if (placementId === "NAVER_MOBILE_DA" || placementId === "NAVER_IMAGE_BANNER_1_1") return;
    if (feedSubtype === "VIDEO") {
      setNotice("VIDEO는 Out of static renderer scope이며 runtime을 호출하지 않습니다.");
      return;
    }
    const request: NaverSmartChannelRequest | NaverPlatformSourceRequest | null = placementId === "NAVER_SMARTCHANNEL"
      ? { kind: "SMARTCHANNEL", templateId: resolvedTemplateId, content: Object.fromEntries(smartFields.map((field) => [field.key, smartContent[field.key] ?? ""])), objectAssetToken: primary?.assetToken || "", ...(logo ? { advertiserLogoAssetToken: logo.assetToken } : {}), jobName }
      : buildSourceRequest();
    if (!request || !primary) {
      setNotice(!primary ? "필수 asset과 source field를 먼저 준비하세요. (Primary asset 필요)" : "필수 asset과 source field를 먼저 준비하세요. (Source profile/asset rule 확인 필요)");
      return;
    }
    const result = await window.kbrDesktop.requestNaverPreview({ requestSequence: sequence + 1, request });
    setPreview(result);
    setNotice(result.validationStatus === "ERROR" ? "검증 오류를 수정한 뒤 다시 Preview하세요." : result.finalUiRendered ? "최종 UI가 생성되었습니다." : "최종 노출 형상은 NAVER가 구성합니다. 이 앱은 등록용 소스와 필드를 검증/준비합니다.");
  }

  async function selectOutput() {
    const result = await window.kbrDesktop.selectOutputDirectory();
    if (result.status === "SELECTED") setOutput({ outputDirectoryToken: result.outputDirectoryToken, displayName: result.displayName });
  }

  async function exportNaver() {
    if (!preview || preview.validationStatus === "ERROR" || !output) return;
    const request: NaverSmartChannelRequest | NaverPlatformSourceRequest | null = placementId === "NAVER_SMARTCHANNEL"
      ? { kind: "SMARTCHANNEL", templateId: resolvedTemplateId, content: Object.fromEntries(smartFields.map((field) => [field.key, smartContent[field.key] ?? ""])), objectAssetToken: primary?.assetToken || "", ...(logo ? { advertiserLogoAssetToken: logo.assetToken } : {}), jobName }
      : buildSourceRequest();
    if (!request) return;
    const exportRequest: NaverExportRequest = {
      request,
      outputDirectoryToken: output.outputDirectoryToken,
      ...(preview.requestFingerprint ? { previewFingerprint: preview.requestFingerprint } : {}),
      ...(preview.previewToken ? { previewToken: preview.previewToken } : {}),
    };
    const result = await window.kbrDesktop.exportNaver(exportRequest);
    setExported(result);
    if (result.status === "EXPORTED") setNotice("검증된 산출물을 atomic publish했습니다.");
  }

  function moveItem(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const moved = next.splice(index, 1)[0];
    if (!moved) return;
    next.splice(target, 0, moved);
    setItems(next);
    invalidate();
  }

  if (!catalog) return <section className="naver-lab" data-testid="naver-editor"><p className="hint">{catalogError ?? notice}</p>{catalogError ? <div className="issue issue-error" data-testid="naver-resolution-error"><strong>DESKTOP-CAPABILITY-001</strong><p>Canonical capability registry를 읽지 못했습니다. 기존 KAKAO/NAVER 탐색은 계속 사용할 수 있습니다.</p></div> : null}</section>;
  if (!capability) return <section className="naver-lab" data-testid="naver-editor">{placementSelector}<div className="issue issue-error" data-testid="naver-resolution-error"><strong>DESKTOP-CAPABILITY-002</strong><p>선택한 NAVER placement가 registry에 없습니다. 다른 placement를 선택하세요.</p></div></section>;
  if (isSource && !sourceProfile) return <section className="naver-lab" data-testid="naver-editor">{placementSelector}<div className="issue issue-error" data-testid="naver-resolution-error"><strong>DESKTOP-CAPABILITY-003</strong><p>선택한 placement의 Source Profile을 확인할 수 없습니다. 임의 profile fallback은 사용하지 않습니다.</p></div></section>;
  if (placementId === "NAVER_MOBILE_DA" || placementId === "NAVER_IMAGE_BANNER_1_1") {
    return <section className="naver-lab naver-freeform-shell" data-testid="naver-editor" data-primary-selected={primary ? "true" : "false"}>
      <div className="naver-navigation-card"><div className="section-heading"><div><p className="eyebrow naver-eyebrow">NAVER DESKTOP</p><h2>Placement Editor</h2><p className="hint">Registry / Source of Truth · Channel → Placement</p></div><span className="capability-pill">{capability?.label || placementId}</span></div>{placementSelector}</div>
      <div data-testid="naver-freeform-editor"><FreeformEditor key={placementId} channel="NAVER" initialProfileId={placementId} /></div>
    </section>;
  }

  const sourceFields = sourceProfile?.fields ?? [];
  const assetRules = sourceProfile?.assets.filter((rule) => rule.required === true) ?? [];
  const issues = [...(preview?.errors ?? []), ...(preview?.warnings ?? [])];

  return (
    <section className="naver-lab" data-testid="naver-editor" data-primary-selected={primary ? "true" : "false"}>
      <aside className="naver-sidebar" aria-label="NAVER editor">
        <div className="section-heading"><div><p className="eyebrow naver-eyebrow">NAVER DESKTOP</p><h2>Placement Editor</h2><p className="hint">Registry / Source of Truth · Runtime network 0</p></div><span className="capability-pill">{capability?.compositionMode}</span></div>
        {placementSelector}
        {placementId === "NAVER_MOBILE_DA_FEED" ? <label className="field-group"><span className="field-label">Feed subtype</span><select data-testid="naver-feed-subtype" value={feedSubtype} onChange={(event) => { setFeedSubtype(event.currentTarget.value as typeof feedSubtype); invalidate(); }}><option value="IMAGE">IMAGE</option><option value="COLLECTION">COLLECTION</option><option value="VIDEO" disabled>VIDEO · Out of static renderer scope</option></select></label> : null}
        {placementId === "NAVER_COMMUNICATION_AD" ? <label className="field-group"><span className="field-label">Communication variant</span><select data-testid="naver-communication-variant" value={communicationVariant} onChange={(event) => { setCommunicationVariant(event.currentTarget.value as typeof communicationVariant); invalidate(); }}><option value="LIST">LIST</option><option value="COMMENT">COMMENT</option></select></label> : null}

        {placementId === "NAVER_SMARTCHANNEL" ? <section className="naver-card" data-testid="naver-smartchannel-editor">
          <div className="section-heading"><h3>SmartChannel · 120 whitelisted templates</h3><span className="capability-pill">TEMPLATE_LOCKED</span></div>
          <div className="naver-filter-grid">{SMART_FILTER_KEYS.map((key) => { const values = smartFilterOptions(templates, filters, key); return <label key={key}><span>{key}</span><select data-testid={"naver-template-filter-" + key} value={filters[key]} onChange={(event) => { const nextValue = event.currentTarget.value; updateSmartFilter(key, nextValue); }}><option value="ALL">ALL</option>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>; })}</div>
          <label className="field-group"><span className="field-label">Template whitelist</span><select data-testid="naver-smartchannel-template-select" value={resolvedTemplateId} onChange={(event) => { const nextTemplateId = event.currentTarget.value; setTemplateId(nextTemplateId); invalidate(); }}>{filteredTemplates.map((entry) => <option key={entry.templateId} value={entry.templateId}>{entry.height}px · {entry.family} · {entry.objectKind} · {entry.side} · {entry.textVariant} · {entry.affordance}</option>)}</select></label>
          <div className="naver-template-summary" data-testid="naver-template-summary"><strong>{selectedTemplate?.templateId || "—"}</strong><span>Object token · {selectedTemplate?.objectPlacementToken || "—"}</span><span>Source whitelist only · Cartesian product 금지</span></div>
          {smartChannelUnresolved ? <div className="issue issue-error" data-testid="naver-smartchannel-resolution-error"><strong>SmartChannel selection unresolved</strong><p>현재 필터 조합에 대응하는 source-backed template이 없습니다. 필터를 다시 선택하세요. Render/Download는 차단됩니다.</p></div> : null}
          {smartFields.map((field) => <label className="field-group" key={field.key} data-smartchannel-input-key={field.key} data-smartchannel-role={field.role}><span className="field-label">{localizedMessage(field.labelKey)}</span><input data-testid={"naver-smartchannel-field-" + field.key} value={smartContent[field.key] ?? ""} onChange={(event) => { const nextValue = event.currentTarget.value; setSmartContent((previous) => ({ ...previous, [field.key]: nextValue })); invalidate(); }} /></label>)}
          <div className="asset-card"><strong>Object image</strong>{primary ? <><span>{primary.displayName}</span><small>{formatProductMetadata(primary)}</small></> : <span>선택하지 않음</span>}<button type="button" onClick={() => void selectPrimary()} data-testid="naver-smartchannel-select-object">Object 선택</button></div>
          <div className="asset-card"><strong>Advertiser logo · optional</strong>{logo ? <span>{logo.displayName}</span> : <span>선택하지 않음</span>}<button type="button" className="secondary" onClick={() => void selectLogo()} data-testid="naver-smartchannel-select-logo">Logo 선택</button></div>
          <div className="font-preflight" data-testid="naver-smartchannel-font-preflight"><strong>SmartChannel renderer-owned PSD-exact font preflight</strong><span>Renderer resource provider · OS/system font lookup 없음</span>{catalog.fontPreflight.requiredAssets.map((font) => <small key={font.token}>{font.token} · {font.expectedFilename} · {font.expectedSha256 || "SHA unresolved"}</small>)}<small>필수 바이너리의 SHA/identity/glyph 검증 실패 시 SmartChannel render/download는 차단됩니다.</small></div>
        </section> : null}

        {isSource ? <section className="naver-card" data-testid="naver-platform-source-editor">
          <div className="section-heading"><h3>Source Input</h3><span className="capability-pill">PLATFORM_COMPOSED</span></div>
          <p className="source-owner-note">최종 노출 형상은 NAVER가 구성합니다.<br />이 앱은 등록용 소스와 필드를 검증/준비합니다.</p>
          {sourceFields.map((rule) => <SourceField key={rule.id} rule={rule} value={fields[rule.id]} onChange={(value) => { setFields((previous) => ({ ...previous, [rule.id]: value })); invalidate(); }} />)}
          <div className="naver-assets" data-testid="naver-source-assets"><h4>Source assets</h4><p className="hint">원본 canvas / MIME / safe area만 검사합니다. 자동 crop·최종 UI 합성 없음.</p>{assetRules.map((rule, index) => { const selected = ruleAsset(rule, index); return <div className="asset-card" key={rule.id} data-testid={"naver-source-asset-" + rule.id}><strong>{rule.assetRole} · {rule.id}</strong><span>{selected ? selected.displayName + " · " + selected.width + "×" + selected.height : "Asset 없음"}</span><button type="button" onClick={() => index === 0 ? void selectPrimary() : index === 1 ? void selectSecondary() : void selectTertiarySourceAsset()}>{index === 0 ? "Primary 선택" : index === 1 ? "Secondary 선택" : "Third asset 선택"}</button><small>{(rule.mime || []).join(", ") || "MIME source rule"} · canvas {String(rule.canvas?.width || "—")}×{String(rule.canvas?.height || "—")}</small></div>; })}</div>
          {isCollection ? <section className="collection-editor" data-testid="naver-collection-editor"><div className="section-heading"><h4>Collection items · {items.length}/10</h4><button type="button" className="secondary" onClick={() => { if (items.length < 10) { setItems((previous) => [...previous, { id: "item-" + String(previous.length + 1), description: "", landingUrl: "https://example.invalid/", assetToken: secondary?.assetToken || "" }]); invalidate(); } }} disabled={items.length >= 10} data-testid="naver-collection-add">Add Item</button></div><p className="hint">4..10 ordered items · nested collection unsupported · item checksum은 유지됩니다. 각 item은 별도 선택하거나 Secondary asset을 재사용합니다.</p>{items.map((item, index) => <article className="collection-item-card" key={item.id} data-testid={"naver-collection-item-" + item.id}><div className="section-heading"><strong>{String(index + 1) + ". " + item.id}</strong><div className="button-row"><button type="button" className="secondary" onClick={() => moveItem(index, -1)} disabled={index === 0}>↑</button><button type="button" className="secondary" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>↓</button><button type="button" className="secondary" onClick={() => { if (items.length > 4) { setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); invalidate(); } }} disabled={items.length <= 4}>Remove</button></div></div><label><span>landingUrl</span><input value={item.landingUrl} onChange={(event) => { const value = event.currentTarget.value; setItems((previous) => previous.map((candidate) => candidate.id === item.id ? { ...candidate, landingUrl: value } : candidate)); invalidate(); }} data-testid={"naver-collection-" + item.id + "-landing-url"} /></label><label><span>itemDescription ≤28</span><input maxLength={28} value={item.description} onChange={(event) => { const value = event.currentTarget.value; setItems((previous) => previous.map((candidate) => candidate.id === item.id ? { ...candidate, description: value } : candidate)); invalidate(); }} data-testid={"naver-collection-" + item.id + "-description"} /></label><div className="button-row"><button type="button" className="secondary" onClick={() => void selectSecondary(item.id)} data-testid={"naver-collection-" + item.id + "-select-asset"}>Item asset 선택</button></div><small>Asset · {item.assetToken ? "selected / reusable" : "Secondary 선택 후 재사용"}</small></article>)}</section> : null}
        </section> : null}

        <label className="field-group"><span className="field-label">Job name</span><input data-testid="naver-job-name" value={jobName} onChange={(event) => { setJobName(event.currentTarget.value); invalidate(); }} /></label>
        <div className="button-row"><button type="button" className="primary" onClick={() => void requestPreview()} disabled={isFreeformPlacement || feedSubtype === "VIDEO" || smartChannelUnresolved} data-testid="naver-request-preview">Preview / Validate</button><button type="button" className="secondary" onClick={() => void selectOutput()} data-testid="naver-select-output">출력 폴더 선택</button><button type="button" className="primary" onClick={() => void exportNaver()} disabled={!preview || preview.validationStatus === "ERROR" || !output} data-testid="naver-export">{isCollection ? "Source artifacts + Manifest export" : "Source/PNG export"}</button></div>
        <small className="placement-plan-status" data-testid="naver-notice">{notice}</small>
      </aside>

      <section className="naver-preview-panel" aria-label="NAVER Preview">
        <div className="section-heading"><div><h2>Preview / Validation</h2><p className="hint">{capability?.compositionMode === "PLATFORM_COMPOSED" ? "Final pixel geometry is NAVER-owned." : "Renderer-composed artifact preview"}</p></div><span data-testid="naver-validation-status" className={"status-pill status-" + (preview?.validationStatus?.toLowerCase() || "dirty")}>{preview?.validationStatus || "DIRTY"}</span></div>
        {preview?.previewUrl ? <div className="naver-render-preview" data-testid="naver-render-preview"><img src={preview.previewUrl} alt="NAVER Renderer Preview" data-testid="naver-preview-image" /></div> : null}
        {isSource ? <div className="normalized-payload" data-testid="naver-normalized-payload"><strong>Normalized Source Payload · finalUiRendered=false</strong><pre>{preview?.normalizedPayload ? JSON.stringify(preview.normalizedPayload, null, 2) : "Source Preview를 실행하면 normalized payload가 표시됩니다."}</pre></div> : null}
        {feedSubtype === "VIDEO" ? <div className="scope-blocked" data-testid="naver-video-disabled">VIDEO · Out of static renderer scope · runtime 구현 금지</div> : null}
        <div className="validation-summary"><div><span>Errors</span><strong>{preview?.errors.length || 0}</strong></div><div><span>Warnings</span><strong>{preview?.warnings.length || 0}</strong></div><div><span>Final UI</span><strong>{preview?.finalUiRendered === false ? "NOT_RENDERED" : "—"}</strong></div><div><span>Fingerprint</span><strong>{preview?.requestFingerprint?.slice(0, 12) || "—"}</strong></div></div>
        <div className="issue-list" data-testid="naver-validation-panel">{issues.length === 0 ? <p className="hint">표시할 validation issue가 없습니다.</p> : issues.map((issue) => <article className={"issue issue-" + issue.severity.toLowerCase()} key={issue.code + "-" + issue.path}><div><strong>{issue.severity}</strong><code>{issue.code}</code></div><p>{issueMessage(issue)}</p><small>{issue.path}</small><small>provenance · {issue.code.startsWith("KBR-NAVER-SOURCE") ? "OFFICIAL_NAVER_RULE" : "PROJECT_RUNTIME_RULE"}</small></article>)}</div>
        {exported?.status === "EXPORTED" ? <div className="export-result" data-testid="naver-export-result"><strong>{exported.mode}</strong><code>{exported.artifactFileNames.join(", ")}</code></div> : exported?.status === "BLOCKED" || exported?.status === "ERROR" ? <div className="issue issue-error" data-testid="naver-export-error"><strong>{exported.code}</strong><p>{exported.message}</p></div> : null}
      </section>
    </section>
  );
}
