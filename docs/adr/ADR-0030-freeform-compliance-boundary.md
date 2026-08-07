# ADR-0030: FREEFORM compliance boundary

- Status: Accepted
- Date: 2026-08-08
- Scope: `[PROJECT]` FREEFORM Validator F2

## Context

A freeform renderer can be mistaken for a creative reviewer or an automatic layout planner.
That would make undocumented visual preferences appear to be official media rules.

## Decision

The Validator checks only contract and artifact facts: schema, Profile identity, bounds,
z-order, asset bytes, MIME/decode/dimensions, placement declarations, registered font
digests, text metrics/colors/wrap/overflow, logo transparency, PNG format/dimensions, and
applied evidence. It does not judge size, alignment preference, copy quality, composition,
branding, contrast, or visual appeal.

There is no silent clamp, default layout generation, crop inference, invalid-color fallback,
font fallback, auto-shrink, or JPG-to-PNG downgrade. Unsupported WORD_WRAP, SHAPE raster,
and JPG output are explicit PRE_RENDER errors.

## Consequences

Manual and Agent plans with identical layout values use the same rules and can produce byte-
equal pixels. Creative QA and planning remain separate callers. New rules require an explicit
contract change rather than an implementation preference.

## Alternatives rejected

- Heuristic aesthetic warnings: not canonical and not deterministic across runtimes.
- Auto-correction: hides invalid input and changes the requested layout.
- Agent-dependent validation: violates the Core's Agent-independent execution boundary.
