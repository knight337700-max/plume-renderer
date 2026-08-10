# Phase N7.3 — SmartChannel Headline Input Reset Hotfix

## Root-cause evidence

The N7.3 regression was reproduced before the fix with the new Playwright test in
`tests/e2e/naver-desktop.spec.ts`. A user value survived a 2.5 second render/debounce wait, but
clearing the controlled `headline` input immediately restored `브랜드의 새로운 시작`.

The exact write/read path was:

```text
NaverDesktopEditor.smartContent[field]
  → SmartChannel input value={smartContent[field] || DEFAULT_TEXT[field] || ""}
  → empty string is falsy
  → DEFAULT_TEXT.headline is rendered again
```

The preview request builder contained the same fallback for `smartContent[key]`. No async preview
result wrote content back into state; the defect was a Desktop `VALUE_FALLBACK`, not a Core,
template, or renderer race.

## Fix

- Seed `smartContent` once with a lazy `DEFAULT_TEXT` initializer.
- Make `smartContent` the sole editor-owned content state.
- Read controlled values with nullish semantics (`smartContent[field] ?? ""`); an explicit empty
  string is therefore preserved.
- Build SmartChannel preview/export content from the same state without `|| DEFAULT_TEXT`
  fallback or preview writeback.
- Keep selection state, content state, and preview state separate. Existing compatible template
  transitions do not clear content.
- Apply the same state path to headline, subcopy, headlineLine2, subcopyLine4, disclosureLine1,
  disclosureLine2, and ctaOption fields.

## Verification boundary

This is a Desktop UI/state hotfix only. Renderer Core pixels, SmartChannel geometry/typography,
font policy, CTA assets/semantics, Kakao, FREEFORM, N4, N5, N6, collection contracts, and runtime
network policy are unchanged. Desktop advances `0.9.2 → 0.9.3`; Renderer Core remains `0.8.0`;
Canonical document and Template Contract remain `1.21.0` and `1.9.0`.

## Acceptance coverage

- Pre-fix E2E fails on the explicit-empty assertion; post-fix E2E passes.
- Custom Korean copy survives a 2.5 second wait, compatible SmartChannel filter/template
  transitions, and a preview request.
- Empty string survives the same wait and preview request.
- Unicode Korean rapid-input path uses Playwright `keyboard.insertText` and remains stable.
- All seven SmartChannel text field paths are exercised against source-backed template variants.
- Packaged smoke covers unpacked and portable 120-template reachability plus copy persistence.

## Recorded verification

- Pre-fix targeted E2E: failed at the explicit-empty assertion (received the default headline).
- Post-fix full `pnpm check`: 38 Vitest files / 246 tests passed and 26 Playwright tests passed.
- `pnpm smoke:desktop`: unpacked and portable both passed 8 placements, 120/120 templates,
  seven text fields, custom/empty/Korean input, compatible-template transition, Feed and KAKAO
  regression, and renderer error count 0.
- `pnpm smoke:package`: both packaged executables passed existing Core fingerprint checks and
  runtime network request count 0.
- Package: `release/Kakao-Bizboard-Local-Renderer-0.9.3-x64.exe`
- SHA-256: `8e8e9516f9512f3c393fd7cb2cfd32e9a27dd36b8ddbfaaa4c10b6641fd576aa`
- Size: `126294716` bytes
