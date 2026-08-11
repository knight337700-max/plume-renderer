export {
  assertDownloadAllowed,
  createKakaoBizboardRenderer,
  readRenderedManifest,
  rendererVersion,
} from "./renderer.js";
export {
  isSmartChannelRenderRequest,
  renderSmartChannel,
  NAVER_SMARTCHANNEL_CANVAS_WIDTH,
  NAVER_SMARTCHANNEL_FORMAT_PROFILE_ID,
  NAVER_SMARTCHANNEL_HEIGHTS,
  NAVER_SMARTCHANNEL_OBJECT_MAX_WIDTH,
  NAVER_SMARTCHANNEL_OBJECT_MAX_HEIGHT,
  NAVER_SMARTCHANNEL_OBJECT_MAX_OPAQUE_PIXELS,
  NAVER_SMARTCHANNEL_TRIM_PRESERVE_THRESHOLD,
  NAVER_SMARTCHANNEL_LAYOUT_VISIBLE_THRESHOLD,
  normalizeSmartChannelObject,
} from "./naver-smartchannel.js";
export type {
  DecodedRgba,
  SmartChannelObjectDiagnostics,
  SmartChannelObjectNormalizationOptions,
  SmartChannelRenderOptions,
  SmartChannelRenderRequest,
  SmartChannelRenderResult,
} from "./naver-smartchannel.js";
export {
  freeformResponseFromResult,
  isFreeformRenderRequest,
  normalizedRectToPixelRect,
  renderFreeform,
  toFreeformRenderResponse,
} from "./freeform.js";
export { applyDefaults, normalizeInput } from "./normalize.js";
export { canonicalDigest, canonicalJson } from "./canonical.js";
export { calculateLayout } from "./layout.js";
export { analyzeAndResizeProduct } from "./product-image.js";
export {
  detectImageMimeFromBytes,
  ImageInputError,
  inspectImageBytes,
  inspectImageFile,
  mimeForImageExtension,
  SUPPORTED_INPUT_MIME_TYPES,
} from "./image-input.js";
export type { ImageInputErrorCode, ImageInputMetadata, InspectedImage, SupportedInputMimeType } from "./image-input.js";
export { encodeFreeformArtifact, hasOpaquePixels, inspectPngIhdr, inspectRenderedArtifact, renderRgbaPng, validateRenderedPng } from "./raster.js";
export {
  validateFreeformAppliedElements,
  validateFreeformPostRender,
  validateFreeformPreRender,
  validationIssuesHaveStage,
} from "./freeform-validator.js";
export type {
  FreeformAssetValidationMetadata,
  FreeformPostRenderValidationOptions,
  FreeformPreRenderValidationOptions,
} from "./freeform-validator.js";
export {
  renderThumbnailBoxRight,
  THUMBNAIL_BOX_RIGHT_RADIUS,
  THUMBNAIL_BOX_RIGHT_SLOT,
} from "./thumbnail-box-right.js";
export {
  renderThumbnailMultiRight,
  THUMBNAIL_MULTI_RIGHT_RADIUS,
  THUMBNAIL_MULTI_RIGHT_SLOTS,
} from "./thumbnail-multi-right.js";
export {
  renderMaskSemicircleRight,
  MASK_SEMICIRCLE_RIGHT_IMAGE_DESTINATION,
  MASK_SEMICIRCLE_RIGHT_LOGO_CONTAINER,
  MASK_SEMICIRCLE_RIGHT_LOGO_SAFE_BOX,
  MASK_SEMICIRCLE_RIGHT_TEXT_HARD_RIGHT_EDGE,
  MASK_SEMICIRCLE_RIGHT_TEXT_MAX_WIDTH,
  MASK_SEMICIRCLE_RIGHT_TEXT_WARNING_WIDTH,
  MASK_SEMICIRCLE_RIGHT_MAX_UPSCALE,
} from "./mask-semicircle-right.js";
export { loadContracts } from "./contracts.js";
export { SchemaValidators, parseJsonInput } from "./schema-validation.js";
export { validateCanonicalSemantics, validateRawText } from "./semantic-validation.js";
export {
  createTextLimitMetrics,
  graphemeCountIncludingSpaces,
  hasConsecutiveSpaces,
  koreanEquivalentUnits,
  segmentGraphemes,
  TEXT_CONTRACT,
  textMaximumUnits,
  textWidthStatus,
} from "./text-contract.js";
export { resolveTrustedInputFile, resolveTrustedJobDirectory, resolveTrustedRoot } from "./path-security.js";
export {
  assertSmartChannelFallbackProhibited,
  createSmartChannelFontResourceProvider,
  evaluateFontIdentity,
  inspectFontGlyphCoverage,
  inspectFontIdentity,
  preflightResolvedExactFont,
  isTrustedFontReference,
  NAVER_SMARTCHANNEL_FONT_ERROR_CODES,
  preflightExternalExactFont,
} from "./naver-smartchannel-font-preflight.js";
export {
  NAVER_PLATFORM_SOURCE_SCHEMA_VERSION,
  NAVER_PLATFORM_SOURCE_PREVIOUS_SCHEMA_VERSION,
  materializePlatformComposedProfile,
  normalizePlatformComposedSource,
  platformComposedSourceHasFinalPixelOutput,
  validatePlatformComposedSource,
} from "./naver-platform-composed.js";
export type {
  PlatformComposedProfile,
  PlatformComposedSourceSpec,
  PlatformCollectionItem,
  PlatformSourceAsset,
  PlatformSourceAssetRule,
  PlatformSourceFieldRule,
  PlatformSourceValidationIssue,
  PlatformSourceValidationResult,
} from "./naver-platform-composed.js";
export {
  isNaverFeedCollectionRenderRequest,
  renderNaverFeedCollection,
  NAVER_FEED_COLLECTION_CONTRACT,
} from "./naver-collection.js";
export type {
  NaverCollectionItemArtifact,
  NaverFeedCollectionManifest,
  NaverFeedCollectionRenderOptions,
  NaverFeedCollectionRenderRequest,
  NaverFeedCollectionRenderResult,
} from "./naver-collection.js";
export type {
  ExternalExactFontResource,
  FontPreflightIssue,
  FontPreflightResult,
  FontGlyphCoverage,
  NaverSmartChannelFontErrorCode,
  ParsedFontIdentity,
  SmartChannelFontRequirement,
  SmartChannelFontResolutionMode,
  SmartChannelFontResourceProvider,
  SmartChannelFontResourceRequest,
  SmartChannelFontResourceResolution,
} from "./naver-smartchannel-font-preflight.js";
export type {
  BBox,
  CanonicalInput,
  FreeformAppliedElement,
  FreeformValidationIssue,
  KakaoBizboardInputV1,
  LayoutMeasurements,
  RenderManifest,
  RendererConfig,
  RenderResponse,
  SmartChannelReport,
  SmartChannelTextRoleReport,
  TextLimitMetrics,
  TextLimitStatus,
  TextMeasurement,
  ValidationIssue,
  ValidationStage,
} from "./types.js";
export type {
  FreeformAssetInput,
  FreeformRenderOptions,
  FreeformRenderRequest,
  FreeformRenderResult,
} from "./freeform.js";
