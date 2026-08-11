import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const packageVersion = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
const objectPath = process.env.KBR_N7_5_OBJECT ?? "C:/Users/Lenovo/Desktop/kakao/TEST_SOURCE/Plume_누끼.png";
const unpackedExe = path.join(root, "release", "win-unpacked", "Kakao-Bizboard-Local-Renderer.exe");
const portableExe = path.join(root, "release", `Kakao-Bizboard-Local-Renderer-${packageVersion}-x64.exe`);
const cases = [
  { name: "160-landing", template: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_LANDING_ICON", headline: "자코모", subcopy: "프리미엄 소파", ctaOption: "" },
  { name: "200-landing", template: "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_LEFT_MAIN_SUB_LANDING_ICON", headline: "자코모", subcopy: "프리미엄 소파", ctaOption: "" },
  { name: "280-landing", template: "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_LANDING_ICON", headline: "자코모", subcopy: "", ctaOption: "" },
  { name: "160-cta", template: "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_APP_CTA", headline: "자코모", subcopy: "프리미엄 소파", ctaOption: "가입하기" },
  { name: "200-cta", template: "NAVER_SMARTCHANNEL_200_BASIC_STANDARD_LEFT_MAIN_SUB_APP_CTA", headline: "자코모", subcopy: "프리미엄 소파", ctaOption: "가입하기" },
  { name: "280-cta", template: "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_APP_CTA", headline: "자코모", subcopy: "", ctaOption: "가입하기" },
];

async function runCase(exe, entry, label, timeoutMs = 180_000) {
  const token = crypto.randomUUID();
  const resultPath = path.join(os.tmpdir(), `kbr-n7-5-${label}-${token}.json`);
  const outputRoot = path.join(os.tmpdir(), `kbr-n7-5-${label}-${token}`);
  const child = spawn(exe, [`--smoke-n7-5-fixed=${token}`], {
    cwd: path.dirname(exe),
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      KBR_N7_5_OBJECT: objectPath,
      KBR_N7_5_TEMPLATE_ID: entry.template,
      KBR_N7_5_HEADLINE: entry.headline,
      KBR_N7_5_SUBCOPY: entry.subcopy,
      KBR_N7_5_CTA_OPTION: entry.ctaOption,
      KBR_N7_5_OUTPUT: outputRoot,
      KBR_N7_5_RESULT: resultPath,
    },
  });
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const report = JSON.parse(await readFile(resultPath, "utf8"));
      if (child.exitCode === null) await execFileAsync("taskkill", ["/PID", String(child.pid), "/T", "/F"]).catch(() => {});
      await rm(outputRoot, { recursive: true, force: true });
      await rm(resultPath, { force: true });
      if (report.status !== "PASS") throw new Error(`${label}: ${report.error ?? "status FAIL"}`);
      return { label, status: report.status, templateId: report.templateId, fixedComponents: report.fixedComponents };
    } catch (error) {
      if (error?.code !== "ENOENT" && error instanceof SyntaxError === false && error instanceof Error && !String(error.message).includes("no such file")) {
        if (String(error.message).includes("status FAIL")) throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (child.exitCode === null) await execFileAsync("taskkill", ["/PID", String(child.pid), "/T", "/F"]).catch(() => {});
  throw new Error(`${label}: timeout waiting for packaged smoke result`);
}

const results = [];
for (const entry of cases) results.push(await runCase(unpackedExe, entry, `unpacked-${entry.name}`));
results.push(await runCase(portableExe, cases[0], "portable-160-landing", 240_000));
console.log(JSON.stringify({ status: "PASS", packageVersion, unpackedCases: cases.length, portableCases: 1, results }, null, 2));
