export const DESKTOP_CHANNELS = Object.freeze({
  selectProductPng: "kbr:product:select",
  selectSecondaryProductPng: "kbr:product:secondary-select",
  selectLogoPng: "kbr:logo:select",
  clearProduct: "kbr:product:clear",
  clearSecondaryProduct: "kbr:product:secondary-clear",
  clearLogo: "kbr:logo:clear",
  requestPreview: "kbr:preview:request",
  selectOutputDirectory: "kbr:output:select-directory",
  exportRender: "kbr:export:render",
  revealExportedFile: "kbr:export:reveal",
  getAppInfo: "kbr:app:info",
});

export type DesktopChannel = (typeof DESKTOP_CHANNELS)[keyof typeof DESKTOP_CHANNELS];

export const DESKTOP_CHANNEL_ALLOWLIST: readonly DesktopChannel[] = Object.freeze(
  Object.values(DESKTOP_CHANNELS),
);
