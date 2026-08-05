import { contextBridge, ipcRenderer } from "electron";

import { DESKTOP_CHANNELS } from "../../shared/src/index.js";
import type { DesktopApi, ExportRequest, UiRenderInput } from "../../shared/src/index.js";

const desktopApi: DesktopApi = Object.freeze({
  selectProductPng: () => ipcRenderer.invoke(DESKTOP_CHANNELS.selectProductPng),
  clearProduct: () => ipcRenderer.invoke(DESKTOP_CHANNELS.clearProduct),
  requestPreview: (input: UiRenderInput) => ipcRenderer.invoke(DESKTOP_CHANNELS.requestPreview, input),
  selectOutputDirectory: () => ipcRenderer.invoke(DESKTOP_CHANNELS.selectOutputDirectory),
  exportRender: (request: ExportRequest) => ipcRenderer.invoke(DESKTOP_CHANNELS.exportRender, request),
  revealExportedFile: (exportToken: string) => ipcRenderer.invoke(DESKTOP_CHANNELS.revealExportedFile, exportToken),
  getAppInfo: () => ipcRenderer.invoke(DESKTOP_CHANNELS.getAppInfo),
});

contextBridge.exposeInMainWorld("kbrDesktop", desktopApi);
