import type { ValidationIssue } from "../../../../../../src/core/types.js";

import koMessages from "../../i18n/ko-KR.json" with { type: "json" };

const messages = koMessages as Record<string, string>;

export function hasIssueMessageTranslation(messageKey: string): boolean {
  return typeof messages[messageKey] === "string" && messages[messageKey].length > 0;
}

export function localizedMessage(messageKey: string): string {
  return messages[messageKey] ?? `등록된 번역이 없습니다: ${messageKey}`;
}

export function issueMessage(issue: ValidationIssue): string {
  const base = localizedMessage(issue.messageKey);
  if (!issue.actual || typeof issue.actual !== "object") return base;
  const actual = issue.actual as Record<string, unknown>;
  if (issue.code.startsWith("KBR-TEXT-COUNT-") && typeof actual.actual === "number") {
    return `${base} 현재 ${actual.actual}자입니다.`;
  }
  if (issue.code === "KBR-TEXT-004" || issue.code === "KBR-TEXT-005") {
    if (typeof actual.actualWidthPx === "number" && typeof actual.limitWidthPx === "number") {
      return `${base} 현재 ${actual.actualWidthPx}px / 최대 ${actual.limitWidthPx}px입니다.`;
    }
  }
  if (issue.code === "KBR-TEXT-WIDTH-HEADLINE-W001" || issue.code === "KBR-TEXT-WIDTH-SUBCOPY-W001") {
    if (typeof actual.actualWidthPx === "number" && typeof actual.limitWidthPx === "number") {
      return `${base} 현재 ${actual.actualWidthPx}px / 최대 ${actual.limitWidthPx}px입니다.`;
    }
  }
  if (issue.code === "KBR-FREEFORM-FILE-SIZE-EXCEEDED") {
    const expected = issue.expected && typeof issue.expected === "object"
      ? issue.expected as Record<string, unknown>
      : {};
    if (typeof actual.bytes === "number" && typeof expected.maximumBytes === "number") {
      return `${base} 현재 ${actual.bytes} bytes / 최대 ${expected.maximumBytes} bytes입니다.`;
    }
  }
  if (issue.code === "NAVER_SMARTCHANNEL_ASSET_DIMENSION_MISMATCH") {
    const normalized = actual.normalizedSize;
    const finalBounds = actual.finalBounds;
    if (normalized && typeof normalized === "object") {
      const size = normalized as Record<string, unknown>;
      const finalSize = finalBounds && typeof finalBounds === "object" ? finalBounds as Record<string, unknown> : {};
      return `${base} 정규화 ${String(size.width ?? "?")}×${String(size.height ?? "?")}px, 최종 ${String(finalSize.width ?? "?")}×${String(finalSize.height ?? "?")}px입니다.`;
    }
  }
  if (issue.code === "NAVER_SMARTCHANNEL_OBJECT_OUT_OF_REGION") {
    const finalBounds = actual.finalBounds;
    const targetRegion = actual.targetRegion;
    if (finalBounds && typeof finalBounds === "object" && targetRegion && typeof targetRegion === "object") {
      const bounds = finalBounds as Record<string, unknown>;
      const region = targetRegion as Record<string, unknown>;
      return `${base} 최종 bounds (${String(bounds.x ?? "?")},${String(bounds.y ?? "?")},${String(bounds.width ?? "?")}×${String(bounds.height ?? "?")}), 지정 영역 (${String(region.x ?? "?")},${String(region.y ?? "?")},${String(region.width ?? "?")}×${String(region.height ?? "?")})입니다.`;
    }
  }
  if (issue.code === "NAVER_SMARTCHANNEL_FONT_UNAVAILABLE") {
    const expected = issue.expected && typeof issue.expected === "object" ? issue.expected as Record<string, unknown> : {};
    const expectedId = expected.fontId ?? expected.requiredFont;
    if (expectedId !== undefined) return `${base} 필요 폰트: ${String(expectedId)}.`;
  }
  if (issue.code === "NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID") {
    const expected = issue.expected && typeof issue.expected === "object" ? issue.expected as Record<string, unknown> : {};
    const componentId = actual.componentId ?? expected.componentId ?? "?";
    const reason = actual.failureReason ?? expected.failureReason ?? "UNKNOWN";
    const expectedDigest = expected.expectedDigest;
    const actualDigest = actual.actualDigest;
    const digestDetail = expectedDigest && actualDigest ? ` 예상 digest ${String(expectedDigest)} / 실제 ${String(actualDigest)}` : "";
    return `${base} 구성요소: ${String(componentId)}, 사유: ${String(reason)}.${digestDetail}`;
  }
  return base;
}

export function fieldHasError(errors: readonly ValidationIssue[], pointerPrefix: string): boolean {
  return errors.some(({ path, severity }) => severity === "ERROR" && path.startsWith(pointerPrefix));
}
