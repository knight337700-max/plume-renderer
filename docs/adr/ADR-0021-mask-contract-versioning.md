# ADR-0021: Additive mask capability versioning

- Status: Accepted
- Date: 2026-08-06
- Scope: Phase C6

The MASK capability is additive, so the Canonical document and Template Contract use
minor bumps (1.6.2→1.7.0 and 1.3.0→1.4.0). Ordered slot and output metadata require the
Integration Contract minor bump 1.1.0→1.2.0. Legacy 1.1 plans remain parse-compatible;
no existing coordinates or Golden bytes are changed.
