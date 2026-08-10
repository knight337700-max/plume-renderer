import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";

const root = process.cwd();
const fixtureRoot = path.join(root, "fixtures", "valid", "naver-smartchannel");
await mkdir(fixtureRoot, { recursive: true });

function asset(name, width, height, side = "LEFT") {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const fullCanvasObject = width === 750;
  const x = fullCanvasObject ? (side === "RIGHT" ? 475 : 40) : side === "RIGHT" ? Math.max(0, width - Math.round(width * 0.78)) : Math.round(width * 0.1);
  const y = fullCanvasObject ? 0 : Math.round(height * 0.12);
  const w = fullCanvasObject ? 235 : Math.round(width * 0.64);
  const h = fullCanvasObject ? height : Math.round(height * 0.76);
  context.fillStyle = "#4D86FF";
  context.beginPath();
  context.roundRect(x, y, w, h, Math.min(24, Math.round(Math.min(w, h) / 6)));
  context.fill();
  context.fillStyle = "#FFD34D";
  context.beginPath();
  context.arc(x + Math.round(w * 0.72), y + Math.round(h * 0.3), Math.max(5, Math.round(Math.min(w, h) * 0.12)), 0, Math.PI * 2);
  context.fill();
  return canvas.toBuffer("image/png");
}

const entries = [
  ["N2-REP-001", 750, 160, "LEFT"],
  ["N2-REP-002", 210, 140, "RIGHT"],
  ["N2-REP-003", 750, 280, "LEFT"],
  ["N2-REP-004", 200, 200, "LEFT"],
  ["N2-REP-005", 425, 370, "RIGHT"],
  ["N2-REP-006", 750, 280, "LEFT"],
];
for (const [id, width, height, side] of entries) {
  await writeFile(path.join(fixtureRoot, `${id}-object.png`), asset(id, width, height, side));
}

const content = {
  "N2-REP-001": { headline: "브랜드의 새로운 시작", subcopy: "매일 더 나은 선택을 만나보세요" },
  "N2-REP-002": { headline: "새로운 영화 소식", subcopy: "이번 주 추천 콘텐츠", subcopyLine4: "12세 이상 관람가" },
  "N2-REP-003": { headline: "오늘의 특별한 혜택" },
  "N2-REP-004": { headline: "앱으로 더 빠르게", headlineLine2: "지금 바로 만나보세요", subcopy: "간편한 서비스 이용 안내", ctaOption: "가입하기" },
  "N2-REP-005": { headline: "새로운 이야기의 시작", headlineLine2: "영화관에서 만나요", subcopy: "등급 및 개봉일 안내", subcopyLine4: "2026년 8월 개봉" },
  "N2-REP-006": { headline: "안전한 선택을", headlineLine2: "지금 시작하세요", disclosureLine1: "심의필 2026-001호", disclosureLine2: "유효기간 2026년 12월까지" },
};
const templates = {
  "N2-REP-001": "NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_NONE",
  "N2-REP-002": "NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_RIGHT_THREE_LINE_NONE",
  "N2-REP-003": "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_LANDING_ICON",
  "N2-REP-004": "NAVER_SMARTCHANNEL_280_EMPHASIS_THUMBNAIL_LEFT_THREE_LINE_APP_CTA",
  "N2-REP-005": "NAVER_SMARTCHANNEL_280_EMPHASIS_PERSON_MOVIE_RIGHT_FOUR_LINE_NONE",
  "N2-REP-006": "NAVER_SMARTCHANNEL_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_MAIN2_DISCLOSURE_2LINE_NONE",
};
for (const [id] of entries) {
  const input = {
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    templateId: templates[id],
    content: content[id],
    assets: { object: { path: `fixtures/valid/naver-smartchannel/${id}-object.png` } },
    output: { directory: "naver-smartchannel", baseName: id, overwrite: true },
  };
  await writeFile(path.join(fixtureRoot, `${id}.input.json`), `${JSON.stringify(input, null, 2)}\n`, "utf8");
}
