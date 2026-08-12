# Kakao Bizboard local renderer

Canonical 계약 `1.21.4`과 Template Contract `1.9.0`을 구현한 Windows 10/11 x64용 독립 실행형 Core·CLI·Electron Desktop 앱이다. `OBJECT_RIGHT`, `THUMBNAIL_BOX_RIGHT`, `THUMBNAIL_MULTI_RIGHT`, `MASK_SEMICIRCLE_RIGHT`를 실제 렌더링하고 Kakao/NAVER FREEFORM 및 NAVER SmartChannel 120개를 지원한다. Desktop `0.9.12`는 capability registry 기반 `NAVER` Channel → Placement → Editor 흐름과 renderer-owned macOS original Apple SD Gothic Neo TTC source를 제공한다. SmartChannel은 TTC SHA와 face index/PostScript identity를 검증하고, backend의 face-index API 부재 때문에 table-equivalent standalone OTF를 명시 등록한다. N7.7.5의 actual-raster typography parity와 N7.7.6 canonical-driven Desktop field mapping을 유지한다. N7.8은 대표 Golden 6개를 corrected runtime으로 rebase하고 120개 전수 3회 결정성, non-SmartChannel 동결 회귀와 Windows package QA를 고정한다. N8은 기존 Mobile DA·1:1 FREEFORM, Communication·Shopping News·Native source contract, Feed single/collection capability를 형식별 Desktop E2E로 완결하고 SmartChannel을 그대로 동결한다. M0는 Meta 공식 소스만으로 static creative media와 platform-composed 광고 UI의 경계를 설계하며 runtime/selector/pixel preset은 추가하지 않는다. 시스템 폰트 설치·lookup과 runtime network는 사용하지 않는다. NAVER `PLATFORM_COMPOSED`는 최종 UI를 렌더링하지 않는 source contract로 동결되어 있다. `Integration Contract v1.8.0`과 Kakao/non-SmartChannel fingerprints는 유지된다. Variable-canvas, NAVER video, META runtime, Google은 후속 Phase다.

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

`pnpm check`는 기존 계약과 Integration Contract 무결성, TypeScript, lint, Core·Desktop build, 단위·통합·보안·Golden·Electron E2E 테스트를 순서대로 실행한다. Integration 전용 검증은 `pnpm test:integration-contract`다. NAVER Desktop 회귀만 실행하려면 `pnpm exec playwright test tests/e2e/naver-desktop.spec.ts`를 사용하고, packaged 8-placement·SmartChannel 120-template matrix는 `pnpm smoke:desktop`을 사용한다.

N6 NAVER Platform-Composed source provenance, collection validator, fingerprints와 atomic
manifest publish는
`pnpm verify:naver-platform`으로 검사한다. Desktop handoff 복사본은
`node scripts/verify-renderer-module-handoff.mjs`로 별도 검증한다.

META M0 official-source/architecture audit는 `pnpm verify:m0-meta`로 검사한다. M0는 1:1·4:5·9:16 ratio family와 renderer/platform ownership을 설계하지만 META를 Desktop에 노출하거나 production pixel을 생성하지 않는다.

FREEFORM Contract 전용 검증은 `pnpm verify:freeform-contract`와 `pnpm test:freeform-contract`다. F1 Core Raster 검증은 `pnpm test:freeform-core`이며 기존 Template Golden 회귀와 함께 실행한다. F3A 카탈로그/프로파일 검증은 `pnpm test:kakao-freeform-profiles`, JPEG 결정성 검증은 `pnpm test:jpeg-determinism`, F4C Desktop 배치 검증은 `pnpm test:freeform-presets`다.

F2 Validator 검증은 `pnpm test:freeform-validator`다. PRE_RENDER ERROR는 raster/Preview/publish를
실행하지 않고, POST_RENDER ERROR는 이미 생성된 Preview artifact를 표시하되 publish/download를 차단한다. Validator는 계약·매체
artifact만 검사하며 미적 평가나 자동 보정을 하지 않는다.

## Desktop 실행

개발 환경에서도 localhost dev server를 사용하지 않고 로컬 정적 UI build를 Electron에서 연다.

```powershell
pnpm desktop:start
```

사용 순서:

