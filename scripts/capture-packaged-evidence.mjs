import { mkdir } from "node:fs/promises";
import path from "node:path";

import { _electron as electron } from "@playwright/test";

const root = process.cwd();
const executablePath = path.join(root, "release", "win-unpacked", "Kakao-Bizboard-Local-Renderer.exe");
const evidenceRoot = path.join(root, "tests", "manual", "evidence");
await mkdir(evidenceRoot, { recursive: true });

const application = await electron.launch({ executablePath });
try {
  const page = await application.firstWindow();
  await page.waitForSelector('[data-testid="desktop-app"]');
  await page.screenshot({
    path: path.join(evidenceRoot, "packaged-app-empty-state.png"),
    fullPage: true,
  });
} finally {
  await application.close();
}

process.stdout.write("Captured actual packaged app empty-state evidence.\n");
