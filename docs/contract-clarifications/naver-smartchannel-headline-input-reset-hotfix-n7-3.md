# N7.3 Contract Clarification — SmartChannel Editor Content Ownership

## Problem

SmartChannel `headline` input content could revert to its default after the user cleared the
field. The controlled input used a truthiness fallback, so an intentional empty string was
interpreted as missing content. The preview payload used the same fallback, making the behavior
ambiguous at the UI/Core boundary.

## Decision

1. `smartContent` is the only Desktop editor-owned SmartChannel text state.
2. Defaults are materialized once when the editor state is initialized. They are not re-applied
   during render, filter reconciliation, template selection, preview, or export.
3. `undefined` means a field has no seeded value; `""` is a valid explicit user value. Controlled
   inputs and request builders use nullish semantics and preserve the empty string.
4. Selection state, content state, and preview state are independent. Compatible template changes
   preserve content keys; fields not present in the selected template remain stored for later use.
5. Preview and export read content but never write a default or response value back into the editor.
6. The policy applies uniformly to headline, subcopy, headlineLine2, subcopyLine4,
   disclosureLine1, disclosureLine2, and ctaOption.

## Evidence

The pre-fix N7.3 E2E test failed at the immediate empty-value assertion and received the default
headline. After replacing `|| DEFAULT_TEXT` with one-time initialization plus nullish reads, the
same test passed through a 2.5 second wait, compatible filter transitions, preview request,
explicit empty value, and Korean Unicode input.

## Compatibility and impact

Desktop version changes `0.9.2 → 0.9.3`. Canonical document `1.21.0`, Template Contract `1.9.0`,
Renderer Core `0.8.0`, SmartChannel 120-template registry, geometry, typography, font
compatibility, CTA semantics, Kakao/FREEFORM behavior, N5/N6 source contracts, and fingerprints
remain unchanged. Runtime network access remains prohibited.

## Unresolved blockers

None for this Desktop state fix. Native Apple SD Gothic Neo asset policy and any unresolved
official NAVER platform UI remain outside this hotfix and are not changed.

## Modified sections

- Canonical §42: N7.3 SmartChannel editor content ownership and reset policy.
- `NaverDesktopEditor`: one-time default hydration and nullish content reads.
- N7.3 E2E and packaged smoke: custom, empty, Korean input, preview, compatible-template, and
  all-text-field persistence coverage.