1. `이미지 선택`에서 제품 이미지(PNG/JPG/JPEG)를 선택한다. OBJECT_RIGHT는 투명 PNG만, THUMBNAIL_BOX_RIGHT·THUMBNAIL_MULTI_RIGHT·MASK_SEMICIRCLE_RIGHT의 IMAGE_PRIMARY는 PNG/JPG/JPEG를 허용한다. Multi는 두 Slot을 각각 선택하거나 Primary Asset을 명시적으로 재사용하고, MASK의 LOGO_PRIMARY는 선택형 투명 PNG overlay다.
2. 광고주체, Headline, Subcopy를 입력한다.
3. 광고주체 문자열을 Headline 또는 Subcopy에 실제로 포함한다.
4. 결과 폴더명을 입력하고 `Preview 검증`을 실행한다.
5. ERROR가 0개인 `VALID_PASS` 또는 `VALID_WARNING` 상태에서 출력 폴더를 선택한다.
6. `PNG 및 Manifest 저장`을 실행한다.

NAVER Desktop은 먼저 Channel에서 `NAVER`를 선택한 뒤 Placement를 선택한다. SmartChannel은 registry의 120개 template whitelist와 renderer-owned SHA-256-pinned Apple SD Gothic Neo resource/provider preflight를 사용해 PNG를 렌더링하며 OS/system font lookup과 silent fallback을 금지한다. Mobile DA와 Image Banner 1:1은 기존 FREEFORM Editor를 재사용한다. Native/Shopping News/Communication Ad/Feed는 `PLATFORM_COMPOSED` Source Editor로 필드와 원본 asset만 검증·export하며 최종 UI는 NAVER가 구성한다. Feed Collection은 4–10개 ordered item을 편집하고 source artifacts와 manifest를 atomic publish한다. VIDEO는 static renderer 범위 밖으로 비활성화되어 있다.

입력이 변경되면 이전 PASS와 Export 권한은 즉시 무효화된다. ERROR는 Export를 차단하고 WARNING은 표시하되 Export를 허용한다. Preview Guide는 Object slot, text hard edge, 최소 gap, 우측 투명 margin을 보여주는 별도 DOM layer이며 Preview·Export PNG에는 합성되지 않는다.

Renderer Process에는 제품·출력 절대 경로가 전달되지 않는다. OS dialog와 session workspace, output token, Core 재검증과 download gate는 Electron Main에서 처리한다.

## Windows package

```powershell
pnpm package:windows
pnpm smoke:package
pnpm smoke:desktop
```

생성 파일:

