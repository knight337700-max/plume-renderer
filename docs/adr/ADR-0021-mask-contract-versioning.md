# ADR-0021: Additive mask capability versioning (historical C6/C6 v2)

- Status: Superseded for current C6b details by ADR-0019-mask-semicircle-right-analytic-mask.md and ADR-0020-logo-overlay-slot-contract.md
- Date: 2026-08-06
- Scope: Phase C6

The MASK capability is additive, so the Canonical document and Template Contract use
minor bumps (1.6.2→1.7.0 and 1.3.0→1.4.0). C6 v2 keeps the coordinates and mask bytes
unchanged while changing the logo slot to optional black PNG input, so the Canonical
document and Template Contract advance again to `1.8.0` and `1.5.0`. Ordered slot and
output metadata require the Integration Contract minor bump 1.1.0→1.2.0; optional slot
metadata advances it to `1.3.0`. Legacy 1.1 and 1.2 plans remain parse-compatible; no
existing coordinates or non-mask Golden bytes are changed.
