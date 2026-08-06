import type { ValidationIssue } from "../../../../../../src/core/types.js";

import koMessages from "../../i18n/ko-KR.json" with { type: "json" };

const messages = koMessages as Record<string, string>;

export function issueMessage(issue: ValidationIssue): string {
  const base = messages[issue.messageKey] ?? `등록된 번역이 없습니다: ${issue.messageKey}`;
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
  return base;
}

export function fieldHasError(errors: readonly ValidationIssue[], pointerPrefix: string): boolean {
  return errors.some(({ path, severity }) => severity === "ERROR" && path.startsWith(pointerPrefix));
}
