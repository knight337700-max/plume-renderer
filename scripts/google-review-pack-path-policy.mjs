import path from "node:path";

const DRIVE_ABSOLUTE = /(?:^|[\s"'(<])(?:[A-Za-z]:[\\/])[^\s"'<>)]*/gu;
const UNC_ABSOLUTE = /(?:^|[\s"'(<])(?:\\\\|\/\/)[^\s"'<>)]*/gu;
const UNIX_USER_HOME = /(?:^|[\s"'(<])\/(?:Users|home)\/[A-Za-z0-9._~-]+(?:[\/][^\s"'<>)]*)?/giu;
const WINDOWS_USER_HOME = /(?:^|[\s"'(<])(?:\\|\/)(?:Users|home)\\[A-Za-z0-9._~-]+(?:[\\/][^\s"'<>)]*)?/giu;
const TEMP_HOME = /(?:%[^%]*(?:TEMP|TMP)[^%]*%|(?:[\\/]|^)(?:Temp|tmp|AppData[\\/]Local[\\/]Temp)(?:[\\/]|$))/giu;
const EXTERNAL_URI = /\b(?:https?|ftp|file|data|blob):\/\//giu;
const NOT_EXPOSED = /\bNOT_EXPOSED\b/gu;

function matchAll(text, expression) {
  return [...text.matchAll(expression)].map((match) => match[0].trim());
}

export function scanReviewPackText(text) {
  if (typeof text !== "string") return { absoluteLocalPaths: [], externalUrls: [], notExposedPlaceholders: [] };
  const absoluteLocalPaths = [...new Set([
    ...matchAll(text, DRIVE_ABSOLUTE),
    ...matchAll(text, UNC_ABSOLUTE),
    ...matchAll(text, UNIX_USER_HOME),
    ...matchAll(text, WINDOWS_USER_HOME),
    ...matchAll(text, TEMP_HOME),
  ])].filter((value) => !/^https?:\/\//iu.test(value));
  return {
    absoluteLocalPaths,
    externalUrls: [...new Set(matchAll(text, EXTERNAL_URI))],
    notExposedPlaceholders: [...new Set(matchAll(text, NOT_EXPOSED))],
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
    const scan = scanReviewPackText(file.text);
    if (scan.absoluteLocalPaths.length || scan.externalUrls.length || scan.notExposedPlaceholders.length) findings.push({ path: file.path, ...scan });
  }
  return findings;
}
