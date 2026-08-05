# Desktop IPC contract

모든 channel은 Main에서 sender window·top frame URL을 확인하고 Zod strict schema로 payload를 검사한다. 추가 field는 거부한다.

| Channel | Preload API | Renderer → Main payload | Main → Renderer 결과 |
|---|---|---|---|
| `kbr:product:select` | `selectProductPng()` | 없음 | asset token, 안전한 파일명, size/dimension/alpha/digest 또는 cancel/error |
| `kbr:product:clear` | `clearProduct()` | 없음 | void |
| `kbr:preview:request` | `requestPreview()` | asset token, 네 개 문자열, request sequence | Preview token/URL, digests, PNG metadata, Core issues |
| `kbr:output:select-directory` | `selectOutputDirectory()` | 없음 | output token과 표시명 또는 cancel/error |
| `kbr:export:render` | `exportRender()` | asset/Preview/output token, 현재 문자열 | export token, 파일명, digest 또는 blocked/error |
| `kbr:export:reveal` | `revealExportedFile()` | 성공 export UUID | void |
| `kbr:app:info` | `getAppInfo()` | 없음 | version, 고정 계약, Schema maxLength, network 시도 수 |

Payload에는 `assetPath`, `outputPath`, `downloadAllowed`, `overwrite`, `cta`, 임의 channel 또는 command를 넣을 수 없다. Renderer가 이 field를 주입하면 strict validation으로 IPC가 거부된다.

오류 code/severity/messageKey는 Core 반환값을 유지한다. Desktop token·IPC 자체의 오류만 `DESKTOP-*` namespace를 사용하며 Core Validator 오류로 위장하지 않는다.
