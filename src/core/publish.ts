import { randomUUID } from "node:crypto";
import { access, open, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  OUTPUT_PNG_FILE_NAME,
  RENDER_MANIFEST_FILE_NAME,
  STAGING_DIRECTORY_NAME,
} from "./constants.js";
import { assertSameVolume, createSafeDirectory } from "./path-security.js";

export class PublishError extends Error {
  readonly code: "KBR-INPUT-010" | "KBR-SYSTEM-004";

  constructor(code: PublishError["code"], message: string) {
    super(message);
    this.name = "PublishError";
    this.code = code;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeFlushed(filePath: string, bytes: Uint8Array | string): Promise<void> {
  const handle = await open(filePath, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function publishArtifacts(options: {
  outputRoot: string;
  jobDirectory: string;
  png?: Buffer;
  artifact?: Buffer;
  artifactFileName?: string;
  manifest: string;
  overwrite: boolean;
}): Promise<{ pngPath: string; artifactPath: string; manifestPath: string }> {
  const stagingRoot = path.join(options.outputRoot, STAGING_DIRECTORY_NAME);
  const stagingDirectory = path.join(stagingRoot, randomUUID());
  const artifactFileName = options.artifactFileName ?? OUTPUT_PNG_FILE_NAME;
  const artifactBytes = options.artifact ?? options.png;
  if (!artifactBytes) throw new PublishError("KBR-SYSTEM-004", "No artifact bytes supplied");
  const stagedPng = path.join(stagingDirectory, artifactFileName);
  const stagedManifest = path.join(stagingDirectory, RENDER_MANIFEST_FILE_NAME);
  const pngPath = path.join(options.jobDirectory, artifactFileName);
  const manifestPath = path.join(options.jobDirectory, RENDER_MANIFEST_FILE_NAME);
  let manifestPublished = false;

  try {
    assertSameVolume(stagingDirectory, options.jobDirectory);
    if (!options.overwrite && ((await exists(pngPath)) || (await exists(manifestPath)))) {
      throw new PublishError("KBR-INPUT-010", "Final output already exists and overwrite is false");
    }

    await createSafeDirectory(options.outputRoot, stagingDirectory);
    await writeFlushed(stagedPng, artifactBytes);
    await writeFlushed(stagedManifest, options.manifest);
    await createSafeDirectory(options.outputRoot, options.jobDirectory);

    if (options.overwrite) {
      await rm(pngPath, { force: true });
      await rm(manifestPath, { force: true });
    }
    await rename(stagedManifest, manifestPath);
    manifestPublished = true;
    await rename(stagedPng, pngPath);
    await rm(stagingDirectory, { recursive: true, force: true });
    return { pngPath, artifactPath: pngPath, manifestPath };
  } catch (error) {
    if (manifestPublished) await rm(manifestPath, { force: true }).catch(() => undefined);
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    if (error instanceof PublishError) throw error;
    throw new PublishError("KBR-SYSTEM-004", error instanceof Error ? error.message : "Atomic publish failed");
  }
}
