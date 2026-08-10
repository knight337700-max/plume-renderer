# Phase N7.2 — SmartChannel Null Value Selection Hotfix

## Root-cause evidence

The existing 0.9.1 local diagnostic log captured the reported exception before this fix:

```text
TypeError: Cannot read properties of null (reading 'value')
at kbr-app://app/assets/index-CzpUGj1H.js:9:116119
component stack: NaverDesktopEditor -> RendererErrorBoundary
```

The minified location maps to the SmartChannel filter `<select>` render. The source handler was
equivalent to:

```ts
onChange={(event) => setFilters((previous) => ({
  ...previous,
  [key]: event.currentTarget.value,
}))}
```

React executes the functional state updater after the event callback has returned. At that point
`event.currentTarget` is `null`, so the delayed updater read `null.value`. The same event-lifetime
pattern existed in SmartChannel text field updates and was corrected at the same boundary.

The pre-fix regression test reproduced the failure by selecting the `height=280` filter: the
SmartChannel editor disappeared into the N7.1 Error Boundary fallback and the focused test failed.

## Fix

- Snapshot `event.currentTarget.value` before entering every SmartChannel functional state updater.
- Derive filter options from the source-backed 120-template registry using the ordered prefix
  `height → family → objectKind → side → textVariant → affordance`.
- Reconcile downstream filters after an upstream change: preserve a valid value, otherwise select
  the first candidate in canonical registry order.
- Resolve the selected template from the filtered candidate set and use that resolved ID for
  preview/export requests. No unsupported Cartesian product or profile fallback is introduced.
- Keep a controlled unresolved state that leaves the editor shell mounted and disables Preview.
- Extend local diagnostics context with height, family, object kind, side, text variant and
  affordance for future SmartChannel errors.

## Verification boundary

The change is Desktop UI/state handling only. Core renderer source, SmartChannel 120 contract,
geometry, typography, font policy, CTA semantics, Kakao rendering, FREEFORM rendering, N5/N6
source contracts, collection semantics and fingerprints were not changed. Desktop advances from
`0.9.1` to `0.9.2`; canonical document remains `1.21.0` and Core remains `0.8.0`.

## Package evidence

- `pnpm exec playwright test tests/e2e/naver-desktop.spec.ts`: 7 passed.
- `pnpm smoke:desktop`: unpacked and portable EXE both passed 8 placements, SmartChannel registry
  120/120 UI reachability, representative and back-and-forth transitions, Feed IMAGE/COLLECTION/
  VIDEO, KAKAO transition, renderer error count 0 and local diagnostics.
- Package: `release/Kakao-Bizboard-Local-Renderer-0.9.2-x64.exe`
- SHA-256: `9bf2e6b58c1019352de8e012ed65e7250e0e59a9986af73078a2a64a7a98d387`
- Size: `126294656` bytes
