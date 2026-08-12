import path from "node:path";
import process from "node:process";

import { GlobalFonts, createCanvas } from "@napi-rs/canvas";

const root = process.cwd();
const fontRoot = path.join(root, "assets", "fonts", "naver-smartchannel");
const sample = "에스더버니리틀과 가을 준비!";
const directAlias = "N774_DIRECT_TTC_PROBE";
const derived = [
  { role: "regular", index: 0, postScriptName: "AppleSDGothicNeo-Regular", weight: 400, alias: "N774_DERIVED_REGULAR_PROBE", file: "AppleSDGothicNeo-macOS19-Regular.otf" },
  { role: "semibold", index: 4, postScriptName: "AppleSDGothicNeo-SemiBold", weight: 600, alias: "N774_DERIVED_SEMIBOLD_PROBE", file: "AppleSDGothicNeo-macOS19-SemiBold.otf" },
  { role: "bold", index: 6, postScriptName: "AppleSDGothicNeo-Bold", weight: 700, alias: "N774_DERIVED_BOLD_PROBE", file: "AppleSDGothicNeo-macOS19-Bold.otf" },
];

const directRegisterResult = GlobalFonts.registerFromPath(path.join(fontRoot, "AppleSDGothicNeo.ttc"), directAlias);
for (const face of derived) GlobalFonts.registerFromPath(path.join(fontRoot, face.file), face.alias);

const context = createCanvas(1000, 120).getContext("2d");
const measure = (family, weight) => {
  context.font = `${weight} 35px ${family}`;
  return context.measureText(sample).width;
};
const directWidths = Object.fromEntries(derived.map((face) => [face.role, measure(directAlias, face.weight)]));
const derivedWidths = Object.fromEntries(derived.map((face) => [face.role, measure(face.alias, face.weight)]));
const directStyles = GlobalFonts.families.find((entry) => entry.family === directAlias)?.styles ?? [];
const epsilon = 1e-9;
const directMatchesRegular = Object.values(directWidths).every((width) => Math.abs(width - derivedWidths.regular) <= epsilon);
const distinctRequiredFaces = Math.abs(derivedWidths.regular - derivedWidths.semibold) > epsilon && Math.abs(derivedWidths.regular - derivedWidths.bold) > epsilon;

process.stdout.write(`${JSON.stringify({
  systemFontsDisabled: process.env.DISABLE_SYSTEM_FONTS_LOAD === "1",
  backend: "@napi-rs/canvas 1.0.3 / Skia",
  apiHasFaceIndexParameter: false,
  directRegisterSucceeded: directRegisterResult !== null,
  directStyles,
  requestedWeightWidths: directWidths,
  derivedFaceWidths: derivedWidths,
  directMatchesRegular,
  distinctRequiredFaces,
  deterministicMultiFaceSelectionSupported: false,
  faces: {
    regular: { requestedIndex: 0, requestedPostScript: "AppleSDGothicNeo-Regular", load: directMatchesRegular ? "PASS" : "FAIL", resolvedIndex: directMatchesRegular ? 0 : null, resolvedPostScript: directMatchesRegular ? "AppleSDGothicNeo-Regular" : null },
    semibold: { requestedIndex: 4, requestedPostScript: "AppleSDGothicNeo-SemiBold", load: "FAIL", resolvedIndex: directMatchesRegular ? 0 : null, resolvedPostScript: directMatchesRegular ? "AppleSDGothicNeo-Regular" : null },
    bold: { requestedIndex: 6, requestedPostScript: "AppleSDGothicNeo-Bold", load: "FAIL", resolvedIndex: directMatchesRegular ? 0 : null, resolvedPostScript: directMatchesRegular ? "AppleSDGothicNeo-Regular" : null },
  },
}, null, 2)}\n`);
