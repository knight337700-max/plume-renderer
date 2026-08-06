# MASK_SEMICIRCLE_RIGHT Contract Clarification

Status: FROZEN for Phase C6 v2 · Canonical document 1.8.0

## 문제

`MASK_SEMICIRCLE_RIGHT.png`는 원형 이미지와 상단 logo cutout을 함께 보여주지만, 기존
단일 이미지 capability에는 logo asset, mask digest, safe box, black validation을
표현할 수 없었다. 임의의 SVG/아이콘·recolor·crop fallback은 결정적 결과와 자산
승인 경계를 훼손한다.

## 결정

- `KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT`를 구현된 capability로 등록한다.
- 실행 slot은 필수 `IMAGE_PRIMARY`와 선택 `LOGO_PRIMARY`로 고정한다.
- circle `(801,225,r=180)`, cutout `(839,16,142,60)`, image destination
  `(621,45,360,213)`, text hard right `588`을 고정한다.
- mask는 project-relative pinned PNG asset이며 runtime bytes와 SHA-256을 검증한다.
- logo가 있는 경우에만 PNG/alpha/transparent/visible RGB <= 32,
  ALPHA_TRIM_CONTAIN, CENTER, safe box `(847,24,126,44)`, max upscale 1.5×를
  사용한다. 자동 recolor는 하지 않는다.
- logo가 없는 결과물은 정상 PASS다. Asset과 Plan의 한쪽만 존재하거나 logo 검증이
  실패하면 전체 artifact를 BLOCKED로 만들며 publish/download를 허용하지 않는다.
- 기존 `1.1.0` 및 C6 v1 `1.2.0` input plans는 읽기 호환하고 공개 Integration
  Contract/output capability는 `1.3.0`으로 동결한다.

## 근거

`reference/kakao-tool/MASK_SEMICIRCLE_RIGHT.png`의 검증 SHA-256은
`90a2e948d979b204867c837485ca0d4b391de4ca44c22ca36e9f3f53862ac75e`다. 위치와
크기는 기준 PNG 측정값([TOOL_OUTPUT])이며 safe-box inset, logo validation, mask
registry는 프로젝트 결정([PROJECT])이다. 이 문서는 카카오 공식 업로드 승인이나
미확보 아이콘의 존재를 의미하지 않는다.

## 영향 범위

`packages/renderer-contract`, mask Core renderer, Desktop Main/Preload/Renderer Lab,
manifest asset digests, error registry, fixture/golden test, package smoke에 영향을 준다.
기존 OBJECT_RIGHT/THUMBNAIL_BOX_RIGHT/THUMBNAIL_MULTI_RIGHT 좌표와 Golden bytes는
변경하지 않는다.

## 호환성

Canonical 문서는 1.7.0→1.8.0, Template Contract는 1.4.0→1.5.0,
Desktop은 0.6.0→0.7.0, Integration은 1.2.0→1.3.0으로 증가한다. 기존 단일-slot
입력은 기존 capability에서 계속 동작한다. Manifest는 self digest를 포함하지 않는다.

## 미해결 Blocker

- 카카오 공식 승인 아이콘 asset은 여전히 확보되지 않았으므로 CTA `NONE`만 활성이다.
- 추가 OS 지원과 cross-platform pixel tolerance는 별도 계약 버전에서 다룬다.
- 실제 광고 업로드/심사 승인 여부는 이 로컬 Renderer 계약의 범위가 아니다.

## 원본 명세의 변경 섹션

- Canonical 문서 header/version/status
- Phase C6 §23 전체
- `contracts/contract-versions.json`, `template-capabilities.json`, integration schema/error registry
- Desktop Renderer Lab 및 acceptance 설명