```text
release/win-unpacked/Kakao-Bizboard-Local-Renderer.exe
release/Kakao-Bizboard-Local-Renderer-0.9.12-x64.exe
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

`--input`은 input root 아래의 상대 경로여야 한다. 입력 안의 제품 경로도 input root 기준 상대 경로다. 출력은 `<output-root>/<output.directory>/<output.baseName>/` 아래의 `render-manifest.json` 1개와 명시한 `output.png` 또는 `output.jpg` 1개다.

종료 코드는 성공 `0`, 결정적 입력·Validator 실패 `2`, CLI 사용법 또는 내부 시작 실패 `1`이다. `downloadAllowed=false`이면 파일 경로와 digest를 반환하지 않고 publish를 차단한다.

## 지원 범위

- `OBJECT_RIGHT`, `THUMBNAIL_BOX_RIGHT`, `THUMBNAIL_MULTI_RIGHT`, `MASK_SEMICIRCLE_RIGHT`, Canvas `1029×258`
- NAVER Feed Collection ordered source artifacts (`4–10`), per-item checksums/pixel fingerprints, collection manifest, and atomic publish; final platform UI is not rendered
- MASK circle `(801,225,r=180)`, image destination `(621,45,360,213)`, optional LOGO_PRIMARY overlay safe box `(847,24,126,44)`, pinned circle-only mask digest `eb9ea4859e2b75384ac814add59ce9636ce865ad5bae5a33f76d46210bfa6027`
- CTA `NONE`만 활성
- Spoqa Han Sans Bold/Regular 고정 파일 및 SHA-256 검증
- Alpha Trim, 8-neighbor 노이즈 분리, 1.5× 최대 업스케일
- RGBA PNG-32, F3A fixed Profile별 decimal-byte limit, deterministic JPEG (`4:2:0`, metadata stripped, progressive=false)

## FREEFORM Contract and Core Raster

`LayoutMode`는 `TEMPLATE_LOCKED | FREEFORM`이다. 기존 입력에서 생략하면
`TEMPLATE_LOCKED`이며 기존 Template Slot/Golden은 그대로 사용한다. FREEFORM은
Template `imageSlotId` 없이 `CreativeLayoutPlan`의 normalized Element bounds와
`ImagePlacementSpec`을 검증한다. Text는 canonical Hex color와 deterministic
`fontId` Registry를 사용하고 OS/remote font fallback은 금지한다. F3A는
`KAKAO_DISPLAY_NATIVE_*`, Video Native, Bizboard Expandable, AdView의 fixed
FREEFORM Profile을 `contracts/freeform-format-profiles.json`에 등록한다. Native 1200
legacy entry는 그대로 `CATALOG_NOT_READY`다. F1은 내부 테스트 Profile에서만
normalized bounds, stable zIndex, IMAGE/TEXT/LOGO Raster, appliedElements, fingerprints,
atomic publish를 실행하고 F3A는 명시적 PNG/JPEG와 Profile size/alpha/safe-zone/
element constraints를 검증한다. F2는 `src/core/freeform-validator.ts`에서 staged validation,
asset/logo/text compliance, appliedElements/checksum integrity를 유지한다. Renderer Lab은
Registry-driven Profile selector와 IMAGE Fit/Fill/Reset 배치 편집을 제공한다. Preset은 사용자가 클릭할 때만 기존 Plan 필드를 편집하고 Renderer에 자동 Layout/Crop 추론을 추가하지 않는다. variable-canvas collection은 후속 Phase다.
- 동일 output root의 staging을 통한 manifest-first / PNG-last publish

## Integration Contract

`packages/renderer-contract/`와 Integration Contract 문서가 별도 `schemaVersion: 1.6.0` 계약이다. JSON에는 절대 경로 또는 바이너리 객체를 넣지 않고 `assetRef`를 Runtime Asset Resolver로 해석한다. 입력 Asset은 PNG/JPEG만 허용하며 WebP/GIF/AVIF/BMP/TIFF/SVG는 Production Capability에서 차단한다. F3A FREEFORM Profile은 명시적 PNG/JPEG output, profile별 decimal-byte gate, opaque/safe-zone/element constraints를 사용한다. 기존 Template Capability는 그대로 유지하고, JPEG EXIF Orientation은 crop 전에 보정한다. Candidate와 Subject Protection은 입력 Plan을 검증하고 자동 Crop 생성이나 자동 중심 대체를 하지 않는다.

동일한 Placement 값의 Manual/Agent Plan은 같은 `pixelFingerprint`와 artifact bytes를 만들고 `requestFingerprint`로 provenance만 구분한다. 오류가 하나라도 있으면 Integration Output은 `BLOCKED`이며 artifact/download를 제공하지 않는다. Runtime network access는 계속 금지된다.
- Electron Main + sandboxed Preload + React 단일 화면 UI
- 제품·Preview·output·export opaque token과 session cleanup
- 동일 Core 기반 Preview/export byte equality
- THUMBNAIL_BOX_RIGHT와 THUMBNAIL_MULTI_RIGHT의 Crop Rect는 `x/y/width/height`별 문자열 edit buffer로 decimal 입력을 보존한다. 커스텀 +/- 버튼 없이 Arrow `0.1`, Shift `0.01`, Alt `0.001`로 조절하며 `step=any`와 wheel 보호를 사용한다. 범위 밖 값은 자동 clamp하지 않는다.
- Headline baseline `120`, Subcopy baseline `178`, X `48` 유지
- Headline 12 / Subcopy 15 Korean-equivalent units 및 실제 ink 폭 585px 계약
- Runtime HTTP/HTTPS/WebSocket/telemetry/auto-update 0

원격 API, 카카오 업로드, 다른 CTA mode, 다른 템플릿, AI, 프로젝트 저장 기능은 지원하지 않는다. CTA는 `NONE`만 활성이다. 외부 업로드 UAT는 사용자가 직접 수행하며 `tests/manual/manual-acceptance-checklist.md`에 기록한다.
