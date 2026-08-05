import type { ValidationIssue } from "../../../../../../src/core/types.js";

import koMessages from "../../i18n/ko-KR.json" with { type: "json" };

const messages = koMessages as Record<string, string>;

export function issueMessage(issue: ValidationIssue): string {
  return messages[issue.messageKey] ?? `등록된 번역이 없습니다: ${issue.messageKey}`;
}

export function fieldHasError(errors: readonly ValidationIssue[], pointerPrefix: string): boolean {
  return errors.some(({ path, severity }) => severity === "ERROR" && path.startsWith(pointerPrefix));
}
