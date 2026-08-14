# Google Static Desktop QA verifier compatibility revision (G3.0.1)

Status: `IMPLEMENTED` · Phase `G3_0_1_GOOGLE_STATIC_DESKTOP_QA_REVISION`

## Problem

The historical G0.1 architecture-freeze verifier compares the accepted G0.1 baseline with the
current tree to protect KAKAO, NAVER, and META output paths. After G3 added the Desktop Google QA
surface, `frozen_channel_paths` reported the eight legitimate G3 Desktop files as frozen-channel
changes. The G3 Core, Golden, and Desktop implementation themselves were already covered by their
phase contracts; the failure was a verifier compatibility defect.

## Decision

Keep the G0.1 guard fail-closed and add an exact, phase-gated allowlist for the eight G3 Desktop
files. The exception is active only when `contracts/contract-versions.json` records the implemented
G3 phase. No broad `apps/desktop/**` or Google substring allowlist is used, so an unrelated Desktop
or channel change remains a failure.

The revision also adds `scripts/verify-g3-0-1-google-static-desktop-qa.mjs`, a deterministic
regression wrapper that checks the G0.1 allowlist, G3 lineage, canonical and frozen reference
hashes, runtime boundaries, frozen-channel scope, and the 34-check G3 verifier. It is exposed as
`pnpm verify:g3-0-1-google`.

## Contract impact

This is a verifier-only compatibility correction. It does not change the Canonical document,
template coordinates, Input/Output/manifest/response schemas, Google architecture/profile/Golden
registries, Renderer Core, Validator, Desktop package version, diagnostic semantics, or any PNG
bytes. The Canonical document remains `1.28.0` with SHA-256
`47e0f7d1b41f2c7893522200f80aa8ab14c1b7cf5211aad90bdf8106bbd78109`.

## Verification

- `pnpm verify:g3-0-1-google`: `PASS` (14/14)
- `pnpm verify:g0-1-google`: `PASS` (21/21)
- `pnpm verify:g3-google`: `PASS` (34/34; 14/14 byte-equal Goldens)
- `pnpm check`: `PASS`
- G2.1 Golden registry SHA-256 remains
  `00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359`.
- `OBJECT_RIGHT.png` SHA-256 remains
  `33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b`.
- Runtime network access, Google upload/API, OAuth, and Plume dependencies remain prohibited or
  absent.

The next phase is `G3_1_GOOGLE_STATIC_DESKTOP_USER_QA_AND_FREEZE`. Its review baseline must use the
new full source commit and a regenerated handoff, while retaining the unchanged Canonical SHA and
frozen Google registry identity.
