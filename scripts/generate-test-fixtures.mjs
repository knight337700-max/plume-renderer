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

const maskImage = path.join(validDirectory, "mask-semicircle-right__image__basic__pass.png");
const maskLogo = path.join(validDirectory, "mask-semicircle-right__logo__black__pass.png");
const maskLogoWhite = path.join(invalidDirectory, "mask-semicircle-right__logo__white__error.png");
const maskLogoColored = path.join(invalidDirectory, "mask-semicircle-right__logo__colored__error.png");
const maskLogoOpaque = path.join(invalidDirectory, "mask-semicircle-right__logo__opaque-background__error.png");
const maskLogoEmpty = path.join(invalidDirectory, "mask-semicircle-right__logo__empty__error.png");

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
  path.join(validDirectory, "object-right__product__inset-alpha__pass.png"),
  await rawImage(260, 160, (data, width) => {
    rectangle(data, width, 10, 10, 250, 150, [33, 121, 214, 1]);
    rectangle(data, width, 20, 20, 240, 140, [33, 121, 214, 255]);
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

await writeFile(
  maskImage,
  await rawImage(640, 480, (data, width) => {
    rectangle(data, width, 0, 0, 640, 480, [29, 111, 205, 255]);
    rectangle(data, width, 90, 60, 550, 420, [231, 109, 47, 255]);
  }),
);

await writeFile(
  maskLogo,
  await rawImage(200, 60, (data, width) => {
    rectangle(data, width, 38, 18, 162, 42, [0, 0, 0, 255]);
    rectangle(data, width, 54, 10, 146, 18, [0, 0, 0, 255]);
  }),
);

await writeFile(
  maskLogoWhite,
  await rawImage(200, 60, (data, width) => {
    rectangle(data, width, 38, 18, 162, 42, [255, 255, 255, 255]);
    rectangle(data, width, 54, 10, 146, 18, [255, 255, 255, 255]);
  }),
);

await writeFile(
  maskLogoColored,
  await rawImage(200, 60, (data, width) => {
    rectangle(data, width, 38, 18, 162, 42, [230, 48, 48, 255]);
  }),
);

await writeFile(
  maskLogoOpaque,
  await rawImage(200, 60, (data, width) => {
    rectangle(data, width, 0, 0, width, 60, [255, 255, 255, 255]);
  }),
);

await writeFile(maskLogoEmpty, await rawImage(200, 60, () => undefined));

process.stdout.write("Generated deterministic renderer PNG fixtures.\n");
