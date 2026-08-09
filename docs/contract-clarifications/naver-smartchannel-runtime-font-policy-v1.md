# NAVER SmartChannel Runtime Font Policy — N1D Contract Clarification

상태: `FROZEN_FAIL_CLOSED`
범위: SmartChannel Template Locked 계약·font inventory·runtime preflight만. SmartChannel raster/UI/Golden은 제외한다.

## 문제

N1C PSD metadata는 `AppleSDGothicNeo-Bold`, `AppleSDGothicNeo-Medium`,
`AppleSDGothicNeo-Regular`, `AppleSDGothicNeo-SemiBold`, `SFProDisplay-Bold`,
`SFUIDisplay-Bold`의 exact PostScript identity를 동결했지만, 현재 Windows local renderer가
pin한 Spoqa Han Sans Bold/Regular은 다른 font이다. Apple exact binary를 합법적으로
Windows bundle 또는 repo에 복제할 근거도 확인되지 않았다.

## 결정

1. required source font는 위 6개 distinct PostScript name과 PSD count/token/language metadata로 완전 목록화한다.
2. runtime class는 `EXACT_BUNDLED_LICENSED`, `EXACT_SYSTEM`, `EXACT_EXTERNAL_LICENSED`, `LICENSED_BUT_NOT_SOURCE_MATCH`, `MISSING`으로 고정한다.
3. SmartChannel strict에는 `BUNDLED_EXACT`, `SYSTEM_EXACT`, `EXTERNAL_EXACT`만 허용하고 fallback과 metric compensation을 금지한다.
4. trusted-root 상대 경로의 external exact resource에 대해 file/decode/PostScript/SHA/version을 deterministic하게 확인한다. UI file picker와 network fetch는 만들지 않는다.
5. 누락·identity·version 오류는 각각 `NAVER_SMARTCHANNEL_FONT_UNAVAILABLE`, `NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH`, `NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH`로 보고하고 render start를 차단한다.
6. 현재 Windows availability는 exact system 0, exact bundled 0, exact external 지원은 true지만 resolved 0이다. N2는 `runtime_font_exact_match_to_psd`로 계속 차단한다.

## 근거

- N1C PSD metadata와 source revision: `contracts/naver-smartchannel-psd-metadata.json`, `contracts/naver-smartchannel-typography.json`.
- Apple 공식 문서: [Apple Developer Fonts](https://developer.apple.com/fonts/index.html), [macOS included fonts](https://support.apple.com/en-us/120414), [Apple System Fonts](https://developer.apple.com/fonts/system-fonts/), [Apple Design Resources license](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf).
- 현재 공식 근거에서 Windows redistributable path 또는 이 프로젝트의 bundle permission을 확인하지 못했으므로 허용으로 추정하지 않는다. 이는 법률 자문이 아니다.

## 영향 범위

- additive: `contracts/naver-smartchannel-runtime-font-policy.json`, `contracts/naver-smartchannel-font-preflight.schema.json`, Naver template registry v1.2.0, typography registry v1.2.0, Template Contract v1.9.0, Error Registry v1.4.0.
- Core에는 resolver/preflight helper만 추가한다. existing Kakao/FREEFORM renderer semantics와 asset registry는 변경하지 않는다.
- canonical document는 1.14.0에서 1.15.0으로 minor bump한다. coordinates와 Desktop version은 변경하지 않는다.

## 호환성

기존 Kakao/FREEFORM input/output은 계속 decodable하며 Spoqa asset registry와 Golden fingerprint는
그대로 유지한다. 새 SmartChannel strict caller는 exact font preflight report를 만족해야 하며,
기존 Naver source contract의 registry/template version은 각각 1.2.0/1.9.0으로 갱신된다.

## 미해결 Blocker

- 합법적으로 확인된 Windows exact source font binary 또는 bundle 권한 없음.
- Windows local 후보는 source PostScript와 불일치하고 provenance가 unresolved라 승인하지 않는다.
- N2 representative Golden은 exact runtime font가 해결될 때까지 시작하지 않는다.

## 원본 명세의 변경 섹션

- Canonical 문서 §34 전체 신규: exact inventory, matrix, Apple guard, runtime modes, preflight, N2 readiness, versioning.
- Canonical 문서 §33.7은 N1C historical record로 보존하고 현재 동결값은 §34.6에 기록한다.
