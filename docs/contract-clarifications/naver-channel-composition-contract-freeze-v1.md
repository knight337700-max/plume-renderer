# N1A — NAVER Channel Namespace / Composition Contract Clarification

Status: FROZEN · Canonical document `1.12.0` · Integration Contract `1.7.0` · Error Registry `1.3.0` · Template Contract `1.6.0`

## 문제

기존 Renderer의 `LayoutMode`(`TEMPLATE_LOCKED | FREEFORM`)는 Renderer가 최종
raster를 만드는 형식은 표현하지만, source components를 NAVER 플랫폼이 최종 UI로
조합하는 placement를 구분하지 못한다. 또한 channel namespace, channel-scoped
placement, 향후 Collection cardinality를 미리 표현할 계약 축이 없었다.

## 결정

- canonical channel namespace에 기존 `KAKAO_MOMENT`를 유지하고 `NAVER_GFA`를
  additive하게 추가한다.
- placement는 global enum으로 합치지 않고 channel-scoped identifier로 저장한다.
- `CompositionMode = RENDERER_COMPOSED | PLATFORM_COMPOSED`를 LayoutMode와
  직교하는 축으로 추가한다.
- `RENDERER_COMPOSED`는 `layoutMode`를 요구한다. `PLATFORM_COMPOSED`는 final
  raster layout을 가정하지 않는다.
- `ArtifactCardinality = SINGLE | COLLECTION`을 예약한다. 현재 구현된 모든
  Kakao/FREEFORM profile은 `SINGLE`이며 `COLLECTION` runtime은 구현하지 않는다.
- N1A의 NAVER registry는 placement semantics만 보유한다. PSD, canvas, 좌표,
  typography, CTA/icon, disclosure, raster, Golden, Desktop selector는 등록하지
  않는다.
- platform-composed capability가 raster dispatch에 도달하면
  `KBR-COMPOSITION-MODE-NOT-SUPPORTED`로 fail-closed한다.

## 근거

`TEMPLATE_LOCKED`와 `FREEFORM`은 기존 구현 및 Golden이 사용하는 raster layout
축이다. NAVER placement에는 플랫폼 조합 책임이 있는 형식도 있으므로 이를
재해석하지 않고 별도 composition 축을 추가해야 한다. `MOBILE_DA_FEED`는
individual image, platform wrapper, collection 등 semantic이 섞일 수 있어 단일
composition/layout/cardinality로 단정하지 않는다.

## 영향 범위

- `packages/renderer-contract/src/capability.ts`가 namespace, axes, placement
  namespace, legacy profile materialization, dispatch guard를 제공한다.
- `FormatProfile` 및 Template Capability schema에는 optional metadata만 추가한다.
- `contracts/channel-capabilities.json`과 그 schema가 Naver capability catalog를
  보유한다.
- Integration Contract는 `1.6.0 → 1.7.0`으로 minor bump하고, legacy `1.6.0`
  input은 계속 허용한다.
- Core Error Registry는 dispatch guard code 추가로 `1.2.0 → 1.3.0`으로 minor
  bump한다.
- Canonical 문서는 `1.11.0 → 1.12.0`으로 minor bump한다.

## 호환성

새 field가 required가 아니므로 기존 Integration input, CreativeLayoutPlan,
manifest, FormatProfile JSON을 decode할 수 있다. 기존 Kakao profiles는 hydration
시 `KAKAO_MOMENT / RENDERER_COMPOSED / 기존 LayoutMode / SINGLE`로 materialize한다.
새 metadata는 freeform pixel fingerprint material에 포함하지 않는다. 기준 PNG/JPEG,
Validator 결과, artifact checksum 및 Golden SHA는 변경하지 않는다.

## 미해결 Blocker

- Naver SmartChannel PSD 120종의 공식 geometry/typography contract는 N1B에서
  별도 동결한다.
- Naver landing icon, CTA, disclosure asset 및 SHA-256은 미확보 상태다.
- `PLATFORM_COMPOSED` runtime, Feed wrapper, Collection orchestration, Naver
  Desktop UI는 구현하지 않는다.

## 원본 명세의 변경 섹션

- Canonical 문서 header 및 precedence: 1.12.0 / N1A 최신 freeze
- 새 `31. Phase N1A` 전체: channel hierarchy, orthogonal axes, Naver boundary,
  dispatch, serialization, version 및 acceptance
- 기존 §26–§30의 Kakao/FREEFORM 의미와 historical version rows: 변경하지 않음
