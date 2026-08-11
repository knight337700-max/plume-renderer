# N7.5 Implementation Record — SmartChannel Fixed Component Runtime Hotfix

## Scope

이번 구현은 Renderer/UI 전면 재작성 없이 SmartChannel 고정 구성요소의 Core resolver,
package inclusion, diagnostics, verifier와 packaged smoke 경로만 보강한다. N7.4 actual
user sofa/logo/font contract와 기존 placement는 그대로 유지한다.

## 구현 항목

- 26개 resource의 source/runtime/package inventory 생성 및 registry load
- `LANDING_ICON_COMPACT`/`LANDING_ICON_280` frozen digest와 bounds 확인
- APP CTA compact 11 label, 280 11 option source occurrence 검증
- registry → file → digest → decode → exact placement 순서의 fixed resolver
- `MISSING_REGISTRY_ENTRY`, `MISSING_RUNTIME_ASSET`, `DIGEST_MISMATCH`, `DECODE_FAILED`,
  `PLACEMENT_MISMATCH`, `UNSUPPORTED_FOR_TEMPLATE` 진단
- packaged build에 `assets/naver-smartchannel/**/*` 추가
- N7.5 packaged smoke entrypoint와 160/200/280 대표 fixture
- Korean i18n key와 validation detail 표시
- source 29 landing template 3-run determinism 및 CTA matrix verifier

## 검증 명령

```powershell
pnpm build
node scripts/verify-naver-smartchannel-fixed-components.mjs
pnpm typecheck
pnpm test:naver-smartchannel
pnpm build:desktop
pnpm package:windows
node scripts/verify-naver-smartchannel-fixed-components.mjs --require-packaged
node scripts/smoke-naver-smartchannel-fixed-components.mjs
```

Package smoke는 unpacked `resources/app`과 portable EXE에서 같은 Core request를 실행하고
fixed component digest/bounds, Preview/Export parity, PNG digest와 zero-error 상태를 확인한다.

## 결과 해석

Source verifier는 26/26 asset, 29/29 landing template, compact 22 occurrence, 280 CTA
11 option, corruption/missing/wrong-mapping controlled error를 PASS해야 한다. package
verifier는 26/26 packaged digest와 160/200/280 representative smoke를 PASS해야 한다.
실패 시 PNG publish/download를 허용하지 않으며, fixed component fallback도 사용하지 않는다.
