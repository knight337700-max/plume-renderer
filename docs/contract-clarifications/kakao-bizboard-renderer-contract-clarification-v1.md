# Kakao Bizboard Renderer Contract Clarification v1

- Phase: `C0 — Contract Freeze`
- Status: `FROZEN_WITH_ASSET_BLOCKERS`
- Date: 2026-08-05 (KST)
- Canonical document: `docs/kakao-bizboard-renderer-spec-v1.md`
- Canonical document version: `1.2.0`
- Template Contract version: `1.1.0` unchanged
- Classification: 아래 신규 결정은 모두 `[PROJECT]`

## 1. 목적과 우선순위

이 문서는 Canonical v1.1.0에서 발견된 구현 모호성과 충돌을 제거한다. 좌표, 기준 PNG, 공식 가이드 분류를 변경하지 않는다. 충돌이 있을 때 우선순위는 다음과 같다.

1. Canonical 문서 v1.2.0의 Phase C0 동결 조항
2. `contracts/`의 machine-readable contract
3. 본 Clarification
4. Canonical 문서에 남은 명시적 legacy snapshot

## 2. 버전 결정

| 계약 | 이전 | 신규 | SemVer 사유 |
|---|---:|---:|---|
| Canonical 문서 | `1.1.0` | `1.2.0` | 좌표 비변경 clarification의 minor bump |
| Template Contract | `1.1.0` | `1.1.0` | 좌표·레이아웃 고정값 비변경 |
| Input Schema | `1.1` (`1.1.0`으로 해석) | `1.2.0` | 기존 필드와 호환되는 명시적 default 물질화 및 canonicalization |
| Output Schema | `1.1` (`1.1.0`으로 해석) | `2.0.0` | persisted manifest와 response envelope 구조 분리 |
| Render Manifest Schema | 없음 | `1.0.0` | 신규 persisted schema |
| Response Envelope Schema | 없음 | `1.0.0` | 신규 runtime response schema |

## 3. 문제·결정·영향

### C0-001 Font asset

- 문제: Spoqa Han Sans Bold/Regular 실제 파일과 digest, 라이선스 확인 결과가 없다.
- 결정: 두 asset을 `UNRESOLVED_ASSET`으로 등록한다. 시스템 fallback, 다운로드, 가짜 파일과 digest를 금지한다.
- 근거: 결정적 텍스트 렌더링과 합법적 번들링에는 정확한 파일이 필요하다.
- 영향 범위: font verification, text metrics, Renderer, Golden PNG.
- 호환성: 좌표와 Schema에 영향 없음.
- Blocker: 실제 텍스트 Renderer 구현 전 해결 필수.
- 원본 변경 섹션: 7.1, 10.3, 11, Phase C0.

### C0-002 Manifest와 response 분리

- 문제: manifest가 자신의 SHA-256을 포함하면 자기참조 digest가 된다.
- 결정: 성공 publish 파일은 `output.png`와 `render-manifest.json`이다. manifest self digest는 금지하고 `manifestDigest`는 비영속 response envelope에만 둔다.
- 근거: 파일 작성 후에만 그 파일의 digest를 계산할 수 있다.
- 영향 범위: Output Schema major bump, Core/IPC response, publish 순서.
- 호환성: 기존 Output 1.1 소비자와 구조적으로 비호환.
- Blocker: 없음.
- 원본 변경 섹션: 5, 9.1.G, 10.4~10.7.

### C0-003 CTA NONE only

- 문제: 승인 아이콘, digest, label 전체 목록, landing matrix가 없고 CTA 좌표가 `[INFERRED]`다.
- 결정: `NONE`만 enabled. 나머지는 Registry에 disabled로 남기며 입력 시 `KBR-CTA-009`를 반환한다.
- 근거: 검증되지 않은 자산과 공식 규칙을 만들 수 없다.
- 영향 범위: CTA Registry, Input semantic validation, Acceptance.
- 호환성: 기존 Schema shape는 파싱 가능하지만 두 mode는 semantic ERROR가 된다.
- Blocker: 비활성 CTA 구현을 위해 승인 자산과 정책 필요.
- 원본 변경 섹션: 2.3, 3.6.2, 3.9, 3.10, 8.6, 9.1.F.

