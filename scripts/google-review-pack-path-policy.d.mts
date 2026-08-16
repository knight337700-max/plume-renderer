export interface ReviewPackTextScan {
  absoluteLocalPaths: string[];
  usernameTokens: string[];
  parentTraversalSegments: string[];
  externalUrls: string[];
  notExposedPlaceholders: string[];
}

export interface ReviewPackPayloadFile {
  path: string;
  text: string;
  options?: { usernameTokens?: string[] };
}

export interface ZipEntryScan {
  zipAbsoluteEntries: string[];
  zipBackslashEntries: string[];
  zipTraversalEntries: string[];
}

export interface ReviewPackFindingSummary extends ZipEntryScan {
  absoluteWindowsPaths: number;
  usernameTokens: number;
  parentTraversalSegments: number;
  externalUrls: number;
  notExposedEntries: number;
  clean: boolean;
}

export interface PathNeutralExecutionIdentity {
  mode: string;
  desktopVersion: string;
  electronVersion: string;
  executableBasename: string;
  isPackaged: boolean;
  buildArtifacts: Array<{ repositoryRelativePath: string; sha256?: string }>;
}

export declare function localUsernameTokens(extra?: string[]): string[];
export declare function scanReviewPackText(text: string, options?: { usernameTokens?: string[] }): ReviewPackTextScan;
export declare function scanZipEntryNames(entryNames: string[]): ZipEntryScan;
export declare function assertPackRelativePath(value: string, label?: string): string;
export declare function logicalRootLabel(value: string, label?: string): string;
export declare function buildPathNeutralExecutionIdentity(input: {
  desktopVersion?: string;
  electronVersion?: string;
  executablePath?: string;
  isPackaged?: boolean;
  buildArtifacts?: Array<{ repositoryRelativePath: string; sha256?: string }>;
}): PathNeutralExecutionIdentity;
export declare function scanReviewPackPayload(files: ReviewPackPayloadFile[]): Array<ReviewPackTextScan & { path: string }>;
export declare function summarizeReviewPackFindings(findings: Array<ReviewPackTextScan & { path: string }>, zipFindings?: Partial<ZipEntryScan>): ReviewPackFindingSummary;
export declare function assertCleanReviewPackPayload(files: ReviewPackPayloadFile[], zipEntryNames?: string[]): { findings: Array<ReviewPackTextScan & { path: string }>; zipFindings: ZipEntryScan; summary: ReviewPackFindingSummary };
