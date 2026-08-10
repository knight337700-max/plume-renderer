import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderFreeform } from "../dist/core/index.js";

const projectRoot = process.cwd();
const goldenRoot = path.join(projectRoot, "fixtures", "golden", "naver-freeform");
const stagingRoot = ".tmp-naver-freeform-goldens";
const cases = [
  { fixture: "fixtures/naver-freeform/mobile-da-jpeg.json", baseName: "naver-mobile-da__jpeg" },
  { fixture: "fixtures/naver-freeform/image-banner-1x1-png.json", baseName: "naver-image-banner-1x1__png" },
];

await mkdir(goldenRoot, { recursive: true });
await rm(path.join(projectRoot, stagingRoot), { recursive: true, force: true });
for (const testCase of cases) {
  const request = JSON.parse(await readFile(path.join(projectRoot, testCase.fixture), "utf8"));
  request.output = { ...request.output, directory: stagingRoot, baseName: testCase.baseName, overwrite: true };
  const result = await renderFreeform(request, {
    projectRoot,
    inputRoot: projectRoot,
    outputRoot: projectRoot,
    publish: true,
  });
  if (result.status !== "PASS" || !result.pngPath || !result.manifestPath || !result.png) {
    throw new Error(`${testCase.fixture} did not render: ${JSON.stringify(result.errors)}`);
  }
  const manifest = await readFile(result.manifestPath, "utf8");
  const suffix = result.artifactFormat === "JPEG" ? ".jpg" : ".png";
  await writeFile(path.join(goldenRoot, `${testCase.baseName}.golden${suffix}`), result.png);
  await writeFile(path.join(goldenRoot, `${testCase.baseName}.manifest.json`), manifest);
}
await rm(path.join(projectRoot, stagingRoot), { recursive: true, force: true });
console.log(`Generated ${cases.length} Naver FREEFORM representative goldens in ${goldenRoot}`);
