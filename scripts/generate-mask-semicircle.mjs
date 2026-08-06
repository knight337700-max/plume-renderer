import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

export const MASK_WIDTH = 1029;
export const MASK_HEIGHT = 258;
export const MASK_CIRCLE = Object.freeze({ centerX: 801, centerY: 225, radius: 180 });
export const MASK_LOGO_CUTOUT = Object.freeze({ x: 839, y: 16, width: 142, height: 60 });
export const MASK_SUPERSAMPLE = 8;

const root = process.cwd();
const outputPath = path.join(root, "assets", "masks", "kakao-bizboard-mask-semicircle-right-v1.png");

function sampleInsideCircle(x, y) {
  const dx = x - MASK_CIRCLE.centerX;
  const dy = y - MASK_CIRCLE.centerY;
  return dx * dx + dy * dy <= MASK_CIRCLE.radius * MASK_CIRCLE.radius;
}

function sampleInsideCutout(x, y) {
  return x >= MASK_LOGO_CUTOUT.x && x < MASK_LOGO_CUTOUT.x + MASK_LOGO_CUTOUT.width && y >= MASK_LOGO_CUTOUT.y && y < MASK_LOGO_CUTOUT.y + MASK_LOGO_CUTOUT.height;
}

function stripMetadataChunks(png) {
  const chunks = [png.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("Generated PNG chunk is truncated");
    if (type !== "pHYs" && type !== "tEXt" && type !== "iTXt" && type !== "zTXt") chunks.push(png.subarray(offset, end));
    offset = end;
  }
  if (offset !== png.length) throw new Error("Generated PNG has trailing bytes");
  return Buffer.concat(chunks);
}

export async function generateMask() {
  const raw = Buffer.alloc(MASK_WIDTH * MASK_HEIGHT * 4);
  for (let y = 0; y < MASK_HEIGHT; y += 1) {
    for (let x = 0; x < MASK_WIDTH; x += 1) {
      let covered = 0;
      for (let sy = 0; sy < MASK_SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < MASK_SUPERSAMPLE; sx += 1) {
          const sampleX = x + (sx + 0.5) / MASK_SUPERSAMPLE;
          const sampleY = y + (sy + 0.5) / MASK_SUPERSAMPLE;
          if (sampleInsideCircle(sampleX, sampleY) && !sampleInsideCutout(sampleX, sampleY)) covered += 1;
        }
      }
      const offset = (y * MASK_WIDTH + x) * 4;
      raw[offset] = 255;
      raw[offset + 1] = 255;
      raw[offset + 2] = 255;
      raw[offset + 3] = Math.round((covered * 255) / (MASK_SUPERSAMPLE * MASK_SUPERSAMPLE));
    }
  }
  const encoded = await sharp(raw, { raw: { width: MASK_WIDTH, height: MASK_HEIGHT, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  const png = stripMetadataChunks(encoded);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
  return outputPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const generated = await generateMask();
  process.stdout.write(`${generated}\n`);
}
