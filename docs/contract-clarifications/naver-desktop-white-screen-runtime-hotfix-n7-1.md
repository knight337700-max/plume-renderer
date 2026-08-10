# N7.1 Contract Clarification — NAVER Desktop White-Screen Runtime Hotfix

## 문제

N7 보고 이후 Windows portable app에서 NAVER placement 선택 시 기존 UI가 사라지는 white-screen
증상이 제보되었다. N7의 23개 E2E는 dev Electron을 사용했고 selection 직후 shell/console
invariant와 packaged UI를 검사하지 않아 이 유형의 runtime failure를 증명하지 못했다.

## 결정

1. N7 release status는 영향을 받은 환경에서 stack trace를 확보할 때까지 runtime blocker로
   취급한다. 현재 checkout의 0.9.0 dev, production-equivalent build, portable EXE에서는
   8개 placement와 Feed subtype matrix를 실행했으나 예외가 재현되지 않았다.
2. Renderer `window.error`, `unhandledrejection`, React Error Boundary와 Electron Main의
   console/crash/unresponsive event를 local `<userData>/logs/renderer.log`에 기록한다.
3. Editor subtree는 `DESKTOP-EDITOR-001` Error Boundary로 감싼다. fallback은 channel
   navigation을 파괴하지 않으며 retry/default 화면 이동을 제공한다.
4. Missing capability/source/freeform profile은 다른 profile로 대체하지 않고
   `DESKTOP-CAPABILITY-001..004` controlled error UI를 사용한다.
5. 8개 placement, Feed IMAGE/COLLECTION/VIDEO, KAKAO↔NAVER 전환을 production package와
   portable EXE에서 DOM shell 및 uncaught exception invariant와 함께 검사한다.

## 근거

White screen은 React uncaught exception, packaged contract path, state shape, 또는 Electron
renderer crash가 모두 가능한 증상이다. 현재 실행에서 원인을 단정할 실제 stack이 없으므로
추측성 Core/contract 변경은 금지하고, 다음 실행에서 source-of-truth diagnostic evidence가
생기도록 하는 것이 안전하다.

## 영향 범위

- Desktop renderer/preload/Main diagnostics and Error Boundary
- NAVER capability resolution error states
- Dev/production/package click-matrix smoke and white-screen detector
- Desktop version `0.9.0 → 0.9.1`

영향 없음: Canonical document semantics, Template Contract `1.9.0`, Core `0.8.0`, Kakao/N4/N6
pixels, fingerprints, manifest meaning, runtime network policy.

## 호환성

기존 IPC 기능과 renderer input/output는 유지된다. 새 diagnostic IPC는 additive이며 malformed
payload는 Main에서 거부한다. 로그는 local-only이고 creative bytes를 기록하지 않는다.

## 미해결 Blocker

현재 checkout에서 사용자 영상과 동일한 exception이 재현되지 않았다. affected Windows
환경의 실제 portable 실행 로그 또는 stack signature가 있어야 최종 root cause를
`STATE`, `REGISTRY`, `PACKAGING`, `DYNAMIC_IMPORT`, `HOOKS`, `FONT_PREFLIGHT` 중 하나로
확정할 수 있다. Error Boundary와 controlled error UI는 원인을 숨기지 않으며, 재현 전까지
N7.1 release를 원인 확정으로 표시하지 않는다.

## 원본 명세의 변경 섹션

- Canonical §39 N7 acceptance gap: packaged UI and DOM/console invariant were absent.
- Canonical §40 N7.1: diagnostics, Error Boundary, no-silent-fallback, package matrix,
  version and regression policy.
