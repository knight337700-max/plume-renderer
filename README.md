# Kakao Bizboard OBJECT_RIGHT local renderer

Canonical 계약 `1.2.0`과 Template 좌표 계약 `1.1.0`을 구현한 Windows 10/11 x64용 독립 실행형 Core·CLI다. 기존 plume 코드나 서버, DB, Queue, Electron UI를 사용하지 않으며 실행 중 네트워크 접근을 하지 않는다.

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

`pnpm check`는 계약 무결성, TypeScript, lint, build, 단위·통합·Golden 테스트를 순서대로 실행한다.

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

- `OBJECT_RIGHT`, Canvas `1029×258`
- CTA `NONE`만 활성
- Spoqa Han Sans Bold/Regular 고정 파일 및 SHA-256 검증
- Alpha Trim, 8-neighbor 노이즈 분리, 1.5× 최대 업스케일
- RGBA PNG-32, 300000 decimal-byte hard limit
- 동일 output root의 staging을 통한 manifest-first / PNG-last publish

Electron/React UI, 원격 API, 업로드, 다른 CTA mode와 다른 템플릿은 C1 범위 밖이다.
