# Kakao Bizboard OBJECT_RIGHT local renderer

Canonical 계약 `1.6.1`과 Template Contract `1.3.0`을 구현한 Windows 10/11 x64용 독립 실행형 Core·CLI·Electron Desktop 앱이다. `OBJECT_RIGHT`, `THUMBNAIL_BOX_RIGHT`, `THUMBNAIL_MULTI_RIGHT`를 실제 렌더링하며 기존 plume 코드나 서버, DB, Queue를 사용하지 않고 실행 중 네트워크 접근을 하지 않는다. `Integration Contract v1.1.0`은 bytes 기반 PNG/JPEG MIME 검증, EXIF Orientation metadata, Agent-independent JSON boundary와 Runtime Asset Resolver를 제공하지만 Agent/OpenAI/Plume client를 포함하지 않는다.

## 요구 환경

- Node.js `>=24`
- pnpm `11.9.0`
- Windows 10/11 x64 (v1 공식 Acceptance 플랫폼)

의존성 해석은 `pnpm-lock.yaml`에 고정된다. 오프라인 설치는 필요한 pnpm store가 준비된 환경에서만 가능하다.

## 설치와 검증

```powershell
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check`는 기존 계약과 Integration Contract 무결성, TypeScript, lint, Core·Desktop build, 단위·통합·보안·Golden·Electron E2E 테스트를 순서대로 실행한다. Integration 전용 검증은 `pnpm test:integration-contract`다.

## Desktop 실행

개발 환경에서도 localhost dev server를 사용하지 않고 로컬 정적 UI build를 Electron에서 연다.

```powershell
pnpm desktop:start
```

사용 순서:

1. `이미지 선택`에서 제품 이미지(PNG/JPG/JPEG)를 선택한다. OBJECT_RIGHT는 투명 PNG만, THUMBNAIL_BOX_RIGHT와 THUMBNAIL_MULTI_RIGHT는 PNG/JPG/JPEG를 허용한다. Multi는 두 Slot을 각각 선택하거나 Primary Asset을 명시적으로 재사용한다.
2. 광고주체, Headline, Subcopy를 입력한다.
3. 광고주체 문자열을 Headline 또는 Subcopy에 실제로 포함한다.
4. 결과 폴더명을 입력하고 `Preview 검증`을 실행한다.
5. ERROR가 0개인 `VALID_PASS` 또는 `VALID_WARNING` 상태에서 출력 폴더를 선택한다.
6. `PNG 및 Manifest 저장`을 실행한다.

입력이 변경되면 이전 PASS와 Export 권한은 즉시 무효화된다. ERROR는 Export를 차단하고 WARNING은 표시하되 Export를 허용한다. Preview Guide는 Object slot, text hard edge, 최소 gap, 우측 투명 margin을 보여주는 별도 DOM layer이며 Preview·Export PNG에는 합성되지 않는다.

Renderer Process에는 제품·출력 절대 경로가 전달되지 않는다. OS dialog와 session workspace, output token, Core 재검증과 download gate는 Electron Main에서 처리한다.

## Windows package

```powershell
pnpm package:windows
pnpm smoke:package
```

생성 파일:

```text
release/win-unpacked/Kakao-Bizboard-Local-Renderer.exe
release/Kakao-Bizboard-Local-Renderer-0.5.1-x64.exe
```

Portable 앱은 설치와 관리자 권한을 요구하지 않는다. 코드 서명과 자동 업데이트가 없으므로 Windows SmartScreen 경고가 표시될 수 있다. 앱은 비공식 로컬 Renderer이며 카카오 공식 서비스가 아니고 실제 광고 심사 승인을 보장하지 않는다.

## CLI

```powershell
pnpm build
node dist/cli/index.js render `
  --input fixtures/valid/object-right__input__cta-none-basic__pass.json `
  --input-root "C:\absolute\trusted-input-root" `
  --output-root "C:\absolute\trusted-output-root"
