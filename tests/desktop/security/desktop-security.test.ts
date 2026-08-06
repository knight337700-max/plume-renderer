import { readFile, symlink } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DESKTOP_CHANNEL_ALLOWLIST, DESKTOP_CHANNELS } from "../../../apps/desktop/shared/src/index.js";
import { DesktopSessionManager } from "../../../apps/desktop/electron-main/src/session/session-manager.js";
import { secureWebPreferences } from "../../../apps/desktop/electron-main/src/security/window-security.js";
import { createTempRoot, projectRoot, removeTempRoot } from "../../helpers.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(removeTempRoot));
});

describe("Electron and IPC security boundary", () => {
  it("freezes the secure BrowserWindow preferences", () => {
    expect(secureWebPreferences("C:/app/preload.cjs", false)).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
    });
  });

  it("exposes only the typed IPC operations", () => {
    expect(DESKTOP_CHANNEL_ALLOWLIST).toEqual([
      DESKTOP_CHANNELS.selectProductPng,
      DESKTOP_CHANNELS.selectSecondaryProductPng,
      DESKTOP_CHANNELS.clearProduct,
      DESKTOP_CHANNELS.clearSecondaryProduct,
      DESKTOP_CHANNELS.requestPreview,
      DESKTOP_CHANNELS.selectOutputDirectory,
      DESKTOP_CHANNELS.exportRender,
      DESKTOP_CHANNELS.revealExportedFile,
      DESKTOP_CHANNELS.getAppInfo,
    ]);
    expect(new Set(DESKTOP_CHANNEL_ALLOWLIST).size).toBe(DESKTOP_CHANNEL_ALLOWLIST.length);
  });

  it("keeps Node, fs, process, and generic IPC out of Renderer UI source", async () => {
    const uiFiles = [
      "apps/desktop/renderer-ui/src/app/App.tsx",
      "apps/desktop/renderer-ui/src/app/state.ts",
      "apps/desktop/renderer-ui/src/main.tsx",
    ];
    const source = (await Promise.all(uiFiles.map((file) => readFile(path.join(projectRoot, file), "utf8")))).join("\n");
    expect(source).not.toMatch(/from\s+["']node:/u);
    expect(source).not.toMatch(/\brequire\s*\(/u);
    expect(source).not.toMatch(/\bprocess\s*\./u);
    expect(source).not.toMatch(/\bfs\s*\./u);
    expect(source).not.toContain("ipcRenderer");
  });

  it("uses a restrictive production CSP and no remote URL", async () => {
    const html = await readFile(path.join(projectRoot, "apps/desktop/renderer-ui/index.html"), "utf8");
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("frame-src 'none'");
    expect(html).toContain("object-src 'none'");
    expect(html).not.toMatch(/https?:\/\//u);
    expect(html).not.toContain("iframe");
  });

  it.each(["\\\\server\\share", "\\\\?\\C:\\device", "//server/share"])(
    "rejects prohibited session root %s",
    (root) => expect(() => new DesktopSessionManager(root)).toThrow("local absolute path"),
  );

  it("rejects a symlink product without copying it", async () => {
    const root = await createTempRoot("desktop-symlink");
    roots.push(root);
    const session = new DesktopSessionManager(path.join(root, "session"));
    await session.initialize();
    const target = path.join(projectRoot, "fixtures", "valid", "object-right__product__basic__pass.png");
    const link = path.join(root, "linked.png");
    try {
      await symlink(target, link, "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await expect(session.selectProduct(link)).rejects.toThrow("Symlink");
    await session.cleanup();
  });

  it("rejects stale asset, Preview, output, and export tokens", async () => {
    const root = await createTempRoot("desktop-tokens");
    roots.push(root);
    const session = new DesktopSessionManager(path.join(root, "session"));
    await session.initialize();
    const stale = "0b3b1ad0-ef9e-4fb9-9e08-e9d3e8bcb792";
    expect(() => session.getAsset(stale)).toThrow("stale or invalid");
    expect(() => session.getPreview(stale)).toThrow("stale or invalid");
    expect(() => session.getOutputDirectory(stale)).toThrow("stale or invalid");
    expect(() => session.getExport(stale)).toThrow("invalid");
    await session.cleanup();
  });

  it("contains no updater, telemetry, remote service, or external navigation call", async () => {
    const files = [
      "apps/desktop/electron-main/src/main.ts",
      "apps/desktop/electron-main/src/desktop-controller.ts",
      "apps/desktop/preload/src/index.ts",
    ];
    const source = (await Promise.all(files.map((file) => readFile(path.join(projectRoot, file), "utf8")))).join("\n");
    expect(source).not.toMatch(/autoUpdater|crashReporter|telemetry|analytics|shell\.openExternal|https?:\/\//iu);
    expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket/iu);
  });
});
