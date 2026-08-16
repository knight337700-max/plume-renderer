import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ElectronApplication } from "@playwright/test";

const execFileAsync = promisify(execFile);

/**
 * Electron's async before-quit cleanup can leave utility/GPU descendants
 * alive after Playwright closes the BrowserWindow. Kill only the exact
 * process tree created by this test when the parent has not exited, so later
 * tests cannot inherit stale cache handles or native resources.
 */
export async function closeElectronTree(app: ElectronApplication): Promise<void> {
  const child = app.process();
  const pid = child.pid;
  await app.close();
  if (!pid || child.exitCode !== null) return;
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (child.exitCode !== null) return;
  if (process.platform === "win32") {
    await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "taskkill", "/PID", String(pid), "/T", "/F"], { windowsHide: true }).catch(() => undefined);
  } else {
    child.kill("SIGKILL");
  }
}