### C0-004 공개 실행 mode 단순화

- 문제: Core API의 `dryRun`/`validateOnly`와 ERROR 0 산출물 불변식이 충돌했다.
- 결정: 공개 Input과 공개 Core API에서 두 mode를 제거하고 단일 실행 흐름만 계약한다.
- 근거: 한 개의 publish gate를 우회 없이 강제한다.
- 영향 범위: Core API signature와 pipeline.
- 호환성: JSON Input 1.1에는 두 속성이 없었으므로 Input shape 영향 없음.
- Blocker: 없음.
- 원본 변경 섹션: 10.4, Phase C0.

### C0-005 applyDefaults

- 문제: JSON Schema `default`는 annotation이며 실행 동작을 보장하지 않는다.
- 결정: `parse → schemaValidate → applyDefaults → NFC → trim → Canonical Input → JCS → digest`를 고정한다. Canonical Input에는 모든 default가 실제 필드로 존재한다.
- 근거: 입력 digest와 반복 실행의 결정성.
- 영향 범위: Input normalization과 digest.
- 호환성: 기존 생략 가능 필드는 계속 허용된다.
- Blocker: 없음.
- 원본 변경 섹션: 2.5, 4, 10.4, 10.6.

### C0-006 산출물 개수

- 문제: `output_count: 1`은 PNG와 manifest를 합쳐 하나인지 불명확했다.
- 결정: `pngCount=1`, `manifestCount=1`, `responseEnvelopeCount=1`. 광고 결과물 개수는 PNG 기준 1개다.
- 근거: persisted artifact와 runtime response를 구분한다.
- 영향 범위: DoD와 Output Schema.
- 호환성: 설명 명확화.
- Blocker: 없음.
- 원본 변경 섹션: 2.3, 2.6, 10.10.

### C0-007 RGBA PNG-32

- 문제: PNG-24와 alpha 필수의 조합이 모호했다.
- 결정: PNG IHDR `colorType=6`, `bitDepth=8`, RGBA, 1029×258로 고정한다.
- 근거: 투명 배경과 machine validation의 명확성.
- 영향 범위: Output Schema와 Validator.
- 호환성: 공식 허용 형식을 좁히는 프로젝트 제한이며 기존 좌표 영향 없음.
- Blocker: 없음.
- 원본 변경 섹션: 2.3, 8.8, 9.1.G, 10.7.

### C0-008 Alpha 의미와 고립 noise

- 문제: trim 보존과 layout visibility가 같은 임계치로 표현되어 반투명 fringe 보존 의미가 불명확했다.
- 결정: `trimPreserveThreshold=1`, `layoutVisibleThreshold=8`. alpha를 이진화하지 않는다. 8-neighbor 연결성을 사용하며 alpha>=8인 컴포넌트 중 pixel count 최대를 주 연결요소로 선택한다. 동률이면 `(minY,minX,maxY,maxX)` 사전식 순서가 앞선 컴포넌트를 선택한다. 다른 컴포넌트가 주 컴포넌트 visible pixel count의 `0.0005` 미만이면 layout bbox에서 제외하고 Warning을 낸다. 그 이상이면 bbox에 포함한다. 원본과 보존 alpha는 수정하지 않는다.
- 근거: 최소한의 결정적 noise 처리와 원본 보존.
- 영향 범위: trim box, layout bbox, gap, containment.
- 호환성: 기존 `ALPHA_VISIBLE_THRESHOLD=8`을 layout 의미로 보존한다.
- 한계: 작은 분리형 제품 부품은 Warning 및 수동 검토가 필요할 수 있다.
- 원본 변경 섹션: 6.2, 6.3.

