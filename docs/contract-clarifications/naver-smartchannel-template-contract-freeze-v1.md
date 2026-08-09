# NAVER SmartChannel Template Contract Freeze v1

Status: FROZEN AS CONTRACT / RUNTIME NOT IMPLEMENTED
Phase: N1B
Canonical document: `docs/kakao-bizboard-renderer-spec-v1.md` §32

## 문제

N1A는 `NAVER_GFA/SMARTCHANNEL`의 channel, placement, composition, layout 및
cardinality만 표현했다. Renderer가 구현 가능한 template identity, PSD provenance, source
whitelist, geometry와 typography/fixed-component 경계를 아직 가지지 않았다. 제공된 catalog와
현재 source root는 20개 basename에서 `(1)` 또는 trailing-space 표기가 달라, 파일명만으로
교차검증하면 false mismatch가 발생할 수 있었다. 초기 text variant 예시는 `THREE_LINE`을
빠뜨렸지만 N2 후보는 같은 이름을 사용한다.

## 결정

1. 외부 `SMARTCHANNEL_GUIDE 12/`의 PSD 120개만 source authority로 사용한다. 저장소에는
   binary PSD를 추가하지 않고, 실제 source filename, 정규화 상대 경로, SHA-256, PSD header
   canvas와 catalog filename을 registry에 기록한다.
2. 750×160/200/280을 독립 height contract로 유지하고, 32/32/56 source counts와
   BASIC 8/8/16, EMPHASIS 15/15/25, BOTTOM_DISCLOSURE 9/9/15를 동결한다.
3. `NAVER_SMARTCHANNEL_<HEIGHT>_<FAMILY>_<OBJECT_KIND>_<SIDE>_<TEXT_VARIANT>_<AFFORDANCE>`
   ID를 사용한다. 실제 PSD가 없는 조합은 등록하지 않으며 120↔120 bijection을 요구한다.
4. source filename에 있는 3-line variant를 `THREE_LINE`로 registry에 보존한다. 이는 새
   조합을 생성하는 결정이 아니라 누락된 이름을 source label과 N2 후보에 맞추는 [PROJECT]
   clarification이다. `(메인2줄)` 또는 catalog grammar가 Main×2+Sub를 명시한 경우는
   `MAIN2_SUB`다. 이 naming을 공식 Naver 문구 규칙으로 해석하지 않는다.
5. `LANDING_ICON`과 `APP_CTA`는 source PSD 조합으로 inventory하지만 canonical asset,
   digest, label/landing 매트릭스, exact metrics가 없으므로 disabled 상태다.
6. Spoqa Han Sans Bold/Regular binary는 기존 OFL registry에서 존재와 SHA-256을 확인한다.
   그러나 PSD text-layer metadata를 추출하지 못했으므로 PSD와의 font identity 및 모든
   typography token은 `UNRESOLVED`다. 값은 문자열/observed raster로 추론하지 않는다.
7. geometry는 source catalog에서 도출한 placement primitive/vertical grammar로만 기록하고,
   observed raster bounds와 canonical fixed-component box를 분리한다. 260 maximum guide,
   160 disclosure two-line baseline, 200 icon y 편차 및 export registration은 unresolved다.
8. N1B runtime status는 `CONTRACT_ONLY`로 고정한다. SmartChannel raster, Canvas/Sharp,
   Desktop UI, Preview/Download, Naver API/upload와 runtime network는 추가하지 않는다.
9. Canonical document 1.12.0→1.13.0, Integration 1.7.0→1.8.0, Template 1.6.0→1.7.0을
   minor bump한다. CreativeLayoutPlan 1.0.0과 Desktop 0.8.2는 유지한다.

## 근거

- 실제 source root PSD count: 120.
- PSD header: `8BPS`, version 1, width 750, height 160/200/280 모두 일치.
- catalog SHA-256: 120/120 match; 20개는 source root basename만 다르고 digest는 동일.
- Inventory digest: `6c9d7da1373e7f03f25fb27b1cc6da46fac21b3b8e2e8a04d54a006302c78e4a`.
- Font files and license state are already registered in `contracts/font-asset-registry.json`.
- Source catalog explicitly prohibits mirror/scale/automatic reflow and lists unresolved icon,
  CTA, typography, 260-guide and export items.

## 영향 범위

- Machine-readable source/identity contract: `contracts/naver-smartchannel-template-contract.json`.
- Contract schema: `contracts/naver-smartchannel-template.schema.json`.
- Typography/fixed-component/N2 registries: corresponding `contracts/naver-smartchannel-*.json`.
- `TEMPLATE_CONTRACT_VERSION` and current manifest defaults become 1.7.0; the existing Kakao
  canvas and coordinate values do not change.
- Integration schema current version becomes 1.8.0 while 1.7.0 remains decodable.
- `scripts/verify-naver-smartchannel-contract.mjs` checks registry shape and, when the external
  source root exists, rechecks SHA-256 and PSD canvas headers.

## 호환성

This is additive for existing Kakao input, output, manifest and CreativeLayoutPlan data. Legacy
Integration schema versions remain accepted. No existing Kakao Golden PNG/JPEG is intentionally
changed by the N1B contract; any changed manifest version is a declared Template Contract bump.

## 미해결 Blocker

- PSD text-layer typography metadata extraction and exact font identity.
- Approved landing icon binaries/digests/optical boxes for 160/200 and 280.
- APP CTA labels, landing compatibility, chevron/button assets and exact metrics.
- 160 disclosure two-line exact baseline.
- 200 landing-icon y=85/86 classification.
- 260 maximum-object guide semantics versus placement slot.
- Mixed Korean/English character-count meaning and final export/registration rules.

These blockers make N2 runtime readiness false; they do not justify invented coordinates, assets,
font metadata or official-upload claims.

## 원본 명세의 변경 섹션

- Canonical §31.4 N1A capability boundary: SmartChannel moves from semantic-only to a separate
  source-whitelisted contract reference; raster/runtime remains deferred.
- Canonical §31.5 version boundary: current versions and the additive N1B registry are recorded.
- Canonical §32 (new): source inventory, identity/bijection, geometry, typography, fixed components,
  runtime boundary and acceptance gate.
