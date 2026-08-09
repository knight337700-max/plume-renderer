# NAVER SmartChannel Source Resolution Gate v1

Status: SOURCE RESOLVED / N2 BLOCKED BY RUNTIME FONT MISMATCH
Phase: N1C
Canonical document: `docs/kakao-bizboard-renderer-spec-v1.md` §33

## 문제

N1B는 120개 PSD의 provenance와 template identity를 고정했지만 PSD text-layer metadata,
source font identity, landing icon/CTA asset digest, 160 disclosure geometry, 200 icon y 편차,
현재 280 guide revision, 260 guide semantics를 아직 source-backed 상태로 연결하지 못했다.

## 결정

1. 현재 공식 SmartChannel 다운로드와 외부 PSD root를 SHA-256 집합으로 교차검증한다. 공식
   outer ZIP은 `620ee9c4e6ff421e5d57a05e8de65f7da04294043dc9e9f21581fa6209fbbc1a`이며
   비-Mac PSD 120개와 local PSD 120개가 120/120 일치한다.
2. `psd-tools==1.18.0` 기반 local-only extractor가 120 PSD의 layer tree, text engine,
   transform/origin, source font PostScript name 및 fixed source layer를 deterministic JSON으로
   저장한다. PSD/OS/Adobe cache에서 font binary를 복사하지 않는다.
3. PSD source font identity는 `AppleSDGothicNeo-*`, `SF*` PostScript name으로 확정한다.
   기존 Spoqa OFL assets는 합법적 runtime resource지만 source exact match가 아니므로
   `LICENSED_BUT_NOT_SOURCE_MATCH`로 명시한다.
4. 공식 PSD의 landing icon, CTA labels/chevron/button source layer만 추출하고 raw/trimmed
   pixel digest 및 PNG asset digest를 registry에 연결한다. 새 icon, label, color combination,
   landing compatibility 조합은 생성하지 않는다.
5. 160 `심의필만2줄`의 baseline/origin과 24px disclosure gap은 exact metadata로 FROZEN한다.
   200 icon의 raw digest는 동일하고 y=85/86만 달라 `PSD_AUTHORING_INCONSISTENCY`로 분류한다.
6. 현재 공식 280 thumbnail rule은 `200×200`으로 FROZEN한다. 로고 상/하 24px, 260 guide,
   export registration, 750×200 placement 종료는 validation/placement metadata로 defer한다.

## 근거

- [SmartChannel 공식 가이드](https://ads.naver.com/adguide/1475), page update 2026-05-22
- [750×280 도입 공지](https://ads.naver.com/notice/22349), 2025-06-03
- [2026-06-01 SmartChannel 조정 공지](https://ads.naver.com/notice/31978)
- PSD source revision registry: `contracts/naver-smartchannel-source-revision.json`
- PSD metadata registry: `contracts/naver-smartchannel-psd-metadata.json`
- Fixed components: `contracts/naver-smartchannel-fixed-components.json`
- CTA options: `contracts/naver-smartchannel-cta-options.json`

## 영향 범위

- Canonical document: `1.13.0 → 1.14.0`
- Template Contract: `1.7.0 → 1.8.0`
- Integration Contract: `1.8.0` unchanged
- CreativeLayoutPlan `1.0.0`, Desktop `0.8.2` unchanged
- N1C is contract/source tooling only; SmartChannel runtime and UI remain unimplemented.

## 호환성

기존 Kakao/FREEFORM input, output, manifest, PNG/JPEG bytes, fingerprints, legacy serialization
및 Desktop behavior에는 의도된 변경이 없다. Naver registry fields are additive and source-only.

## 미해결 Blocker

- Spoqa runtime font binaries are licensed but not exact source PSD font matches.
- Therefore N2 pixel Golden runtime font gate remains blocked.

## 비차단 Defer

- `260(최대)` guide semantics → N3 Validator
- official 280 logo vertical margin 24 → validation stage
- final registration byte/metadata/compression semantics → validator/export stage
- 750×200 placement availability → placement metadata

## 원본 명세의 변경 섹션

- Canonical §33 added for current guide/source revision, PSD metadata, typography, fixed UI,
  special geometry, deferrals, versioning and N2 readiness.
- `contracts/contract-versions.json` adds `canonicalPhaseN1C`.
