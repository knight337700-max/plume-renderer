# Desktop session security

## Layout

```text
<OS temp>/kbr-session/<UUID>/
├─ .kbr-session
├─ input/product.png
└─ preview/<preview-token>.png
```

Main file dialog의 원본 PNG는 signature·decode·symlink/reparse·UNC/device path 검사를 통과한 뒤 stream copy된다. 원본은 수정하지 않으며 Renderer에는 원본 경로가 전달되지 않는다.

- current asset token은 제품 교체 시 폐기된다.
- 제품 교체·입력 Preview 갱신은 이전 Preview file/token을 제거한다.
- Preview protocol은 current token만 허용한다.
- output root 절대 경로는 Main token map에만 존재한다.
- export token은 성공한 PNG 경로에만 연결되어 임의 shell target을 만들 수 없다.
- 앱 종료 시 current session을 재귀 정리한다.
- 시작 시 marker와 UUID를 가진 24시간 초과 stale session만 정리한다.
- session cleanup 대상은 app-owned base root의 정확한 UUID descendant로 제한한다.

Canonical Input에는 session 기준 `product.png`만 포함되며 원본 절대 경로는 digest에 들어가지 않는다.
