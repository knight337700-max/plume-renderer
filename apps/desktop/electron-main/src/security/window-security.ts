import type { WebPreferences } from "electron";

export function secureWebPreferences(preloadPath: string, development = false): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    devTools: development,
    webviewTag: false,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
    spellcheck: false,
  };
}

export function isAllowedRendererNavigation(candidate: string, rendererUrl: string): boolean {
  return candidate === rendererUrl || candidate === `${rendererUrl}#`;
}

export const BLOCKED_NETWORK_PATTERNS = Object.freeze([
  "http://*/*",
  "https://*/*",
  "ws://*/*",
  "wss://*/*",
  "ftp://*/*",
]);
