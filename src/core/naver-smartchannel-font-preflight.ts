import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PathSecurityError, resolveTrustedInputFile, resolveTrustedRoot } from "./path-security.js";

export const NAVER_SMARTCHANNEL_FONT_ERROR_CODES = {
  unavailable: "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE",
  identityMismatch: "NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH",
  versionMismatch: "NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH",
} as const;

export type NaverSmartChannelFontErrorCode =
  (typeof NAVER_SMARTCHANNEL_FONT_ERROR_CODES)[keyof typeof NAVER_SMARTCHANNEL_FONT_ERROR_CODES];

export type SmartChannelFontResolutionMode = "BUNDLED_EXACT" | "SYSTEM_EXACT" | "EXTERNAL_EXACT";

export type SmartChannelFontRequirement = {
  requiredPostScriptName: string;
  /** Source PSD identity; runtime matching uses runtimePostScriptName when present. */
  sourcePostScriptName?: string;
  runtimePostScriptName?: string;
  fontToken?: string;
  sourceIdentityStatus?: "SOURCE_EXACT" | "SOURCE_DIFFERENT_BUILD";
  compatibilityStatus?: "PROJECT_COMPATIBLE_VERIFIED" | "PROJECT_COMPATIBLE_UNVERIFIED" | "INCOMPATIBLE";
  allowedResolutionModes: readonly SmartChannelFontResolutionMode[];
  expectedSha256?: string;
  expectedVersion?: string;
};

export type ExternalExactFontResource = {
  path: string;
  expectedPostScriptName: string;
  expectedSha256: string;
  expectedVersion?: string;
};

export type ParsedFontIdentity = {
  postScriptNames: string[];
  familyNames: string[];
  subfamilyNames: string[];
  versions: string[];
  weightClass: number | null;
};

export type FontPreflightIssue = {
  code: NaverSmartChannelFontErrorCode;
  messageKey: string;
  path: string;
  expected?: unknown;
  actual?: unknown;
};

export type FontPreflightResult = {
  status: "PASS" | "BLOCKED";
  renderStartAllowed: boolean;
  requiredPostScriptName: string;
  resolutionMode: SmartChannelFontResolutionMode;
  issues: FontPreflightIssue[];
  resolvedPath?: string;
  digest?: string;
  identity?: ParsedFontIdentity;
  fontToken?: string;
  sourceIdentityStatus?: "SOURCE_EXACT" | "SOURCE_DIFFERENT_BUILD";
  compatibilityStatus?: "PROJECT_COMPATIBLE_VERIFIED" | "PROJECT_COMPATIBLE_UNVERIFIED" | "INCOMPATIBLE";
};

type TableRecord = { offset: number; length: number };

function readUInt16(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.byteLength) return null;
  const first = bytes[offset];
  const second = bytes[offset + 1];
  return first === undefined || second === undefined ? null : (first << 8) | second;
}

function readUInt32(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.byteLength) return null;
  const first = bytes[offset];
  const second = bytes[offset + 1];
  const third = bytes[offset + 2];
  const fourth = bytes[offset + 3];
  return first === undefined || second === undefined || third === undefined || fourth === undefined
    ? null
    : (first * 0x1000000) + (second << 16) + (third << 8) + fourth;
}

function decodeUtf16Be(bytes: Uint8Array): string {
  let value = "";
  for (let offset = 0; offset + 1 < bytes.length; offset += 2) {
    const first = bytes[offset];
    const second = bytes[offset + 1];
    if (first === undefined || second === undefined) continue;
    value += String.fromCharCode((first << 8) | second);
  }
  return value.replaceAll("\u0000", "").trim();
}

