# N7.2 Contract Clarification — SmartChannel Null Value Selection

## Problem

N7.1 diagnostics captured `TypeError: Cannot read properties of null (reading 'value')` while
the NAVER SmartChannel editor was mounted. The stack points to the SmartChannel filter render and
the `NaverDesktopEditor` component. This was a real state/event handling defect, not a Core
renderer or 120-template source-contract defect.

## Decision

1. Treat React event values as ephemeral. Every value used by a functional state updater is
   copied from `event.currentTarget.value` before the updater is scheduled.
2. Treat the 120 source-backed templates as the only candidate set. Filter options are derived
   from canonical registry order and the preceding dimension selections.
3. Reconcile child dimensions deterministically after a parent change. Keep the existing value
   when it remains valid; otherwise reset to the first valid source-backed candidate.
4. Resolve exactly one filtered template, or keep a controlled unresolved editor state with
   Preview/Download disabled. No silent fallback or Cartesian product is permitted.
5. Preserve N7.1 local diagnostics and Error Boundary behavior. Diagnostics now include the
   selected SmartChannel dimensions without recording creative bytes.

## Evidence

The pre-fix E2E regression test failed after `height=280` selection. The captured 0.9.1 log
contains the exception and component stack; the source location is the filter handler described
above. The same test passes after snapshotting the event value and reconciling selections.

## Compatibility and impact

Desktop version changes `0.9.1 → 0.9.2`. Canonical document `1.21.0`, Template Contract `1.9.0`,
Renderer Core `0.8.0`, 120-template source registry, geometry, typography, font compatibility,
CTA semantics, Kakao/FREEFORM behavior, N5/N6 source contracts and fingerprints remain unchanged.
Runtime network access remains prohibited.

## Modified sections

- Canonical §41: N7.2 SmartChannel state and event-lifetime contract.
- Desktop implementation: `NaverDesktopEditor` filter/selection handling.
- Desktop diagnostics: selected SmartChannel dimensions.
- E2E and packaged smoke: representative transitions, back-and-forth transitions and 120-template
  reachability.

