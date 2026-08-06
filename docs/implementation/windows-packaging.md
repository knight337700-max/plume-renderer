# Windows packaging

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm build:desktop
pnpm package:windows
pnpm smoke:package
```

Outputs:

```text
release/win-unpacked/Kakao-Bizboard-Local-Renderer.exe
release/Kakao-Bizboard-Local-Renderer-0.2.1-x64.exe
```

Portable package는 installer와 관리자 권한이 필요 없는 x64 실행형이다. 코드 서명과 auto update가 없으며 원격 publish를 수행하지 않는다. 서명되지 않은 실행 파일이므로 Windows SmartScreen 경고가 나타날 수 있다.

`smoke:package`는 unpacked와 portable을 각각 실행해 bundled fixture로 Preview와 atomic export를 수행한다. 다음을 검증한다.

- Preview/export SHA가 Core Golden과 동일
- PNG와 manifest 존재 및 digest 일치
- 우측 48px alpha 0
- runtime network request 0

Windows 10/11 x64가 공식 v1 범위이며 macOS/Linux package는 생성하지 않는다.