### C0-009 Resize 반올림

- 문제: 부동소수점 contain 결과의 정수 픽셀 변환이 없었다.
- 결정: 승인된 round/floor 공식과 1.5× 상한을 사용한다. 남는 홀수 픽셀은 우측/하단에 둔다.
- 근거: Golden byte 결정성.
- 영향 범위: productPlacedBox와 containment.
- 호환성: Object slot과 정렬 정책 비변경.
- Blocker: 없음.
- 원본 변경 섹션: 3.8, 6.2, Phase C0.

### C0-010 Decimal byte

- 문제: KB가 1000인지 1024인지 불명확했다.
- 결정: warning `270000`, hard limit `300000` decimal bytes. `<=270000 PASS`, `270001..300000 WARNING`, `>=300001 ERROR`.
- 근거: validator 경계의 결정성.
- 영향 범위: size Validator.
- 호환성: 보수적이고 명시적인 단위 정의.
- Blocker: 없음.
- 원본 변경 섹션: 1.2, 8.8, 9.1.G, 10.7.

### C0-011 Canonical JSON

- 문제: digest 직렬화와 경로 표현이 정의되지 않았다.
- 결정: RFC 8785 JCS 호환 직렬화, UTF-8 no BOM, NFC, canonical key order, array order 보존, whitespace 없음, default 물질화 후 digest, 프로젝트 상대 참조 경로를 사용한다. 구현 라이브러리는 아직 선택하지 않는다.
- 근거: 동일 입력 digest 결정성 및 OS 경로 비종속성.
- 영향 범위: canonicalInputDigest와 normalizedInputDigest.
- 호환성: Input field shape 유지.
- Blocker: 없음.
- 원본 변경 섹션: 10.6, Phase C0.

### C0-012 오류 매핑

- 문제: AJV 원문과 KBR code의 매핑·정렬이 없고 `KBR-DOWNLOAD-001`이 Registry 밖에 있었다.
- 결정: `contracts/ajv-error-mapping.json`을 사용하고 오류를 severity, JSON pointer, code, messageKey 순으로 정렬한다. AJV 원문은 외부 계약이 아니다. Download code와 disabled CTA code를 정식 등록한다.
- 근거: 안정적 issue list와 Golden 결정성.
- 영향 범위: Schema Validator, Core, IPC.
- 호환성: 기존 code는 유지하고 신규 code를 추가한다.
- Blocker: 없음.
- 원본 변경 섹션: 8, 10.5.

### C0-013 Trusted root

- 문제: parent traversal을 판정할 기준 root와 Windows 링크 정책이 없었다.
- 결정: CLI는 `--input-root`, `--output-root`를 필수로 받고 Desktop은 Main Process 파일 선택 승인을 root로 사용한다. resolve 후 descendant 검사, UNC·symlink·reparse point 금지, 기본 overwrite 금지를 공통 적용한다.
- 근거: Renderer Process 또는 JSON 문자열만 신뢰할 수 없다.
- 영향 범위: CLI, Core path resolver, Electron Main.
- 호환성: 보안 강화.
- Blocker: 없음.
- 원본 변경 섹션: 2.6, 10.4, Phase C0.

### C0-014 Atomic publish

- 문제: PNG와 manifest 두 파일은 하나의 파일 rename으로 원자화할 수 없다.
- 결정: output root 내부 `.out-staging/<jobId>/`에서 작성·검증·flush한 후 manifest를 먼저, PNG를 마지막으로 rename한다. 실패 시 staging과 부분 manifest를 정리한다. 최종 PNG 존재는 ERROR 0 publish 완료를 의미한다. staging과 final이 동일 볼륨인지 확인한다.
- 근거: 실패 PNG가 최종 경로에 남는 것을 막는다.
- 영향 범위: persistence와 download gate.
- 호환성: NFR 원자 저장의 구체화.
- Blocker: 없음.
- 원본 변경 섹션: 2.7, 10.4~10.5.

