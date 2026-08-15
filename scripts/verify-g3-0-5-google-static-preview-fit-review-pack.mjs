import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const failures = [];
const check = (id, condition, detail = "") => { const status = condition ? "PASS" : "FAIL"; checks.push({ id, status, detail }); if (!condition) failures.push(`${id}: ${detail}`); console.log(`${status} ${id}: ${detail}`); };
const readText = async (relative) => readFile(path.join(root, relative), "utf8");
const readJson = async (relative) => JSON.parse(await readText(relative));
const sha256 = async (relative) => createHash("sha256").update(await readFile(path.join(root, relative))).digest("hex");
const run = (command, args, timeout = 300_000) => {
  try {
    const executable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : command;
    const executableArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...args] : args;
    return { code: 0, output: execFileSync(executable, executableArgs, { cwd: root, encoding: "utf8", timeout, env: { ...process.env, CI: "1" } }) };
  } catch (error) {
    return { code: error?.status ?? 1, output: `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${String(error)}` };
  }
};

const versions = await readJson("contracts/contract-versions.json");
const packageJson = await readJson("package.json");
const profiles = await readJson("contracts/google/static-asset-profiles.g1.json");
check("version_policy", versions.documentVersion?.current === "1.31.1" && versions.desktopAppVersion === "0.13.1" && packageJson.version === "0.13.1" && versions.googleExportManifestSchemaVersion === "1.1.0", JSON.stringify({ document: versions.documentVersion, desktop: versions.desktopAppVersion, package: packageJson.version, googleManifest: versions.googleExportManifestSchemaVersion }));
check("canonical_hash_recorded", versions.canonicalPhaseG3_0_5Google?.canonicalDocumentSha256 === await sha256("docs/kakao-bizboard-renderer-spec-v1.md"), versions.canonicalPhaseG3_0_5Google?.canonicalDocumentSha256);
check("profile_matrix", profiles.profileCount === 14 && profiles.geometryProfileCount === 7 && profiles.uploadedDisplayStaticProfileCount === 7 && profiles.legacyDisplayRuntimeProfiles.length === 0, JSON.stringify({ profileCount: profiles.profileCount, geometry: profiles.geometryProfileCount, uploaded: profiles.uploadedDisplayStaticProfileCount }));
check("frozen_g2_registry", await sha256("contracts/google/goldens.g2.1.json") === "00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359");
check("frozen_g3_1_registry", await sha256("contracts/google/desktop-qa-freeze.g3.1.json") === "1dc779a4feb83b7df5c6b06966d74492f2e5c682ea32b19dcd87813b3ea218ef");
check("object_right_reference", await sha256("reference/kakao-tool/OBJECT_RIGHT.png") === "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b");

const ui = await readText("apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx");
const geometry = await readText("apps/desktop/renderer-ui/src/features/google/google-preview-geometry.ts");
const css = await readText("apps/desktop/renderer-ui/src/styles.css");
const policy = await readText("scripts/google-review-pack-path-policy.mjs");
check("fit_both_dimensions", geometry.includes("viewport.width / canvas.width") && geometry.includes("viewport.height / canvas.height") && ui.includes("resolveFitPreviewGeometry"));
check("actual_content_rect_pointer", ui.includes("contentRef.current?.getBoundingClientRect()") && ui.includes("isPointInsidePreviewContent"));
check("fit_no_clipping", css.includes(".google-canvas-fit { overflow: hidden; }") && css.includes("height: 100vh"));
check("uploaded_lock_scope", ui.includes("readOnly={profile.role === \"UPLOADED_DISPLAY_STATIC\"}") && ui.includes("disabled={profile.role === \"UPLOADED_DISPLAY_STATIC\"}"));
check("path_neutral_policy", policy.includes("buildPathNeutralExecutionIdentity") && policy.includes("scanReviewPackPayload") && policy.includes("NOT_EXPOSED"));

const unit = run("pnpm", ["exec", "vitest", "run", "tests/desktop/integration/google-static-preview-geometry.test.ts", "tests/desktop/integration/google-review-pack-path-policy.test.ts"], 120_000);
check("unit_geometry_and_pack_policy", unit.code === 0 && /Test Files\s+2 passed/u.test(unit.output), unit.output.trim().slice(-1000));
const e2e = run("pnpm", ["exec", "playwright", "test", "tests/e2e/google-static-g3-0-5.spec.ts", "--retries=0"], 300_000);
check("electron_fit_actual_pointer_uploaded_matrix", e2e.code === 0 && /4 passed/u.test(e2e.output), e2e.output.trim().slice(-1200));

const status = failures.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify({ status, checks: checks.length, passed: checks.filter((entry) => entry.status === "PASS").length, failed: failures }, null, 2));
if (status !== "PASS") process.exitCode = 1;
