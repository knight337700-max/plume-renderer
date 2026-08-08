export type PreviewImageFormat = "PNG" | "JPEG";
export type PreviewImageMimeType = "image/png" | "image/jpeg";

export type PreviewArtifact = Readonly<{
  format: PreviewImageFormat;
  mimeType: PreviewImageMimeType;
  width: number;
  height: number;
  byteLength: number;
  artifactDigest: string;
}>;

export type PreviewEligibility = Readonly<{
  hasRenderableArtifact: boolean;
  previewAllowed: boolean;
  publishAllowed: boolean;
  downloadAllowed: boolean;
}>;

type EligibilityIssue = Readonly<{
  severity: "ERROR" | "WARNING" | "INFO";
  stage?: "PRE_RENDER" | "POST_RENDER";
}>;

export function previewMimeType(format: PreviewImageFormat): PreviewImageMimeType {
  return format === "JPEG" ? "image/jpeg" : "image/png";
}

export function resolvePreviewEligibility(
  issues: readonly EligibilityIssue[],
  hasRenderableArtifact: boolean,
): PreviewEligibility {
  const errors = issues.filter((issue) => issue.severity === "ERROR");
  const hasPreRenderError = errors.some((issue) => issue.stage !== "POST_RENDER");
  const previewAllowed = hasRenderableArtifact && !hasPreRenderError;
  const publishAllowed = previewAllowed && errors.length === 0;
  return {
    hasRenderableArtifact,
    previewAllowed,
    publishAllowed,
    downloadAllowed: publishAllowed,
  };
}
