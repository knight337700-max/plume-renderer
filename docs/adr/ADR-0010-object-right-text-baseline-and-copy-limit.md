# ADR-0010: OBJECT_RIGHT Text Baseline and Copy Limit

- Status: Accepted
- Date: 2026-08-06
- Scope: Core Renderer, Internal Preview, Desktop UI

## Context

Phase C2 comparison showed the two active CTA-NONE text rows were approximately four pixels above the comparison material. The implementation also lacked one Core-owned contract for grapheme-based Korean-equivalent counts and actual raster ink width.

## Decision

- Set Headline baseline to `120` and Subcopy baseline to `178`; this is a project/inferred amendment, not an official Kakao absolute coordinate claim.
- Keep text X at `48`, hard right edge exclusive at `633`, and derive the maximum occupied width as `585px`.
- Use NFC plus `Intl.Segmenter` grapheme clusters. CJK, kana, fullwidth, and emoji graphemes count as `1.0`; ASCII and halfwidth Latin count as `0.5`; U+0020 counts as `0`.
- Enforce Headline `12.0` and Subcopy `15.0` Korean-equivalent units.
- Use actual rasterized alpha ink bounds for width. `527..585px` is WARNING; `586px+` or right edge overflow is ERROR.
- Preserve consecutive internal spaces and report a WARNING. Do not auto-shorten, wrap, scale, kern, crop, or insert ellipsis.
- Reuse existing hard-edge codes `KBR-TEXT-004` and `KBR-TEXT-005`; add only count and spacing/width-warning codes needed for distinct meanings.
- Keep Preview and Export on the same Core pipeline. UI displays returned metrics and does not independently calculate or enforce limits.

## Consequences

The Template Contract increments to `1.2.0` and the Canonical document to `1.3.0`. Input/Output/Manifest/Response schema versions remain unchanged. The Golden PNG digest changes because only the text rows move; the product region and transparent right margin remain unchanged.