function decodeNameBytes(bytes: Uint8Array, platformId: number): string {
  if (platformId === 0 || platformId === 3) return decodeUtf16Be(bytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replaceAll("\u0000", "").trim();
}

function nameValue(values: Map<number, Set<string>>, nameId: number): string[] {
  return [...(values.get(nameId) ?? new Set<string>())].filter(Boolean).sort();
}

function tableDirectory(bytes: Uint8Array): Map<string, TableRecord> | null {
  const signature = new TextDecoder("latin1").decode(bytes.subarray(0, 4));
  if (!(signature === "OTTO" || signature === "true" || signature === "typ1" || signature === "\u0000\u0001\u0000\u0000")) return null;
  const tableCount = readUInt16(bytes, 4);
  if (tableCount === null || tableCount > 4096) return null;
  const tables = new Map<string, TableRecord>();
  for (let index = 0; index < tableCount; index += 1) {
    const rowOffset = 12 + (index * 16);
    if (rowOffset + 16 > bytes.length) return null;
    const tag = new TextDecoder("latin1").decode(bytes.subarray(rowOffset, rowOffset + 4));
    const offset = readUInt32(bytes, rowOffset + 8);
    const length = readUInt32(bytes, rowOffset + 12);
    if (offset === null || length === null || offset + length > bytes.length) return null;
    tables.set(tag, { offset, length });
  }
  return tables;
}

export function inspectFontIdentity(bytes: Uint8Array): ParsedFontIdentity | null {
  const tables = tableDirectory(bytes);
  const nameTable = tables?.get("name");
  if (!tables || !nameTable) return null;
  const format = readUInt16(bytes, nameTable.offset);
  const count = readUInt16(bytes, nameTable.offset + 2);
  const stringOffset = readUInt16(bytes, nameTable.offset + 4);
  if (format === null || count === null || stringOffset === null || count > 4096) return null;
  const values = new Map<number, Set<string>>();
  for (let index = 0; index < count; index += 1) {
    const recordOffset = nameTable.offset + 6 + (index * 12);
    const platformId = readUInt16(bytes, recordOffset);
    const nameId = readUInt16(bytes, recordOffset + 6);
    const length = readUInt16(bytes, recordOffset + 8);
    const valueOffset = readUInt16(bytes, recordOffset + 10);
    if (platformId === null || nameId === null || length === null || valueOffset === null) return null;
    const start = nameTable.offset + stringOffset + valueOffset;
    if (start + length > nameTable.offset + nameTable.length) return null;
    const value = decodeNameBytes(bytes.subarray(start, start + length), platformId);
    if (!value) continue;
    const set = values.get(nameId) ?? new Set<string>();
    set.add(value);
    values.set(nameId, set);
  }
  const postScriptNames = nameValue(values, 6);
  if (postScriptNames.length === 0) return null;
  const os2 = tables.get("OS/2");
  const weightClass = os2 && os2.length >= 6 ? readUInt16(bytes, os2.offset + 4) : null;
  return {
    postScriptNames,
    familyNames: nameValue(values, 1),
    subfamilyNames: nameValue(values, 2),
    versions: nameValue(values, 5),
    weightClass,
  };
}

function issue(
  code: NaverSmartChannelFontErrorCode,
  messageKey: string,
  expected?: unknown,
  actual?: unknown,
  pathValue = "/font",
): FontPreflightIssue {
  const result: FontPreflightIssue = { code, messageKey, path: pathValue };
  if (expected !== undefined) result.expected = expected;
  if (actual !== undefined) result.actual = actual;
  return result;
}

function passedResult(
  requirement: SmartChannelFontRequirement,
  resolutionMode: SmartChannelFontResolutionMode,
  details: { resolvedPath?: string; digest?: string; identity?: ParsedFontIdentity },
): FontPreflightResult {
  const result: FontPreflightResult = {
    status: "PASS",
    renderStartAllowed: true,
    requiredPostScriptName: requirement.requiredPostScriptName,
    resolutionMode,
    issues: [],
  };
  if (requirement.fontToken !== undefined) result.fontToken = requirement.fontToken;
  if (requirement.sourceIdentityStatus !== undefined) result.sourceIdentityStatus = requirement.sourceIdentityStatus;
  if (requirement.compatibilityStatus !== undefined) result.compatibilityStatus = requirement.compatibilityStatus;
  if (details.resolvedPath !== undefined) result.resolvedPath = details.resolvedPath;
  if (details.digest !== undefined) result.digest = details.digest;
  if (details.identity !== undefined) result.identity = details.identity;
  return result;
}

function blockedResult(
  requirement: SmartChannelFontRequirement,
  resolutionMode: SmartChannelFontResolutionMode,
  issues: FontPreflightIssue[],
  details: { resolvedPath?: string; digest?: string; identity?: ParsedFontIdentity } = {},
): FontPreflightResult {
  const result: FontPreflightResult = {
    status: "BLOCKED",
    renderStartAllowed: false,
    requiredPostScriptName: requirement.requiredPostScriptName,
    resolutionMode,
    issues,
  };
  if (requirement.fontToken !== undefined) result.fontToken = requirement.fontToken;
  if (requirement.sourceIdentityStatus !== undefined) result.sourceIdentityStatus = requirement.sourceIdentityStatus;
  if (requirement.compatibilityStatus !== undefined) result.compatibilityStatus = requirement.compatibilityStatus;
  if (details.resolvedPath !== undefined) result.resolvedPath = details.resolvedPath;
  if (details.digest !== undefined) result.digest = details.digest;
  if (details.identity !== undefined) result.identity = details.identity;
  return result;
}

export function evaluateFontIdentity(
  requirement: SmartChannelFontRequirement,
  resolutionMode: SmartChannelFontResolutionMode,
  actual: { postScriptNames: readonly string[]; digest: string; versions?: readonly string[] },
): FontPreflightResult {
  const issues: FontPreflightIssue[] = [];
  const runtimePostScriptName = requirement.runtimePostScriptName ?? requirement.requiredPostScriptName;
  if (!requirement.allowedResolutionModes.includes(resolutionMode)) {
    issues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.unavailable,
      "naver_smartchannel.font_unavailable",
      requirement.allowedResolutionModes,
      resolutionMode,
      "/font/resolutionMode",
    ));
  }
  if (!actual.postScriptNames.includes(runtimePostScriptName)) {
    issues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.identityMismatch,
      "naver_smartchannel.font_identity_mismatch",
      runtimePostScriptName,
      actual.postScriptNames,
      "/font/postScriptName",
    ));
  }
  if (requirement.expectedSha256 !== undefined && actual.digest.toLowerCase() !== requirement.expectedSha256.toLowerCase()) {
    issues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.identityMismatch,
      "naver_smartchannel.font_digest_mismatch",
      requirement.expectedSha256.toLowerCase(),
      actual.digest.toLowerCase(),
      "/font/sha256",
    ));
  }
  if (requirement.expectedVersion !== undefined && !(actual.versions ?? []).includes(requirement.expectedVersion)) {
    issues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.versionMismatch,
      "naver_smartchannel.font_version_mismatch",
      requirement.expectedVersion,
      actual.versions ?? [],
      "/font/version",
    ));
  }
  return issues.length === 0
    ? passedResult(requirement, resolutionMode, { digest: actual.digest })
    : blockedResult(requirement, resolutionMode, issues, { digest: actual.digest });
}

