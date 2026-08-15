export interface ReviewPackTextScan {
  absoluteLocalPaths: string[];
  externalUrls: string[];
  notExposedPlaceholders: string[];
}

export interface ReviewPackPayloadFile {
  path: string;
  text: string;
}

export interface PathNeutralExecutionIdentity {
  mode: string;
  desktopVersion: string;
  electronVersion: string;
  executableBasename: string;
  isPackaged: boolean;
  buildArtifacts: Array<{ repositoryRelativePath: string; sha256?: string }>;
}

export declare function scanReviewPackText(text: string): ReviewPackTextScan;
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