```

`--input`은 input root 아래의 상대 경로여야 한다. 입력 안의 제품 경로도 input root 기준 상대 경로다. 출력은 `<output-root>/<output.directory>/<output.baseName>/` 아래의 `render-manifest.json` 1개와 `output.png` 1개다.

종료 코드는 성공 `0`, 결정적 입력·Validator 실패 `2`, CLI 사용법 또는 내부 시작 실패 `1`이다. `downloadAllowed=false`이면 파일 경로와 digest를 반환하지 않고 publish를 차단한다.

## 지원 범위

- `OBJECT_RIGHT`, `THUMBNAIL_BOX_RIGHT`, `THUMBNAIL_MULTI_RIGHT`, Canvas `1029×258`
- CTA `NONE`만 활성
- Spoqa Han Sans Bold/Regular 고정 파일 및 SHA-256 검증
- Alpha Trim, 8-neighbor 노이즈 분리, 1.5× 최대 업스케일
- RGBA PNG-32, 300000 decimal-byte hard limit
- 동일 output root의 staging을 통한 manifest-first / PNG-last publish

## Integration Contract

`packages/renderer-contract/`와 `docs/integration/plume-renderer-contract-v1.md`가 별도 `schemaVersion: 1.1.0` 계약이다. JSON에는 절대 경로 또는 바이너리 객체를 넣지 않고 `assetRef`를 Runtime Asset Resolver로 해석한다. 입력 Asset은 PNG/JPEG만 허용하며 WebP/GIF/AVIF/BMP/TIFF/SVG는 Production Capability에서 차단한다. 현재 production Capability는 `KAKAO_BIZBOARD_OBJECT_RIGHT`, `KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT`, `KAKAO_BIZBOARD_THUMBNAIL_MULTI_RIGHT`다. OBJECT_RIGHT는 `ALPHA_TRIM_CONTAIN + CONTAIN`과 alpha PNG만, Thumbnail Box Right는 PNG/JPEG의 `SEMANTIC_CROP_COVER` 또는 `MANUAL_CROP + COVER`를, Thumbnail Multi Right는 두 독립 Slot의 동일 정책을 실제 구현한다. JPEG EXIF Orientation은 crop 전에 보정한다. Candidate와 Subject Protection은 입력 Plan을 검증하고 자동 Crop 생성이나 자동 중심 대체를 하지 않는다.

동일한 Placement 값의 Manual/Agent Plan은 같은 `pixelFingerprint`와 artifact bytes를 만들고 `requestFingerprint`로 provenance만 구분한다. 오류가 하나라도 있으면 Integration Output은 `BLOCKED`이며 artifact/download를 제공하지 않는다. Runtime network access는 계속 금지된다.
- Electron Main + sandboxed Preload + React 단일 화면 UI
- 제품·Preview·output·export opaque token과 session cleanup
- 동일 Core 기반 Preview/export byte equality
- THUMBNAIL_BOX_RIGHT와 THUMBNAIL_MULTI_RIGHT의 Crop Rect는 `x/y/width/height`별 문자열 edit buffer로 decimal 입력을 보존한다. `step=0.001`, fine `0.0001`, normal `0.001`, coarse `0.01`이며 범위 밖 값은 자동 clamp하지 않는다.
- Headline baseline `120`, Subcopy baseline `178`, X `48` 유지
- Headline 12 / Subcopy 15 Korean-equivalent units 및 실제 ink 폭 585px 계약
- Runtime HTTP/HTTPS/WebSocket/telemetry/auto-update 0

원격 API, 카카오 업로드, 다른 CTA mode, 다른 템플릿, AI, 프로젝트 저장 기능은 지원하지 않는다. CTA는 `NONE`만 활성이다. 외부 업로드 UAT는 사용자가 직접 수행하며 `tests/manual/manual-acceptance-checklist.md`에 기록한다.
