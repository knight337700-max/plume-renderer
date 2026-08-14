# ADR-0064: Correct the G0.1 verifier for the additive Google Desktop QA surface (G3.0.1)

- Status: Accepted and implemented
- Date: 2026-08-15
- Phase: G3.0.1

## Context

G0.1 freezes the pre-Google KAKAO/NAVER/META runtime and Golden paths by comparing the accepted
baseline with `HEAD`. G3 intentionally adds Google Desktop QA files under `apps/desktop`, but the
historical verifier only knew about the G1/G2 Core and G2.1 Golden exceptions. Consequently, a
correct G3 tree failed `frozen_channel_paths` even though no frozen channel output changed.

## Decision

When the contract version registry explicitly marks G3 Desktop QA as implemented, the G0.1
verifier excludes exactly these eight G3 Desktop files from its historical frozen-channel diff:

- `apps/desktop/electron-main/src/desktop-controller.ts`
- `apps/desktop/electron-main/src/ipc/schemas.ts`
- `apps/desktop/renderer-ui/src/app/App.tsx`
- `apps/desktop/renderer-ui/src/features/google/GoogleStaticEditor.tsx`
- `apps/desktop/renderer-ui/src/i18n/ko-KR.json`
- `apps/desktop/renderer-ui/src/styles.css`
- `apps/desktop/shared/src/index.ts`
- `apps/desktop/shared/src/types.ts`

The exception is exact and phase-gated. It does not permit arbitrary Desktop files, unrelated
channel changes, Google upload/API code, or network dependencies. A dedicated G3.0.1 verifier
proves the allowlist, lineage, frozen hashes, G3 regression, and scope together.

## Consequences

- G0.1 remains a useful historical freeze guard after G3.
- The G3 Desktop implementation is accepted by the verifier without weakening KAKAO/NAVER/META
  protection.
- No public contract or version changes are required.
- Future Desktop feature phases must add their own explicit allowlist or revision rather than
  relying on a broad path exception.

## Rejected alternatives

- Allowing every `apps/desktop/**` file: too broad and could hide unrelated regressions.
- Removing `frozen_channel_paths`: would disable a required frozen-output invariant.
- Changing the Canonical document or Google registries: unrelated to a verifier-only defect.
