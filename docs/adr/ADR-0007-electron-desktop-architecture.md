# ADR-0007: Electron Desktop architecture

- Status: Accepted
- Date: 2026-08-05
- Classification: [PROJECT]

## Context

Phase C2는 C1 Core를 복제하지 않고 Windows 10/11 x64 Desktop UI에서 사용해야 한다. Renderer Process가 파일 시스템, 절대 경로 또는 임의 IPC에 접근하면 trusted-root와 download gate를 우회할 수 있다.

## Decision

- `apps/desktop` 아래에 Electron Main, sandboxed Preload, React Renderer UI, shared IPC type을 둔다.
- Main만 dialog, session 파일, output root와 Core를 다룬다.
- Preload는 일곱 개 고정 method만 `contextBridge`로 노출한다.
- Renderer UI에는 Node integration과 절대 경로가 없다.
- Production UI는 dev server나 `file://` 대신 `kbr-app://app/` custom protocol로 로컬 build 파일만 읽는다.
- Preview 이미지는 token으로 제한된 `kbr-preview://preview/<token>` protocol에서만 제공한다.
- BrowserWindow는 `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`, `webSecurity=true`다.

Electron 공식 보안 체크리스트가 custom protocol, IPC sender 검증, navigation/window 제한과 최신 지원 Electron을 권장한다. [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)

## Consequences

- Renderer XSS가 발생해도 직접적인 Node·파일 경로 권한을 얻지 않는다.
- 모든 privilege transition은 Main의 allowlist·runtime schema·session token을 통과한다.
- UI build 없이는 Desktop을 시작할 수 없지만 packaged runtime은 localhost나 네트워크에 의존하지 않는다.
