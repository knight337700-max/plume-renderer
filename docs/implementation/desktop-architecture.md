# Desktop architecture

## Process ownership

| Process | 허용 | 금지 |
|---|---|---|
| Electron Main | OS dialog, session workspace, Core Preview/render, output token, reveal token | remote API, auto update, telemetry |
| Preload | 일곱 개 typed wrapper | generic invoke, fs/process 노출 |
| Renderer UI | form, state reducer, Preview 표시, DOM Guide | Node, fs, 절대 경로, Core 규칙 재구현 |

Production은 `kbr-app://app/index.html`을 사용한다. protocol handler는 `dist-desktop/renderer-ui` descendant만 읽고 traversal을 거부한다. `kbr-preview`는 현재 session Preview UUID 하나만 PNG로 반환한다.

BrowserWindow security:

```text
contextIsolation=true
nodeIntegration=false
sandbox=true
webSecurity=true
webviewTag=false
production devTools=false
window.open=deny
external navigation=deny
permissions=deny all
```

CSP는 `connect-src 'none'`, `frame-src 'none'`, `object-src 'none'`이며 remote script/font/image를 허용하지 않는다. Preview image만 `kbr-preview:`를 허용한다. Blob/data URL은 사용하지 않는다.

Runtime network filter는 HTTP, HTTPS, WS, WSS, FTP 요청을 취소하고 시도 횟수를 관찰 가능하게 기록한다. 정상 E2E 및 package smoke의 시도 횟수는 0이어야 한다.
