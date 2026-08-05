import type { DesktopApi } from "../../shared/src/index.js";

declare global {
  interface Window {
    kbrDesktop: DesktopApi;
  }
}

export {};
