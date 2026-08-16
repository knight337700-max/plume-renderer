import os from "node:os";
import path from "node:path";

const DRIVE_ABSOLUTE = /(?:^|[\s"'(<])(?:[A-Za-z]:[\\/])[^\s"'<>)]*/gu;
const UNC_ABSOLUTE = /(?:^|[\s"'(<])(?:\\\\|\/\/)[^\s"'<>)]*/gu;
const UNIX_USER_HOME = /(?:^|[\s"'(<])\/(?:Users|home)\/[A-Za-z0-9._~-]+(?:[\/][^\s"'<>)]*)?/giu;
const WINDOWS_USER_HOME = /(?:^|[\s"'(<])(?:\\|\/)(?:Users|home)\\[A-Za-z0-9._~-]+(?:[\\/][^\s"'<>)]*)?/giu;
const TEMP_HOME = /(?:%[^%]*(?:TEMP|TMP)[^%]*%|(?:[\\/]|^)(?:Temp|tmp|AppData[\\/]Local[\\/]Temp)(?:[\\/]|$))/giu;
const WORKSPACE_RUNTIME = /(?:^|[\s"'(<])(?:[\\/](?:workspace|tmp)(?:[\\/]|$)|(?:[\\/]Users[\\/][^\s"'<>)]*))/giu;
const EXTERNAL_URI = /\b(?:https?|ftp|file|data|blob):\/\//giu;
const NOT_EXPOSED = /\bNOT_EXPOSED\b/gu;
const PARENT_TRAVERSAL = /(?:^|[\s"'(<\\/])\.\.(?:[\\/]|$)/gu;

function matchAll(text, expression) {
  return [...text.matchAll(expression)].map((match) => match[0].trim());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function localUsernameTokens(extra = []) {
  const candidates = [process.env.USERNAME, process.env.USER, os.userInfo?.().username, ...extra];
  return [...new Set(candidates.filter((value) => typeof value === "string" && /^[A-Za-z0-9._~-]{2,64}$/u.test(value)).map((value) => value.toLowerCase()))];
}

export function scanReviewPackText(text, options = {}) {
  if (typeof text !== "string") return { absoluteLocalPaths: [], usernameTokens: [], parentTraversalSegments: [], externalUrls: [], notExposedPlaceholders: [] };
  const absoluteLocalPaths = [...new Set([
    ...matchAll(text, DRIVE_ABSOLUTE),
    ...matchAll(text, UNC_ABSOLUTE),
    ...matchAll(text, UNIX_USER_HOME),
    ...matchAll(text, WINDOWS_USER_HOME),
    ...matchAll(text, TEMP_HOME),
    ...matchAll(text, WORKSPACE_RUNTIME),
  ])].filter((value) => !/^https?:\/\//iu.test(value));
  const tokens = localUsernameTokens(options.usernameTokens ?? []);
  const usernameFindings = tokens.filter((token) => new RegExp(`(?:^|[^A-Za-z0-9._~-])${escapeRegExp(token)}(?:$|[^A-Za-z0-9._~-])`, "iu").test(text));
  return {
    absoluteLocalPaths,
    usernameTokens: usernameFindings,
    parentTraversalSegments: [...new Set(matchAll(text, PARENT_TRAVERSAL))],
    externalUrls: [...new Set(matchAll(text, EXTERNAL_URI))],
    notExposedPlaceholders: [...new Set(matchAll(text, NOT_EXPOSED))],
  };
}

export function scanZipEntryNames(entryNames) {
  const entries = Array.isArray(entryNames) ? entryNames.filter((value) => typeof value === "string") : [];
  const zipAbsoluteEntries = entries.filter((value) => path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\") || value.startsWith("//") || value.startsWith("/") || value.startsWith("\\"));
  const zipBackslashEntries = entries.filter((value) => value.includes("\\"));
  const zipTraversalEntries = entries.filter((value) => value.replaceAll("\\", "/").split("/").some((segment) => segment === ".."));
  return {
    zipAbsoluteEntries: [...new Set(zipAbsoluteEntries)],
    zipBackslashEntries: [...new Set(zipBackslashEntries)],
    zipTraversalEntries: [...new Set(zipTraversalEntries)],
  };
}

export function assertPackRelativePath(value, label = "path") {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty relative path`);
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\") || value.startsWith("//")) throw new Error(`${label} must not be absolute`);
  const normalized = value.replaceAll("\\", "/");
  if (normalized.split("/").some((segment) => segment === "..")) throw new Error(`${label} must not traverse parent directories`);
  if (scanReviewPackText(value).absoluteLocalPaths.length > 0) throw new Error(`${label} contains a local absolute path`);
  return normalized;
}

export function logicalRootLabel(value, label = "root") {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be present`);
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\") || value.startsWith("//")) throw new Error(`${label} must be a logical label, not a local path`);
  if (!/^[A-Z][A-Z0-9_]*$/u.test(value)) throw new Error(`${label} must be an uppercase logical label`);
  return value;
}

export function buildPathNeutralExecutionIdentity({ desktopVersion, electronVersion, executablePath, isPackaged = false, buildArtifacts = [] }) {
  return {
    mode: "ELECTRON_PRODUCTION_UI_IPC_EXPORT",
    desktopVersion: String(desktopVersion ?? "unknown"),
    electronVersion: String(electronVersion ?? "unknown"),
    executableBasename: path.basename(String(executablePath ?? "electron.exe")),
    isPackaged: Boolean(isPackaged),
    buildArtifacts: buildArtifacts.map((artifact) => ({
      repositoryRelativePath: assertPackRelativePath(artifact.repositoryRelativePath, "buildArtifacts.repositoryRelativePath"),
      sha256: artifact.sha256,
    })),
  };
}

export function scanReviewPackPayload(files) {
  const findings = [];
  for (const file of files) {
    const scan = scanReviewPackText(file.text, file.options);
    const pathScan = scanZipEntryNames([file.path]);
    if (scan.absoluteLocalPaths.length || scan.usernameTokens.length || scan.parentTraversalSegments.length || scan.externalUrls.length || scan.notExposedPlaceholders.length || pathScan.zipAbsoluteEntries.length || pathScan.zipBackslashEntries.length || pathScan.zipTraversalEntries.length) findings.push({ path: file.path, ...scan, ...pathScan });
  }
  return findings;
}

export function summarizeReviewPackFindings(findings, zipFindings = {}) {
  const entries = Array.isArray(findings) ? findings : [];
  const zipAbsoluteEntries = Array.isArray(zipFindings.zipAbsoluteEntries) ? zipFindings.zipAbsoluteEntries : [];
  const zipBackslashEntries = Array.isArray(zipFindings.zipBackslashEntries) ? zipFindings.zipBackslashEntries : [];
  const zipTraversalEntries = Array.isArray(zipFindings.zipTraversalEntries) ? zipFindings.zipTraversalEntries : [];
  const summary = {
    absoluteWindowsPaths: entries.reduce((count, entry) => count + (entry.absoluteLocalPaths?.length ?? 0), 0),
    usernameTokens: entries.reduce((count, entry) => count + (entry.usernameTokens?.length ?? 0), 0),
    parentTraversalSegments: entries.reduce((count, entry) => count + (entry.parentTraversalSegments?.length ?? 0), 0),
    externalUrls: entries.reduce((count, entry) => count + (entry.externalUrls?.length ?? 0), 0),
    notExposedEntries: entries.reduce((count, entry) => count + (entry.notExposedPlaceholders?.length ?? 0), 0),
    zipAbsoluteEntries: zipAbsoluteEntries.length,
    zipBackslashEntries: zipBackslashEntries.length,
    zipTraversalEntries: zipTraversalEntries.length,
  };
  return {
    ...summary,
    clean: Object.values(summary).every((count) => count === 0),
  };
}

export function assertCleanReviewPackPayload(files, zipEntryNames = []) {
  const findings = scanReviewPackPayload(files);
  const zipFindings = scanZipEntryNames(zipEntryNames);
  const summary = summarizeReviewPackFindings(findings, zipFindings);
  if (!summary.clean) {
    const error = new Error("review-pack path hygiene violation");
    error.findings = findings;
    error.zipFindings = zipFindings;
    error.summary = summary;
    throw error;
  }
  return { findings, zipFindings, summary };
}
