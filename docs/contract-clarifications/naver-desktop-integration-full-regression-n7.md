# NAVER Desktop Integration Full Regression — Contract Clarification N7

Status: `[PROJECT] IMPLEMENTED`
Canonical document: `1.21.0` (unchanged)
Desktop package: `0.8.2 → 0.9.0` (minor)

## 문제

N1–N6에서 고정한 NAVER placement, SmartChannel whitelist, FREEFORM profile, Platform-Composed SourceSpec, Feed Collection artifact 계약은 Core와 검증기에 존재했지만 Desktop에서 KAKAO 전용 진입점으로부터 분리되어 있었다. 사용자가 mode를 먼저 고르거나 플랫폼 소유의 최종 UI를 Renderer preview로 오해할 위험도 있었다.

## 결정

1. Desktop 첫 선택은 `Channel`이며 `KAKAO`와 `NAVER` 상태를 분리한다. NAVER는 registry를 읽어 `Channel → Placement → placement-specific editor`를 구성한다.
2. SmartChannel은 120개 registry whitelist, dynamic text fields, local font preflight, Core PNG Preview/Export를 사용한다.
3. NAVER Mobile DA와 Image Banner 1:1은 기존 `FreeformEditor`를 재사용한다. 별도 복제 Editor를 만들지 않는다.
4. Mobile/PC Native, Shopping News, Communication Ad 및 Feed Image/Collection은 `PLATFORM_COMPOSED` source editor를 사용한다. normalized source payload와 source artifact/manifest만 표시·export하며 `finalUiRendered=false`를 유지한다.
5. Communication LIST/COMMENT는 profile registry에 따라 fields를 바꾸고, Shopping News notification/presentation/mute 값은 platform-owned readonly metadata로 표시한다. Feed VIDEO는 static runtime 범위 밖으로 비활성화한다.
6. Collection editor는 4–10개 ordered item, Add/Remove/Reorder, item URL/description을 제공하고 N6 atomic publish 경로만 호출한다.
7. 모든 preview/export IPC 입력은 strict schema와 Main/Core session token 검증을 통과해야 한다. Runtime network access는 0이다.

## 근거

- NAVER 공식 placement pages 1473–1480을 N7 시작 전에 재확인했다. SmartChannel, Mobile DA/Image Banner, Communication, Shopping News와 Feed 유형 명칭·플랫폼 소유 경계가 frozen registry와 충돌하지 않았다. `[OFFICIAL] [TOOL_OUTPUT]`
- `contracts/desktop-capability-registry.json`은 구현 가능성만 표현하며 final platform geometry를 추가하지 않는다. `[PROJECT]`
- `src/core/naver-smartchannel.ts`, `src/core/naver-platform-composed.ts`, `src/core/naver-collection.ts`가 기존 Core 계약과 fingerprint/publish semantics의 단일 실행 경로다. `[PROJECT]`

## 영향 범위

- 수정: Desktop shared types/channels/preload/IPC schemas, Electron Main controller, React Desktop entry, shared FREEFORM editor, styles.
- 추가: capability registry, N7 Playwright regression suite, N7 version/implementation records.
- 유지: 현재 `templateContractVersion=1.9.0` semantic coordinate contract, current canonical geometry, Input `1.2.0`, Output `2.0.0`, Platform-Composed SourceSpec/registry `1.1.0`, Core `0.8.0`.
- Desktop version is `0.8.2 → 0.9.0` because the public Desktop capability/UI surface is expanded without changing the frozen raster/source schemas.

## 호환성

KAKAO existing Template Locked/FREEFORM flow and all previous golden tests remain available. Existing IPC channels retain their behavior; NAVER uses additive channels `kbr:naver:catalog`, `kbr:naver:preview`, and `kbr:naver:export`. Source exports are not PNGs and are never presented as a final NAVER UI screenshot.

## 미해결 Blocker

- Apple SD Gothic Neo runtime binaries remain an external, non-bundled preflight dependency. Missing/untrusted exact files block only SmartChannel render/download; the UI records the unresolved state and never downloads a font.
- NAVER final native/feed UI, upload approval, VIDEO runtime, Meta/Google and cross-platform pixel tolerance remain out of scope.

## 원본 명세의 변경 섹션

- Canonical document §39 `Phase N7 — NAVER Desktop Integration and Full Regression`.
- `contracts/contract-versions.json` `canonicalPhaseN7` records the unchanged canonical/source/core versions and the Desktop minor bump.
- No coordinate, template, CTA, source schema, or final-UI ownership contract was changed.
