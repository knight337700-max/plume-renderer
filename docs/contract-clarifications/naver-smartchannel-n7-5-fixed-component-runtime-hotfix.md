# N7.5 Contract Clarification — SmartChannel Fixed Component Runtime Hotfix

## 문제

N7.4 source Core에서는 SmartChannel landing icon과 APP CTA가 정상적으로 해석되었지만,
0.9.5 packaged application에서 Preview/Export가 `NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID`
로 실패했다. 실제 packaged 160과 200은 다음 파일의 `ENOENT`를 반환했다.

`release/win-unpacked/resources/app/assets/naver-smartchannel/landing-icon-compact.png`

160 `NAVER_SMARTCHANNEL_160_BASIC_STANDARD_LEFT_MAIN_SUB_LANDING_ICON`와 200
`NAVER_SMARTCHANNEL_200_EMPHASIS_THUMBNAIL_LEFT_MAIN_SUB_LANDING_ICON`은 compact 파일의
동일한 `ENOENT`를 반환했고, 280
`NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_ONE_LINE_LANDING_ICON`은
`release/win-unpacked/resources/app/assets/naver-smartchannel/landing-icon-280.png`의
`ENOENT`를 반환했다. source
assets와 frozen SHA-256은 모두 일치했다.

## 결정

- 원인 범주는 `PACKAGING`으로 고정한다.
- electron-builder `build.files`에 `assets/naver-smartchannel/**/*`를 포함한다.
- 26개 fixed component를 source/runtime/package 경로와 digest를 가진 frozen inventory로 등록한다.
- LANDING_ICON digest와 좌표는 변경하지 않는다.
- resolver 순서는 registry → runtime/package 존재 → digest → decode → exact bounds → composite다.
- 고정 구성요소에는 제품 object의 alpha trim/contain/70% 규칙과 fallback을 적용하지 않는다.
- 모든 실패는 `NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID`와 구조화된 failure reason으로 반환한다.
- UI에는 `naver_smartchannel.fixed_component_invalid` 한국어 번역을 등록한다.
- Compact CTA는 기존 11-label source-backed matrix만, 280 CTA는 기존 11-option occurrence만 검증한다.

## 근거

고정 reference digest는 compact `c731128d2bb468c5d7088c9d183d4ebbec24aa748085e6fe41f8d0cbd24a8e58`,
280 `b81d74dcadc9d21db0e81169117d52f9fc51973bd2bba0ce18985035efd617ca`다. compact placement는
160 `(694,65,16,30)`, 200 `(694,85,16,30)`, 280 placement는 `(660,112,56,59)`다.
이는 N7.4 source registry를 재사용한 값이며 좌표 계약을 변경하지 않는다. **[PROJECT]**

N3 Core exhaustive는 source `projectRoot`를 사용했고 package `resources/app`을 실행하지
않았다. 따라서 source/runtime 파일 존재만 확인하고 electron-builder 포함 목록과 packaged
resolver를 검증하지 않은 것이 정확한 테스트 공백이다. **[PROJECT]**

## 영향 범위

`contracts/naver-smartchannel-fixed-component-runtime.json`, Core fixed resolver,
desktop package file list, N7.5 package smoke mode, verifier, Korean i18n, version metadata와
handoff 문서에 영향을 준다. N7.4 actual sofa/logo/font acceptance, N7.2/N7.3 editor state,
Kakao/FREEFORM/N2/N4/N5/N6 계약은 변경하지 않는다.

## 호환성

Canonical document는 `1.21.1` 유지, template contract는 `1.9.0` 유지, SmartChannel source
template contract는 `1.10.0` 유지한다. Renderer Core는 `0.8.2 → 0.8.3`, Desktop package는
`0.9.5 → 0.9.6` patch bump이다. runtime registry는 신규 `1.0.0`이다. 기존 source-backed
input과 CTA labels는 호환되며, fixed asset 누락/변조는 이전의 모호한 오류 대신 결정적인
구조화 오류를 반환한다.

## 미해결 Blocker

없음. 26개 source/runtime asset, frozen digest, decode, placement, 29개 landing template,
11개 CTA option matrix가 검증 대상이다. Runtime network access는 0이며 외부 업로드 승인이나
원격 서비스 연동을 주장하지 않는다.

## 원본 명세의 변경 섹션

Canonical 문서에 Phase N7.5 섹션(44)을 추가했다. 기존 N7.4 섹션(43)과 좌표/asset 계약은
보존하고, package inclusion, runtime inventory, structured diagnostics, deterministic
acceptance와 버전 정책만 명시적으로 보강했다. **[PROJECT]**
