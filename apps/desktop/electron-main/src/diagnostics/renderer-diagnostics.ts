import { appendFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { app } from "electron";

import type { RendererDiagnostic } from "../../../shared/src/index.js";

const MAX_FIELD_LENGTH = 16_000;

function bounded(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.length <= MAX_FIELD_LENGTH ? value : `${value.slice(0, MAX_FIELD_LENGTH)}…`;
}

export function diagnosticLogPath(): string {
  return path.join(app.getPath("userData"), "logs", "renderer.log");
}

export class RendererDiagnostics {
  #queue: Promise<void> = Promise.resolve();

  record(diagnostic: RendererDiagnostic): Promise<void> {
    const entry = {
      timestamp: diagnostic.timestamp ?? new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      pid: process.pid,
      source: diagnostic.source ?? "renderer",
      kind: diagnostic.kind,
      ...(diagnostic.channel === undefined ? {} : { channel: diagnostic.channel }),
      ...(diagnostic.placement === undefined ? {} : { placement: bounded(diagnostic.placement) }),
      ...(diagnostic.subtype === undefined ? {} : { subtype: bounded(diagnostic.subtype) }),
      ...(diagnostic.templateId === undefined ? {} : { templateId: bounded(diagnostic.templateId) }),
      ...(diagnostic.name === undefined ? {} : { name: bounded(diagnostic.name) }),
      message: bounded(diagnostic.message) ?? "Unknown renderer diagnostic",
      ...(diagnostic.stack === undefined ? {} : { stack: bounded(diagnostic.stack) }),
      ...(diagnostic.componentStack === undefined ? {} : { componentStack: bounded(diagnostic.componentStack) }),
    };
    this.#queue = this.#queue.then(async () => {
      const target = diagnosticLogPath();
      await mkdir(path.dirname(target), { recursive: true });
      await appendFile(target, `${JSON.stringify(entry)}${os.EOL}`, "utf8");
    }).catch(() => {
      // Diagnostics must never become a second renderer failure.
    });
    return this.#queue;
  }
}
