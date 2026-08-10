import { contextBridge, ipcRenderer } from "electron";

import { DESKTOP_CHANNELS } from "../../shared/src/index.js";
import type { DesktopApi, ExportRequest, NaverExportRequest, NaverPreviewRequest, RendererDiagnostic, UiRenderInput } from "../../shared/src/index.js";

const desktopApi: DesktopApi = Object.freeze({
  selectProductPng: () => ipcRenderer.invoke(DESKTOP_CHANNELS.selectProductPng),
  selectSecondaryProductPng: () => ipcRenderer.invoke(DESKTOP_CHANNELS.selectSecondaryProductPng),
  selectLogoPng: () => ipcRenderer.invoke(DESKTOP_CHANNELS.selectLogoPng),
  clearProduct: () => ipcRenderer.invoke(DESKTOP_CHANNELS.clearProduct),
  clearSecondaryProduct: () => ipcRenderer.invoke(DESKTOP_CHANNELS.clearSecondaryProduct),
  clearLogo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.clearLogo),
  requestPreview: (input: UiRenderInput) => ipcRenderer.invoke(DESKTOP_CHANNELS.requestPreview, input),
  selectOutputDirectory: () => ipcRenderer.invoke(DESKTOP_CHANNELS.selectOutputDirectory),
  exportRender: (request: ExportRequest) => ipcRenderer.invoke(DESKTOP_CHANNELS.exportRender, request),
  getNaverCatalog: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getNaverCatalog),
  requestNaverPreview: (input: NaverPreviewRequest) => ipcRenderer.invoke(DESKTOP_CHANNELS.requestNaverPreview, input),
  exportNaver: (request: NaverExportRequest) => ipcRenderer.invoke(DESKTOP_CHANNELS.exportNaver, request),
  revealExportedFile: (exportToken: string) => ipcRenderer.invoke(DESKTOP_CHANNELS.revealExportedFile, exportToken),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getAppInfo),
  reportRendererDiagnostic: (diagnostic: RendererDiagnostic) => ipcRenderer.invoke(DESKTOP_CHANNELS.reportRendererDiagnostic, diagnostic),
});

contextBridge.exposeInMainWorld("kbrDesktop", desktopApi);
