# ADR-0009: Electron and Windows packaging stack

- Status: Accepted
- Date: 2026-08-05
- Classification: [PROJECT]

## Decision

정확한 버전을 lockfile에 고정한다.

| 역할 | Package | Version |
|---|---|---:|
| Desktop runtime | Electron | 43.3.0 |
| UI | React / React DOM | 19.2.8 |
| UI build | Vite | 8.2.0 |
| React build plugin | @vitejs/plugin-react | 6.0.5 |
| Main/Preload bundle | esbuild | 0.28.1 |
| IPC runtime validation | Zod | 4.4.3 |
| E2E | @playwright/test | 1.62.1 |
| Windows packaging | electron-builder | 26.15.3 |

Electron은 최신 세 stable release를 지원한다는 공식 정책을 따르므로 현재 stable 43 line을 선택했다. [Electron release policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)

Windows target은 `win-unpacked`과 no-install `portable` x64다. Portable은 관리자 권한과 installer가 필요 없는 target이다. [electron-builder target guide](https://www.electron.build/docs/targets/)

## Packaging policy

- app id: `local.kbr.desktop.renderer`
- product: `Kakao Bizboard Local Renderer - Unofficial`
- code signing: 없음
- publish provider, auto update, update server: 없음
- Windows x64 native Canvas·Sharp binary를 optional dependency로 명시
- portable package는 원격 업로드하지 않음
- SmartScreen 경고 가능성을 문서화

Electron 설치 시 binary dependency resolution에는 네트워크가 필요할 수 있다. 이는 Production Runtime network 0과 구분한다.
