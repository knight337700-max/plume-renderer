# Phase N2A — NAVER SmartChannel Object Placement Contract Clarification

- Status: FROZEN (2026-08-10 KST)
- Scope: contract clarification only; no Renderer, Golden PNG, or Desktop UI
- Canonical document: `docs/kakao-bizboard-renderer-spec-v1.md` §35
- Machine-readable registry: `contracts/naver-smartchannel-object-placement.json`
- Source PSD revision: `contracts/naver-smartchannel-source-revision.json#/sourceRevision`

## 문제

N2가 중단된 직접 원인은 120개 SmartChannel template에 object를 배치할 runtime
계약이 없었기 때문이다. 기존 contract는 canvas, `objectRegion`, `textRegion`,
typography, fixed components, template whitelist만 고정했으며 다음 의미가 빠져 있었다.

```text
coordinate model / anchor / fitMode / placementPolicy / clip-mask / sourceAssetRules
```

Kakao OBJECT_RIGHT 또는 FREEFORM의 contain/crop/alpha-trim semantics를 가져오면
SmartChannel PSD의 source frame을 오인하게 되므로 이 단계의 근거로 사용할 수 없다.

## 결정

1. PSD layer 구조가 증명하는 세 계열을 분리한다.
   - `STANDARD`: absolute-canvas PixelLayer, `FULL_CANVAS_SOURCE`, `NONE`, `NO_CLIP`
   - `THUMBNAIL`: ShapeLayer vector mask + clipping sample PixelLayer,
     `SLOT_LOCAL_SOURCE`, `FIXED_FRAME`, `SOURCE_MASK`
   - `PERSON_MOVIE`: 160은 별도 pre-composed canvas token, 200/280은
     `SMART_OBJECT_FRAME_SOURCE`, `SOURCE_TRANSFORM`, `NO_CLIP`
2. 모든 anchor는 임의 정렬값이 아니라 `SOURCE_DEFINED`로 동결한다.
3. 160/200/280은 scale factor로 일반화하지 않고 높이별 frame/mask token으로 분리한다.
4. 좌/우는 별도 token으로 등록하며, source가 없는 mirror variant를 생성하지 않는다.
5. PSD sample raster bounds는 user asset의 trim/anchor 근거로 사용하지 않는다.
6. trim, crop, semantic crop, focal crop, resize heuristic, background removal,
   padding, mirror generation은 금지한다.
7. `objectPlacementToken`을 120 template 전부에 요구하고, 39 token registry와
   `templateId` mapping을 함께 저장한다.
8. 280 thumbnail frame은 source-backed `(40,40,200,200)` / `(510,40,200,200)`이다.
9. N2 대표 후보 6종의 `unresolvedCandidateCount`는 0으로 한다. runtime 구현 전에는
   registry의 `rendererImplemented=false` 경계를 유지한다.

## 근거

### 공식 자료

공식 SmartChannel 제작 가이드([NAVER SmartChannel guide](https://ads.naver.com/adguide/1475))와
관련 공지([2026-06-01 notice](https://ads.naver.com/notice/31978),
[750×280 notice](https://ads.naver.com/notice/22349))는 DA 이미지 배너 구성, PSD 제작
자료, 280 thumbnail의 현재 200×200 규칙, 160/200 가이드 유지 상태를 확인하는 데만
사용했다. 이는 본 project의 runtime input 또는 업로드 승인 규칙을 대신하지 않는다.

### PSD source audit

`SMARTCHANNEL_GUIDE 12/`의 SHA-검증된 120 PSD를 `psd-tools==1.18.0`으로 읽었다.

| 계열 | 전수 관찰 |
|---|---|
| STANDARD | 160/200/280 모두 active PixelLayer와 group, vector mask 없음, clipping 없음 |
| THUMBNAIL | 높이/좌우별 ShapeLayer vector mask와 clipping sample PixelLayer |
| PERSON_MOVIE 160 | positioned PixelLayer, Smart Object/clip 없음 |
| PERSON_MOVIE 200/280 | SmartObjectLayer, `PLACED_LAYER2` transform, source frame size 272×234 또는 425×370 |

vector mask의 normalized bbox/path digest는 `maskGeometry`에 기록했고, 200B 우측
2줄 PSD의 sub-pixel path 차이는 두 digest를 모두 보존했다. 280 PERSON_MOVIE 후보의
Smart Object frame과 transform은 `candidateProof`에 직접 기록했다.

## 영향 범위

- `contracts/naver-smartchannel-object-placement.json`: 신규 registry v1.0.0
- `contracts/naver-smartchannel-object-placement.schema.json`: 신규 Draft 2020-12 schema
- `contracts/naver-smartchannel-template-contract.json`: registry 1.3.0→1.4.0,
  SmartChannel-scoped template contract 1.9.0→1.10.0, 120 token fields/references
- `contracts/naver-smartchannel-template.schema.json`: registry/schema v1.4.0,
  token/reference required fields
- `contracts/contract-versions.json`: Canonical 1.16.0→1.17.0과 N2A version record
- canonical 문서 §35 및 본 clarification

Global Kakao/FREEFORM core template contract는 1.9.0으로 유지한다. 이는 channel-scoped
SmartChannel contract version 1.10.0과 혼동하지 않는다. canvas/object/text coordinates,
font compatibility, CTA registry, integration 1.8.0, desktop 0.8.2에는 변경이 없다.

## 호환성

- 기존 template ID와 PSD SHA-256 mapping 120/120은 유지한다.
- 새 `objectPlacementToken`은 additive required field이며, placement registry reference가
  없는 이전 SmartChannel registry는 v1.4 schema에서 거부한다.
- Kakao/FREEFORM input/output/manifest 계약 및 renderer core version 0.4.1은 변경하지 않는다.
- 280 thumbnail current frame은 기존 geometry coordinates를 대체하지 않고 source mask
  frame을 별도 placement contract로 명시한다.
- N2A에서 실제 raster output이나 Desktop 경로는 생성하지 않으므로 사용자 PNG/Golden
  compatibility claim은 하지 않는다.

## 미해결 Blocker

N2A candidate placement blocker는 없다. 다음은 구현 단계의 명시적 후속 경계다.

- source PSD 외부 경로는 runtime dependency가 아니며, 구현 환경은 registry provenance를
  읽고 승인된 input asset만 받아야 한다.
- file-size/max bytes와 channel upload validation은 기존 validator 단계로 defer한다.
- source PSD가 user asset MIME/라이선스/업로드 허용을 완전히 규정한다고 주장하지 않는다.
- exact PSD pixel parity, remote source fetch, SmartChannel upload approval은 이 문서의
  계약 범위가 아니다.

## 원본 명세의 변경 섹션

- Canonical §0: 최신 Phase freeze를 N2A로 갱신
- Canonical §35: Object Placement Contract 추가
- SmartChannel template registry/schema: `objectPlacementContractRef`,
  `objectPlacementSchemaRef`, `objectPlacementStatus`, per-template
  `objectPlacementToken` 추가
- Contract versions: canonical minor 및 SmartChannel-scoped template minor bump 기록

이 clarification은 “이미지를 보기 좋게 넣는 방법”을 정의하지 않는다. source PSD가
증명한 coordinate system/frame/mask/transform만을 deterministic contract로 보존하며,
source가 정하지 않은 디자인 heuristic은 추가하지 않는다.
