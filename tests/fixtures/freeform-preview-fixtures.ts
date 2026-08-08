import sharp from "sharp";

const OVERSIZE_WIDTH = 1200;
const OVERSIZE_HEIGHT = 600;
const PROFILE_LIMIT_BYTES = 500_000;

let cachedOversizePng: Promise<Buffer> | undefined;

export async function deterministicOversizePng(): Promise<Buffer> {
  cachedOversizePng ??= (async () => {
    const raw = Buffer.alloc(OVERSIZE_WIDTH * OVERSIZE_HEIGHT * 3);
    let state = 0x6d2b79f5;
    for (let offset = 0; offset < raw.length; offset += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      raw[offset] = state & 0xff;
    }
    const png = await sharp(raw, {
      raw: { width: OVERSIZE_WIDTH, height: OVERSIZE_HEIGHT, channels: 3 },
    }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
    if (png.byteLength <= PROFILE_LIMIT_BYTES) {
      throw new Error(`Deterministic oversized fixture is only ${png.byteLength} bytes`);
    }
    return png;
  })();
  return Buffer.from(await cachedOversizePng);
}
