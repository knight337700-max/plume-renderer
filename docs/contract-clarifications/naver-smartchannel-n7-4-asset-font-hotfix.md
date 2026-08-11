# Phase N7.4 — SmartChannel Asset/Font Runtime Hotfix

상태: `PASS`

## 문제

N7.3 SmartChannel runtime은 raw source PNG canvas dimensions와 precomposed/source-space
placement를 template source rule과 직접 비교했다. 큰 transparent canvas 안에 정상적인
alpha object를 넣은 실제 sofa/logo asset은 object 자체가 허용 범위에 들어와도
`NAVER_SMARTCHANNEL_ASSET_DIMENSION_MISMATCH`와 `NAVER_SMARTCHANNEL_OBJECT_OUT_OF_REGION`이
발생했다. 동시에 이전 runtime policy가 Apple SD Gothic Neo compatibility build 네 개를
SmartChannel approved dependency로 선언했고, UI에는 세 validator messageKey 번역이 없었다.

## 결정

1. `contracts/naver-smartchannel-asset-normalization.json`의 pipeline을 decode → alpha
   bounds → alpha trim → placement policy → contain scale → final rendered bounds → region
   validation → final alpha pixel count로 동결한다.
2. raw source canvas, transparent padding, source-space placement는 object limit/region의
   판정 근거가 아니다. template canvas와 정확히 같은 legacy precomposed source만 1:1
   compatibility로 인식하며 final alpha를 다시 검사한다.
3. DA 160 object limit은 260×160, area 41,600, final alpha pixel 29,120 이하로 고정한다.
   trim threshold는 alpha≥1, layout-visible threshold는 alpha≥8, 8-connectivity의 최대
   주 연결요소를 기준 콘텐츠로 선택한다. alpha는 resize 뒤 이진화하지 않는다.
4. Apple canonical IDs를 runtime requirement에서 제거한다. Main은 NanumBarunGothic Bold,
   Sub/Disclaimer는 동일 family Regular를 기본으로 하고, San Francisco Bold는 영문 전용
   Main 1행의 optional role로 둔다. Medium/SemiBold는 필수 dependency가 아니다.
5. 사용자 제공 폴더의 NanumBarunGothic Bold/Regular TTF를 원본 그대로 intake하고,
   PostScript identity·버전·SHA-256·embedded copyright evidence를 registry에 기록한다.
   두 role은 `BUNDLED_EXACT`로 활성화하고 SF optional role은 source-only unresolved로 둔다.
   system/Spoqa/Noto fallback과 다운로드는 계속 금지한다.
6. 세 오류 및 final pixel limit에 대해 한국어 translation을 등록하고 actual/expected
   diagnostics를 UI에서 표시한다.

## 근거

- SmartChannel DA 160 guide values supplied for this phase: 750×160 output, 260×160 object,
  70% final non-transparent pixel limit.
- Existing frozen placement/template coordinates remain unchanged; `templateContractVersion`
  stays 1.9.0 (global) / 1.10.0 (SmartChannel registry).
- `assets/fonts/README.md` and the new font/normalization registries record asset availability
  without fabricating legal provenance.

## 영향 범위

- Core SmartChannel object raster path and persisted report diagnostics.
- SmartChannel runtime font preflight and Desktop catalog wording.
- SmartChannel validator i18n and G1–G8 tests.
- Kakao, FREEFORM, other NAVER source contracts, N7.2/N7.3 editor state, and coordinates are
  unchanged.

## 호환성

Existing precomposed source inputs remain recognized only when their source canvas matches the
template rule. Raw object inputs gain deterministic alpha trim/contain handling. The public
request shape remains unchanged. Required NanumBarunGothic assets are bundled exact and old
Apple-based SmartChannel PNG fingerprints are not claimed as current official-font output.

## 해결된 자산 및 검증 결과

- `NAVER_SC_NANUM_BARUN_GOTHIC_BOLD`: bundled exact; SHA-256
  `39bba4cd9bd2986143825c8654abbb62443914ab33b346c0c929a916f5d98bf2`.
- `NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR`: bundled exact; SHA-256
  `9b872773134e2e4d8c0b17021266786576db06c843ede0d0b523b214a450756c`.
- Actual logo validation used `C:/Users/Lenovo/Desktop/kakao/TEST_SOURCE/자코모 로고_블랙-ai.png`
  (842×595, SHA-256 `66c398b9994e27a358c8752a19e4425dd308327435bdd18005e8175cd3459e43`,
  alpha bounds ≈469×159); preview/export and both packaged executables passed.
- Actual sofa validation used `C:/Users/Lenovo/Desktop/kakao/TEST_SOURCE/Plume_누끼.png`
  (7616×5080, SHA-256 `fb736b93a274899b9750857ab7852c15d54d4f5233f7fbd655d28c2448f62dc4`,
  alpha bounds `x=2485,y=1555,w=3878,h=2213`); normalized `235×134`, final bounds
  `x=40,y=13,w=235,h=134`, visible alpha pixels `20,391/29,120`, and validator
  error/warning/info counts are all zero. Preview/export and both packaged executables passed.

## 비차단 미해결 자산

- San Francisco optional English-only asset remains source-only unresolved; it is not unconditionally required.
- Exact source dimensions `2048×1366` are historical/equivalent fixture characteristics only;
  they are not a Canonical input requirement. No N7.4 runtime blocker remains.

## 원본 명세의 변경 섹션

- Canonical §43: N7.4 pipeline, thresholds, official font roles, actual-user acceptance,
  i18n, versioning and provenance.
- `contracts/naver-smartchannel-runtime-font-policy.json`: v1.2.0 → v1.3.0.
- `contracts/naver-smartchannel-font-compatibility.json`: v1.0.0 → v1.1.0.
- `contracts/naver-smartchannel-asset-normalization.json`: new v1.0.0 registry.
- `contracts/naver-smartchannel-font-contract.json`: new v1.0.0 registry.
- `contracts/naver-smartchannel-actual-asset-acceptance.json`: new v1.0.0 actual-binary evidence registry.
