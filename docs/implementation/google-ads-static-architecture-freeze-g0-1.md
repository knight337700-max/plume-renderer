# Google Ads Static Architecture Freeze — G0.1

## Result

G0.1 accepts the reviewed G0 Google Ads static capability architecture and freezes it
as architecture version `1.0.0`. This is a contract/documentation phase only. No Google
runtime profile, Renderer implementation, Validator runtime behavior, Desktop UI, Golden,
preview screenshot, or upload integration is added.

## Baseline and version changes

- Accepted G0 commit: `731b956e69700154a8b8e1c51ec9a2b7973aa07f`
- Canonical document: `1.23.1` → `1.24.0` (minor)
- Google architecture: `0.1.0` → `1.0.0` (major freeze version)
- Template contract: `1.9.0` unchanged; coordinates unchanged
- Input/output schemas: `1.2.0` / `2.0.0` unchanged
- Renderer Core / Validator: `0.9.0` / `1.9.0` unchanged
- Desktop/package: `0.10.1` unchanged

The earlier G0 implementation record and G0 verification evidence remain historical
records of the `FREEZE_CANDIDATE` state. The current Canonical section, freeze registry,
this record, and final handoff are the only G0.1 current-state records and report
`FROZEN`.

## Frozen authoritative records

`contracts/google/architecture-freeze.g0.1.json` pins the six authoritative G0 records
by sorted repository-relative path, freeze version, semantic role, and SHA-256. The
registry does not contain its own SHA-256. Frozen counts are:

- capabilities: 7
- Demand Gen uploaded-display recommended presets: 7
- legacy Display canvases: 20
- unresolved rules: 9
- proposed diagnostics: 11

All nine unresolved rules remain `UNRESOLVED_FAIL_CLOSED`. The composition boundary,
Renderer/Google ownership boundary, `SINGLE` artifact versus `COLLECTION` delivery-set
meaning, official-versus-project classification, FREEFORM reuse matrix, lifecycle, and
excluded scopes are unchanged from G0.

## Invariants and gate

Google runtime profiles, Renderer code, Validator runtime behavior, Desktop UI, Goldens,
upload integration, runtime network access, and Plume dependencies remain respectively
absent, absent, absent, absent, absent, absent, `PROHIBITED`, and empty. KAKAO, NAVER,
and META static output remains unchanged. G1 is open only when the G0.1 freeze verifier
reports PASS for every check.

## Verification

The deterministic verifier is `scripts/verify-g0-1-google-architecture-freeze.mjs`.
The final run records contract parsing, registry ordering and hashes, runtime absence,
frozen-channel diff isolation, OBJECT_RIGHT SHA-256, and the G1 gate. Full `pnpm check`,
the contract verifier, full Vitest, full Playwright, and the handoff verifier remain
required before commit.

Runtime network requests: `0`. Plume integration: not started. **[PROJECT]**