### C0-015 Runtime network

- 문제: runtime offline과 최초 dependency install offline이 혼동되었다.
- 결정: runtime network는 금지하고 build dependency는 lockfile로 고정한다. offline install은 pnpm store 준비 환경에서만 보장한다.
- 근거: 현실적인 build 계약과 로컬 실행 보안의 분리.
- 영향 범위: runtime, build, Acceptance.
- 호환성: 기존 network 0 원칙 명확화.
- Blocker: 없음.
- 원본 변경 섹션: 2.6, 9.1.A, 10.1, Phase C0.

### C0-016 Windows x64 Golden

- 문제: cross-platform native raster 차이에 대한 허용 범위가 없었다.
- 결정: Windows 10/11 x64만 v1 공식 플랫폼으로 삼고 고정 환경 3회 SHA 동일을 Acceptance로 한다. macOS/Linux tolerance는 제외한다.
- 근거: v1 검증 범위의 결정성.
- 영향 범위: Golden, CI, release.
- 호환성: 기존 Windows 우선 정책을 제한적으로 확정.
- Blocker: 폰트 및 향후 raster dependency pin 필요.
- 원본 변경 섹션: 2.7, 9, 10.3, 11.

### C0-017 Fixture 최소 계약

- 문제: 100개 fixture를 Contract Freeze 선행 조건으로 두면 자산 계약보다 구현 데이터 생성이 앞선다.
- 결정: Phase C0에서는 reference 1개, 최소 valid input, code별 invalid fixture 요구, CTA NONE, Alpha 경계 목록, naming 규칙만 정의한다. 실제 생성은 구현 단계로 넘긴다.
- 근거: Contract Freeze와 fixture 제작 책임 분리.
- 영향 범위: Acceptance 계획.
- 호환성: 성공 지표의 100 샘플은 후속 확장 목표로 유지 가능.
- Blocker: 현재 fixture 파일은 reference 외 미생성.
- 원본 변경 섹션: 2.8, 9.2, Phase C0.

## 4. Fixture naming 규칙

```text
<template>__<category>__<case-id>__<expected-severity>.<ext>
```

예:

- `object-right__valid__cta-none-basic__pass.json`
- `object-right__alpha__fully-transparent__error.png`
- `object-right__error-code__kbr-text-003__error.json`

필수 Alpha 경계 목록:

- alpha 0 only
- alpha 1 fringe 보존
- alpha 7은 trim 보존, layout bbox 제외
- alpha 8은 layout bbox 포함
- 내부 투명 hole
- 반투명 shadow
- 극소 고립 component
- 동률 main component tie-break
- 1.5× 정확 경계와 1.5× 초과

## 5. 미해결 Blocker

1. Spoqa Han Sans Bold 실제 파일·SHA-256·라이선스
2. Spoqa Han Sans Regular 실제 파일·SHA-256·라이선스
3. APP_DOWNLOAD 승인 아이콘·digest·label·landing matrix·측정 좌표
4. KAKAO_SERVICE_ACTION 승인 아이콘·digest·label·landing matrix·측정 좌표
5. Windows x64 Golden 생성에 사용할 runtime/dependency의 후속 구현 단계 pin

Blocker는 좌표 계약 또는 `OBJECT_RIGHT.png`의 유효성을 훼손하지 않는다. 다만 폰트 Blocker가 해소되기 전 실제 텍스트 Renderer와 Golden PNG 구현은 시작할 수 없다.

## 6. 변경 파일

- Canonical: `docs/kakao-bizboard-renderer-spec-v1.md`
- ADR: `docs/adr/ADR-0001..0005`
- Machine contracts: `contracts/*.json`
- Font 안내: `assets/fonts/README.md`
- Integrity verification: `scripts/verify-contract.mjs`

`reference/kakao-tool/OBJECT_RIGHT.png`와 세 비규범 참고 이미지는 변경하지 않는다.
