import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import sharp from "sharp";

import { sha256File } from "../../../../../src/core/hash.js";
import { resolveTrustedRoot } from "../../../../../src/core/path-security.js";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SESSION_MARKER = ".kbr-session";

export class DesktopSecurityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DesktopSecurityError";
    this.code = code;
  }
}

export type SessionAsset = {
  token: string;
  relativePath: "product.png";
  absolutePath: string;
  fileName: string;
  bytes: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  sha256: string;
};

export type SessionPreview = {
  token: string;
  absolutePath: string;
  inputDigest: string;
  assetDigest: string;
  pngDigest: string;
};

type OutputDirectoryRecord = { root: string; displayName: string };
type ExportRecord = { pngPath: string; manifestPath: string };

function isProhibitedWindowsPath(value: string): boolean {
  return (
    value.startsWith("\\\\") ||
    value.startsWith("//") ||
    value.startsWith("\\\\?\\") ||
    value.startsWith("\\\\.\\")
  );
}

function assertLocalAbsoluteFilePath(value: string): void {
  if (!path.isAbsolute(value) || isProhibitedWindowsPath(value)) {
    throw new DesktopSecurityError("DESKTOP-ASSET-001", "A local non-UNC absolute file path is required");
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyOpenFile(sourcePath: string, destinationPath: string): Promise<void> {
  const source = await open(sourcePath, "r");
  try {
    const sourceStat = await source.stat();
    if (!sourceStat.isFile()) throw new DesktopSecurityError("DESKTOP-ASSET-002", "Selected asset is not a file");
    await pipeline(source.createReadStream(), createWriteStream(destinationPath, { flags: "wx" }));
    const destination = await open(destinationPath, "r+");
    try {
      await destination.sync();
    } finally {
      await destination.close();
    }
  } finally {
    await source.close().catch(() => undefined);
  }
}

export class DesktopSessionManager {
  readonly baseRoot: string;
  readonly sessionId: string;
  readonly sessionRoot: string;
  readonly inputRoot: string;
  readonly previewRoot: string;
  #asset: SessionAsset | null = null;
  #preview: SessionPreview | null = null;
  readonly #outputDirectories = new Map<string, OutputDirectoryRecord>();
  readonly #exports = new Map<string, ExportRecord>();

  constructor(baseRoot: string, sessionId = randomUUID()) {
    if (!path.isAbsolute(baseRoot) || isProhibitedWindowsPath(baseRoot)) {
      throw new DesktopSecurityError("DESKTOP-SESSION-001", "Session base must be a local absolute path");
    }
    if (!UUID_PATTERN.test(sessionId)) {
      throw new DesktopSecurityError("DESKTOP-SESSION-002", "Session id must be a UUID v4");
    }
    this.baseRoot = path.resolve(baseRoot);
    this.sessionId = sessionId;
    this.sessionRoot = path.join(this.baseRoot, sessionId);
    this.inputRoot = path.join(this.sessionRoot, "input");
    this.previewRoot = path.join(this.sessionRoot, "preview");
  }

  static async cleanupStaleSessions(baseRoot: string, maximumAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    if (!path.isAbsolute(baseRoot) || isProhibitedWindowsPath(baseRoot)) return 0;
    await mkdir(baseRoot, { recursive: true });
    const entries = await readdir(baseRoot, { withFileTypes: true });
    let removed = 0;
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory() || !UUID_PATTERN.test(entry.name)) continue;
      const candidate = path.join(baseRoot, entry.name);
      const marker = path.join(candidate, SESSION_MARKER);
      if (!(await exists(marker))) continue;
      const candidateStat = await stat(candidate);
      if (now - candidateStat.mtimeMs <= maximumAgeMs) continue;
      await rm(candidate, { recursive: true, force: true });
      removed += 1;
    }
    return removed;
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.inputRoot, { recursive: true }),
      mkdir(this.previewRoot, { recursive: true }),
    ]);
    await writeFile(path.join(this.sessionRoot, SESSION_MARKER), this.sessionId, { encoding: "utf8", flag: "wx" });
  }

  async selectProduct(sourcePath: string): Promise<SessionAsset> {
    assertLocalAbsoluteFilePath(sourcePath);
    const sourceLstat = await lstat(sourcePath);
    if (!sourceLstat.isFile() || sourceLstat.isSymbolicLink()) {
      throw new DesktopSecurityError("DESKTOP-ASSET-002", "Symlink, reparse point, or non-file input is prohibited");
    }
    const sourceRealPath = await realpath(sourcePath);
    if (path.resolve(sourceRealPath).toLowerCase() !== path.resolve(sourcePath).toLowerCase()) {
      throw new DesktopSecurityError("DESKTOP-ASSET-002", "Resolved product path differs from selected path");
    }

    const sourceHandle = await open(sourcePath, "r");
    try {
      const signature = Buffer.alloc(8);
      const { bytesRead } = await sourceHandle.read(signature, 0, signature.length, 0);
      if (bytesRead !== 8 || signature.toString("hex") !== PNG_SIGNATURE) {
        throw new DesktopSecurityError("DESKTOP-ASSET-003", "Selected file does not have a PNG signature");
      }
    } finally {
      await sourceHandle.close();
    }

    await this.invalidatePreview();
    const temporaryPath = path.join(this.inputRoot, `.product-${randomUUID()}.tmp`);
    const productPath = path.join(this.inputRoot, "product.png");
    try {
      await copyOpenFile(sourcePath, temporaryPath);
      const metadata = await sharp(temporaryPath, { failOn: "error" }).metadata();
      if (metadata.format !== "png" || !metadata.width || !metadata.height) {
        throw new DesktopSecurityError("DESKTOP-ASSET-004", "Selected PNG cannot be decoded");
      }
      await rm(productPath, { force: true });
      await rename(temporaryPath, productPath);
      const productStat = await stat(productPath);
      this.#asset = {
        token: randomUUID(),
        relativePath: "product.png",
        absolutePath: productPath,
        fileName: path.basename(sourcePath),
        bytes: productStat.size,
        width: metadata.width,
        height: metadata.height,
        hasAlpha: metadata.hasAlpha ?? false,
        sha256: await sha256File(productPath),
      };
      return { ...this.#asset };
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      if (error instanceof DesktopSecurityError) throw error;
      throw new DesktopSecurityError("DESKTOP-ASSET-004", "Selected PNG cannot be decoded");
    }
  }

  getAsset(token: string): SessionAsset {
    if (!this.#asset || token !== this.#asset.token) {
      throw new DesktopSecurityError("DESKTOP-ASSET-005", "Asset token is stale or invalid");
    }
    return { ...this.#asset };
  }

  async clearProduct(): Promise<void> {
    await this.invalidatePreview();
    this.#asset = null;
    await rm(path.join(this.inputRoot, "product.png"), { force: true });
  }

  async storePreview(bytes: Buffer, inputDigest: string, assetDigest: string, pngDigest: string): Promise<SessionPreview> {
    await this.invalidatePreview();
    const token = randomUUID();
    const target = path.join(this.previewRoot, `${token}.png`);
    const handle = await open(target, "wx");
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    this.#preview = { token, absolutePath: target, inputDigest, assetDigest, pngDigest };
    return { ...this.#preview };
  }

  getPreview(token: string): SessionPreview {
    if (!this.#preview || token !== this.#preview.token) {
      throw new DesktopSecurityError("DESKTOP-PREVIEW-001", "Preview token is stale or invalid");
    }
    return { ...this.#preview };
  }

  async readPreview(token: string): Promise<Buffer> {
    return readFile(this.getPreview(token).absolutePath);
  }

  async invalidatePreview(): Promise<void> {
    const preview = this.#preview;
    this.#preview = null;
    if (preview) await rm(preview.absolutePath, { force: true });
  }

  async registerOutputDirectory(rootInput: string): Promise<{ token: string; displayName: string }> {
    const root = await resolveTrustedRoot(rootInput);
    const token = randomUUID();
    const displayName = path.basename(root) || path.parse(root).root;
    this.#outputDirectories.set(token, { root, displayName });
    return { token, displayName };
  }

  getOutputDirectory(token: string): OutputDirectoryRecord {
    const record = this.#outputDirectories.get(token);
    if (!record) throw new DesktopSecurityError("DESKTOP-OUTPUT-002", "Output directory token is stale or invalid");
    return { ...record };
  }

  registerExport(pngPath: string, manifestPath: string): string {
    const token = randomUUID();
    this.#exports.set(token, { pngPath, manifestPath });
    return token;
  }

  getExport(token: string): ExportRecord {
    const record = this.#exports.get(token);
    if (!record) throw new DesktopSecurityError("DESKTOP-EXPORT-001", "Export token is invalid");
    return { ...record };
  }

  async cleanup(): Promise<void> {
    this.#asset = null;
    this.#preview = null;
    this.#outputDirectories.clear();
    this.#exports.clear();
    const relative = path.relative(this.baseRoot, this.sessionRoot);
    if (relative === this.sessionId && UUID_PATTERN.test(relative)) {
      await rm(this.sessionRoot, { recursive: true, force: true });
    }
  }
}