export async function preflightExternalExactFont(
  requirement: SmartChannelFontRequirement,
  resource: ExternalExactFontResource,
  options: { trustedRoot: string },
): Promise<FontPreflightResult> {
  if (!requirement.allowedResolutionModes.includes("EXTERNAL_EXACT")) {
    return blockedResult(requirement, "EXTERNAL_EXACT", [issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.unavailable,
      "naver_smartchannel.font_unavailable",
      "EXTERNAL_EXACT resolution mode",
      requirement.allowedResolutionModes,
      "/font/resolutionMode",
    )]);
  }
  let trustedRoot: string;
  let resolvedPath: string;
  try {
    if (/^[a-z][a-z\d+.-]*:/iu.test(resource.path) || /^[a-z]:/iu.test(resource.path)) {
      throw new PathSecurityError("External font reference must be a trusted-root relative path", resource.path);
    }
    trustedRoot = await resolveTrustedRoot(options.trustedRoot);
    resolvedPath = await resolveTrustedInputFile(trustedRoot, resource.path);
  } catch (error) {
    return blockedResult(requirement, "EXTERNAL_EXACT", [issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.unavailable,
      "naver_smartchannel.font_unavailable",
      "trusted local exact font resource",
      error instanceof Error ? error.message : String(error),
      "/font/path",
    )]);
  }

  const declarationIssues: FontPreflightIssue[] = [];
  const runtimePostScriptName = requirement.runtimePostScriptName ?? requirement.requiredPostScriptName;
  if (resource.expectedPostScriptName !== runtimePostScriptName) {
    declarationIssues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.identityMismatch,
      "naver_smartchannel.font_identity_mismatch",
      runtimePostScriptName,
      resource.expectedPostScriptName,
      "/font/expectedPostScriptName",
    ));
  }
  if (requirement.expectedSha256 !== undefined && resource.expectedSha256.toLowerCase() !== requirement.expectedSha256.toLowerCase()) {
    declarationIssues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.identityMismatch,
      "naver_smartchannel.font_digest_mismatch",
      requirement.expectedSha256.toLowerCase(),
      resource.expectedSha256.toLowerCase(),
      "/font/expectedSha256",
    ));
  }
  if (requirement.expectedVersion !== undefined && resource.expectedVersion !== requirement.expectedVersion) {
    declarationIssues.push(issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.versionMismatch,
      "naver_smartchannel.font_version_mismatch",
      requirement.expectedVersion,
      resource.expectedVersion,
      "/font/expectedVersion",
    ));
  }
  if (declarationIssues.length > 0) return blockedResult(requirement, "EXTERNAL_EXACT", declarationIssues, { resolvedPath });

  let bytes: Buffer;
  try {
    bytes = await readFile(resolvedPath);
  } catch (error) {
    return blockedResult(requirement, "EXTERNAL_EXACT", [issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.unavailable,
      "naver_smartchannel.font_unavailable",
      resolvedPath,
      error instanceof Error ? error.message : String(error),
      "/font/path",
    )], { resolvedPath });
  }
  const identity = inspectFontIdentity(bytes);
  if (identity === null) {
    return blockedResult(requirement, "EXTERNAL_EXACT", [issue(
      NAVER_SMARTCHANNEL_FONT_ERROR_CODES.unavailable,
      "naver_smartchannel.font_unavailable",
      "decodable OpenType font",
      "undecodable or unsupported font binary",
      "/font/file",
    )], { resolvedPath });
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  const effectiveRequirement: SmartChannelFontRequirement = { ...requirement };
  if (requirement.expectedSha256 === undefined) effectiveRequirement.expectedSha256 = resource.expectedSha256;
  if (requirement.expectedVersion === undefined && resource.expectedVersion !== undefined) effectiveRequirement.expectedVersion = resource.expectedVersion;
  const result = evaluateFontIdentity(effectiveRequirement, "EXTERNAL_EXACT", {
    postScriptNames: identity.postScriptNames,
    digest,
    versions: identity.versions,
  });
  result.resolvedPath = resolvedPath;
  result.identity = identity;
  return result;
}

export function assertSmartChannelFallbackProhibited(fallbackAllowed: boolean): void {
  if (fallbackAllowed) throw new Error("SmartChannel strict Template Locked resolution forbids fallback");
}

export function getSmartChannelFontDirectory(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const configured = environment.NAVER_SMARTCHANNEL_FONT_DIR;
  if (!configured || !path.isAbsolute(configured) || configured.startsWith("\\\\") || configured.startsWith("//")) return null;
  return configured;
}

export function isTrustedFontReference(reference: string): boolean {
  if (reference.length === 0 || reference.includes("\0") || path.posix.isAbsolute(reference) || path.win32.isAbsolute(reference)) return false;
  if (/^[a-z][a-z\d+.-]*:/iu.test(reference) || /^[a-z]:/iu.test(reference)) return false;
  const normalized = reference.replaceAll("\\", "/");
  return !normalized.split("/").includes("..");
}
