# Pinned font assets

Phase C1에서 Spoqa 공식 저장소의 legacy `Spoqa Han Sans` 원본 TTF를 고정했다. `Spoqa Han Sans Neo` 또는 시스템 폰트는 사용하지 않는다.

## 상태

- Registry status: `RESOLVED_ASSET`
- 실제 텍스트 Renderer 선행 Blocker: `NO`
- 시스템 폰트 fallback: 금지
- Runtime 원격 폰트 다운로드: 금지
- Registry SHA-256 불일치: 렌더 중단

## 필요한 파일

| Asset ID | 파일 | SHA-256 | Weight | 사용 범위 | 상태 |
|---|---|---:|---|---|---|
| `SPOQA_HAN_SANS_BOLD` | `SpoqaHanSansBold.ttf` | `5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef` | 700 | Headline 48px | `RESOLVED_ASSET` |
| `SPOQA_HAN_SANS_REGULAR` | `SpoqaHanSansRegular.ttf` | `1f56c8535b6592672ea7f540a67bb5792c34558d72875fc504166a3e2b28b4b1` | 400 | Subcopy 39px | `RESOLVED_ASSET` |

## Provenance

- Official repository: `https://github.com/spoqa/spoqa-han-sans.git`
- Tag: `v2.1.2`
- Commit: `771117a48d520e811cd9876af2ed07ed6f035a7f`
- Source directory: `Original/SpoqaHanSans`
- Font internal family: `SpoqaHanSans`
- Font internal version: `2.000`
- License: SIL Open Font License 1.1
- License file: `LICENSE-OFL-1.1.txt`

`contracts/font-asset-registry.json`이 실제 파일·weight·사용 범위·라이선스 상태의 machine-readable 기준이다. 파일을 교체하려면 Registry 버전과 Golden을 함께 갱신해야 한다.

## NAVER SmartChannel runtime policy (N1D)

이 저장소의 Spoqa 파일은 Kakao Bizboard와 FREEFORM의 고정 자산으로만 사용한다. SmartChannel Template Locked 원본이 요구하는 `AppleSDGothicNeo-*`, `SFProDisplay-Bold`, `SFUIDisplay-Bold`와 exact source identity가 다르므로 SmartChannel에는 사용할 수 없다. alias, 크기·tracking 보정, 조용한 fallback을 금지하며 N2 시작 전 exact identity가 확인되어야 한다.

SmartChannel은 `BUNDLED_EXACT`, `SYSTEM_EXACT`, `EXTERNAL_EXACT`만 허용하고 fallback은 허용하지 않는다. 현재 Windows x64에서 exact system/bundled 자산은 승인되지 않았으며, 사용자가 적법하게 보유한 exact 파일을 trusted root 상대 경로로 제공하는 external preflight만 계약상 지원한다. 외부 파일은 PostScript name, SHA-256, 선언된 version을 모두 검증하고 네트워크 URL·traversal·symlink/reparse 경유를 거부한다. UI 선택기는 N1D 범위에 포함하지 않는다.

기준: [`contracts/naver-smartchannel-runtime-font-policy.json`](../../contracts/naver-smartchannel-runtime-font-policy.json), [`contracts/naver-smartchannel-font-preflight.schema.json`](../../contracts/naver-smartchannel-font-preflight.schema.json). Apple 원본 binary를 repo에 복제·bundle·변환하지 않는다.

N1D.1의 사용자 지정 AppleSDGothicNeo TTF는 `.local-fonts/naver-smartchannel/`에만 둘 수
있으며 Git commit/bundle 대상이 아니다. `NAVER_SMARTCHANNEL_FONT_DIR`로 외부 경로를
지정할 수 있지만, 현재 다운로드본은 내부 PostScript identity가 `AppleSDGothicNeoB00`
등으로 source exact name과 달라 SmartChannel 승인 자산이 아니다. SFPro/SFUI는 PSD의
export-capable hidden English text variants로 감사되어 source required 상태를 유지한다.

## NAVER SmartChannel N1D.2 compatibility update (historical, superseded by N7.4)

위 N1D.1 판정은 historical exact-identity 정책이다. 현재 정책은 source identity와 runtime
compatibility를 분리한다. 네 local archive 파일은 source exact가 아닌
`SOURCE_DIFFERENT_BUILD`로 기록되지만, controlled alias, SHA-256, SFNT tables, glyph
coverage, style separation, representative metric fixtures를 모두 통과하여
`PROJECT_COMPATIBLE_VERIFIED`로 승인되었던 historical projection이다. N7.4에서 SmartChannel
공식 runtime role은 NanumBarunGothic/Sandoll 공식 자산으로 다시 동결되었으며, 이 archive는
현재 runtime dependency가 아니다. runtime lookup key는 `fontToken`이며 arbitrary fallback은
계속 금지된다. Photoshop byte/pixel parity와 재배포 권한은 주장하지 않는다.

SF effective audit 결과 SFPro/SFUI layer는 `HIDDEN_SOURCE_TEXT`이고 composite contribution이
0이므로 runtime required set에서 제외된다. 자세한 기준은
[`contracts/naver-smartchannel-font-compatibility.json`](../../contracts/naver-smartchannel-font-compatibility.json)
및 [`contracts/naver-smartchannel-sf-font-audit.json`](../../contracts/naver-smartchannel-sf-font-audit.json)에 있다.

## NAVER SmartChannel N7.4 official font contract

SmartChannel은 Apple SD Gothic Neo를 공식 허용 폰트 또는 runtime dependency로 취급하지
않는다. Source PSD에 남아 있는 Apple 이름은 source metadata 기록일 뿐이다. 현재 저장소에는
합법적으로 확인된 `NanumBarunGothic` 또는 `Sandoll Neo Gothic` Bold/Regular runtime asset이
없으므로 SmartChannel 공식 role은 `UNRESOLVED_ASSET`으로 fail-closed 기록되어 있다.

필요 조건은 다음과 같다.

- `NAVER_SC_NANUM_BARUN_GOTHIC_BOLD`: weight 700, Main
- `NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR`: weight 400, Sub/Disclaimer
- 선택적 `NAVER_SC_SAN_FRANCISCO_BOLD`: 영문 전용 Main 1행

Medium/SemiBold를 unconditional dependency로 추가하지 않으며, 시스템 폰트 fallback,
가짜 파일명·SHA-256, 네트워크 다운로드, Apple 파일의 재사용은 금지한다. 실제 asset을
추가하려면 라이선스 확인, 파일 SHA-256, 내부 PostScript identity를
`contracts/naver-smartchannel-font-contract.json`과 runtime policy에 1:1로 등록해야 한다.
