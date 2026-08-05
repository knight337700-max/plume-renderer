import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const validDirectory = path.join(root, "fixtures", "valid");
const invalidDirectory = path.join(root, "fixtures", "invalid");
await Promise.all([
  mkdir(validDirectory, { recursive: true }),
  mkdir(invalidDirectory, { recursive: true }),
]);

function rawImage(width, height, paint) {
  const rgba = Buffer.alloc(width * height * 4);
  paint(rgba, width, height);
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function pixel(data, width, x, y, r, g, b, a) {
  const offset = (y * width + x) * 4;
  data[offset] = r;
  data[offset + 1] = g;
  data[offset + 2] = b;
  data[offset + 3] = a;
}

function rectangle(data, width, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) pixel(data, width, x, y, ...color);
  }
}

await writeFile(
  path.join(validDirectory, "object-right__product__basic__pass.png"),
  await rawImage(260, 160, (data, width) => {
    rectangle(data, width, 12, 20, 248, 138, [33, 121, 214, 255]);
    rectangle(data, width, 20, 138, 240, 145, [18, 65, 110, 72]);
  }),
);

await writeFile(
  path.join(validDirectory, "object-right__alpha__hole-shadow__pass.png"),
  await rawImage(280, 180, (data, width) => {
    rectangle(data, width, 15, 25, 265, 145, [224, 93, 56, 255]);
    rectangle(data, width, 105, 65, 175, 115, [0, 0, 0, 0]);
    rectangle(data, width, 25, 145, 255, 160, [30, 30, 30, 64]);
  }),
);

await writeFile(
  path.join(invalidDirectory, "object-right__alpha__fully-transparent__error.png"),
  await rawImage(64, 64, () => undefined),
);

await writeFile(
  path.join(invalidDirectory, "object-right__alpha__opaque-background__error.png"),
  await rawImage(260, 160, (data, width, height) => {
    rectangle(data, width, 0, 0, width, height, [245, 245, 245, 255]);
  }),
);

await writeFile(
  path.join(invalidDirectory, "object-right__alpha__upscale-over-1_5__error.png"),
  await rawImage(100, 100, (data, width) => {
    rectangle(data, width, 10, 10, 90, 90, [20, 180, 90, 255]);
  }),
);

await writeFile(
  path.join(validDirectory, "object-right__alpha__threshold-noise__warning.png"),
  await rawImage(260, 160, (data, width) => {
    rectangle(data, width, 15, 25, 245, 145, [120, 80, 210, 255]);
    pixel(data, width, 2, 2, 120, 80, 210, 1);
    pixel(data, width, 3, 3, 120, 80, 210, 7);
    pixel(data, width, 4, 4, 120, 80, 210, 8);
  }),
);

process.stdout.write("Generated deterministic Phase C1 PNG fixtures.\n");
