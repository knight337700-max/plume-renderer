import type { RendererDiagnostic, UiChannel } from "../../../shared/src/index.js";

type DiagnosticContext = Pick<RendererDiagnostic, "channel" | "placement" | "subtype" | "templateId">;

let context: DiagnosticContext = {};
let installed = false;

export function setRendererDiagnosticContext(next: DiagnosticContext): void {
  context = { ...next };
}

export function reportRendererDiagnostic(diagnostic: Omit<RendererDiagnostic, "source">): void {
  const api = typeof window === "undefined" ? undefined : window.kbrDesktop;
  if (!api || typeof api.reportRendererDiagnostic !== "function") return;
  void api.reportRendererDiagnostic({ ...context, ...diagnostic, source: "renderer" }).catch(() => {
    // Diagnostics must never create a second renderer failure.
  });
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message || value.name || "Unknown error";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function installRendererDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    const error = event.error instanceof Error ? event.error : undefined;
    reportRendererDiagnostic({
      kind: "window_error",
      message: error?.message || event.message || "Unhandled window error",
      ...(error?.name ? { name: error.name } : {}),
      ...(error?.stack ? { stack: error.stack } : {}),
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason : undefined;
    reportRendererDiagnostic({
      kind: "unhandled_rejection",
      message: errorMessage(event.reason),
      ...(reason?.name ? { name: reason.name } : {}),
      ...(reason?.stack ? { stack: reason.stack } : {}),
    });
  });
}

export function setChannelContext(channel: UiChannel): void {
  setRendererDiagnosticContext({ ...context, channel });
}
