# ADR-0046: Keep N1D.1 Fonts Local-Only and Retain SF Source Requirements

- Status: Accepted with blocker — N1D.1
- Date: 2026-08-09

## Context

The user supplied the `fonts-archive/AppleSDGothicNeo` GitHub repository as a possible local
external source. The downloaded TTF filenames look exact, but their SFNT tables identify
`AppleSDGothicNeoB00`, `M00`, `R00`, and `SB00`, not the six PSD source identities. PSD metadata
also shows SFPro/SFUI layers as hidden English text variants in `TEXT`/`HEADLINE`, not guide groups.

## Decision

Keep all four TTFs under ignored `.local-fonts/naver-smartchannel/` only. Do not claim a
redistribution license, copy them into the repository, bundle them, or substitute them for the
source fonts. Keep both SF families in the required runtime source inventory and classify them as
`EXPORT_RENDERED_TEXT`.

## Consequence

The local resource contract and SF audit are reproducible, but N2 remains blocked until lawful
exact runtime identities are supplied. No renderer, UI, installer, or Golden is added.
