# Kakao Bizboard Local Renderer Specification v1

- **Canonical path:** `docs/kakao-bizboard-renderer-spec-v1.md`
- **Document version:** 1.21.4
- **Status:** Frozen Implementation Contract — Phase N7.7 SmartChannel PSD-exact renderer-owned runtime font correction
- **Checked date:** 2026-08-11 (KST)
- **Owner:** Local Renderer Project
- **Target:** `KAKAO_MOMENT / BIZBOARD fixed Templates, Kakao FREEFORM Lab, and additive `NAVER_GFA` capability namespace

---

## 0. 문서 규칙

이 문서에서 사용하는 규범 키워드는 다음과 같다.

- **MUST / MUST NOT:** 구현 또는 승인에 필수
- **SHOULD / SHOULD NOT:** 특별한 사유가 없으면 준수
- **MAY:** 선택 구현

각 규칙의 근거는 다음 태그로 구분한다.

- **[OFFICIAL]** 카카오 공식 문서에서 직접 확인된 사항
- **[TOOL_OUTPUT]** 사용자가 카카오 비즈니스 제작툴에서 직접 생성한 PNG를 픽셀 단위로 측정한 사항
- **[DERIVED]** 공식값 또는 제작툴 측정값의 산술 관계에서 직접 계산한 사항
- **[PROJECT]** 본 프로젝트가 정한 범위와 제품 요구사항
- **[INFERRED]** 공식 문서·제작툴 출력과 확인된 규칙을 기반으로 Renderer가 고정한 구현값
- **[MANUAL]** 자동 Validator만으로 판정할 수 없어 사람이 확인해야 하는 사항

> **중요:** `[TOOL_OUTPUT]`은 카카오 비즈니스 제작툴의 실제 생성 결과를 측정한 값이지만 공개 가이드의 문언과 동일한 지위로 취급하지 않는다. `[INFERRED]` 값은 카카오의 공식 좌표를 주장하지 않는다. 공식 PSD 또는 추가 제작툴 샘플을 확보하거나 가이드가 변경되면 Template Contract의 버전을 올려 교체한다.

Phase F0 이후 계약 우선순위는 이 문서의 최신 Phase freeze(현재 **45. Phase N7.7 SmartChannel PSD-exact runtime font correction**), `contracts/`의 machine-readable contract, 본문의 나머지 조항 순이다. 본문에 `LEGACY / NON-NORMATIVE`로 표시된 이전 Schema snapshot은 구현 근거로 사용하지 않는다. **[PROJECT]**

---

# 1. 공식 가이드 조사 결과

## 1.1 공식 출처

1. **카카오 비즈보드 성과형 제작 가이드**  
   https://kakaobusiness.gitbook.io/main/ad/moment/performance/talkboard/content-guide
2. **카카오 비즈보드 상품 소개**  
   https://kakaobusiness.gitbook.io/main/ad/moment/performance/talkboard
3. **카카오 비즈보드 소재 만들기**  
   https://kakaobusiness.gitbook.io/main/ad/moment/performance/talkboard/content
4. **카카오 비즈보드 CPT 제작 가이드**  
   https://kakaobusiness.gitbook.io/main/ad/moment/guarantee/cpt/content-guide
5. **커스텀 비즈보드 제작 가이드**  
   https://kakaobusiness.gitbook.io/main/ad/moment/guarantee/cpt/content-guide/custom

## 1.2 공식 확인 사항

| ID | 확인 내용 | 적용 | 근거 |
|---|---|---:|---|
| OFF-001 | 일반 비즈보드 배너 규격은 `1029×258px` | MUST | [OFFICIAL] |
| OFF-002 | 허용 파일 형식은 `PNG-24`, `PNG-32` | MUST | [OFFICIAL] |
| OFF-003 | 최종 파일 용량은 `300KB 이하` | MUST | [OFFICIAL] |
| OFF-004 | 배경이 투명한 이미지로 제작 | MUST | [OFFICIAL] |
| OFF-005 | 비즈보드 박스는 카카오 시스템에서 구현 | MUST NOT export box | [OFFICIAL] |
| OFF-006 | 광고주체는 카피 또는 오브젝트에 필수 표기 | MUST | [OFFICIAL] |
| OFF-007 | 오브젝트형은 좌·우 배치가 가능하며, 배너 제작툴은 우측형 지원 | v1 우측형만 | [OFFICIAL] |
| OFF-008 | 오브젝트 우측형 등록 영역은 `315×258px` | MUST | [OFFICIAL] |
| OFF-009 | 실제 오브젝트 가로길이는 최소 `219px` 권장 | SHOULD | [OFFICIAL] |
| OFF-010 | 오브젝트 이미지는 투명 PNG, `150KB 이하` | input guidance | [OFFICIAL] |
| OFF-011 | 오브젝트는 배경 없는 형태로 가공 | MUST | [OFFICIAL] |
| OFF-012 | 오브젝트 좌우 크롭 금지 | MUST | [OFFICIAL] |
| OFF-013 | 오브젝트 이미지 내부 임의 텍스트 금지 | MUST | [OFFICIAL] |
| OFF-014 | 메인 카피는 `Spoqa Han Sans Bold`, `48pt`, `#4C4C4C` | MUST | [OFFICIAL] |
| OFF-015 | 서브 카피는 `Spoqa Han Sans Regular`, `39pt`, `#777777` | MUST | [OFFICIAL] |
| OFF-016 | 메인·서브 카피 문구 동일 사용 금지 | MUST | [OFFICIAL] |
| OFF-017 | 메인·서브 중 하나는 텍스트 폭 `290px` 이상 | MUST | [OFFICIAL] |
| OFF-018 | 우측형 카피와 오브젝트 간격은 최소 `33px` | MUST | [OFFICIAL] |
| OFF-019 | 가격 정보에 한해서만 취소선 허용 | out of v1 | [OFFICIAL] |
| OFF-020 | 일부 자판 외 특수기호와 이모티콘 사용 금지 | MUST | [OFFICIAL] |
| OFF-021 | 앱 다운로드용 상단 행은 `38×38px` 앱 아이콘과 `26pt #777777` 카피 사용 | conditional | [OFFICIAL] |
| OFF-022 | 앱 다운로드 카피에는 `앱` 또는 `APP` 포함 | conditional | [OFFICIAL] |
| OFF-023 | 카카오 서비스 랜딩 문구에는 공식 액션명을 임의 축약·수정하지 않음 | conditional | [OFFICIAL] |
| OFF-024 | 광고주 사이트 직접 랜딩의 익스팬더블 CTA는 `자세히보기`만 가능 | metadata validation | [OFFICIAL] |
| OFF-025 | CTA는 랜딩 유형과 일치해야 함 | MUST | [OFFICIAL] |

## 1.3 공식 문서만으로 확정하지 못한 사항

다음 항목은 공개 웹 문서의 텍스트만으로 정확한 수치를 확인하지 못했다.

- 일반 우측 오브젝트형 PSD의 모든 레이어별 절대 `x/y` 좌표
- Photoshop `pt`와 Renderer device pixel 간의 공식 변환 규칙
- CTA 상단 행을 함께 사용했을 때의 공식 절대 baseline
- 자동 심사와 실제 광고 심사의 완전한 동등성

이 중 기본 `OBJECT_RIGHT / CTA NONE`의 Canvas·텍스트·이미지 영역은 사용자가 카카오 비즈니스 제작툴로 직접 생성한 PNG를 추가 측정하여 보완한다. CTA가 포함된 절대 좌표는 여전히 `[INFERRED]`로 유지한다.

## 1.4 카카오 비즈니스 제작툴 출력 측정 결과

### 1.4.1 기준 파일

| 항목 | 값 |
|---|---|
| 파일명 | `OBJECT_RIGHT.png` |
| 생성 경로 | 카카오 비즈니스 제작툴 |
| 픽셀 크기 | `1029×258` |
| PNG mode | `RGBA` |
| SHA-256 | `33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b` |
| 문서 내 기준 경로 | `reference/kakao-tool/OBJECT_RIGHT.png` |

### 1.4.2 직접 측정값

| ID | 측정 내용 | 값 | 분류 |
|---|---|---:|---|
| TOOL-001 | 우측 이미지 가이드 영역 | `x=666, y=0, w=315, h=258` | [TOOL_OUTPUT] |
| TOOL-002 | 우측 외곽 투명 여백 | `x=981..1028`, `48px` | [TOOL_OUTPUT] |
| TOOL-003 | 메인 카피 샘플 visible ink bbox | `x=49, y=77, w=523, h=45` | [TOOL_OUTPUT] |
| TOOL-004 | 서브 카피 샘플 visible ink bbox | `x=50, y=144, w=533, h=36` | [TOOL_OUTPUT] |
| TOOL-005 | 메인 카피 기준색 | `#4C4C4C` | [TOOL_OUTPUT] |
| TOOL-006 | 서브 카피 기준색 | `#777777` | [TOOL_OUTPUT] |
| TOOL-007 | 이미지 가이드 기준색 | `#D9D9D9` | [TOOL_OUTPUT] |
| TOOL-008 | `OBJECT_RIGHT` 전용 로고 슬롯 | 별도 슬롯 없음 | [TOOL_OUTPUT] |

`visible ink bbox`는 샘플 문자열의 실제 불투명·반투명 글리프 픽셀 경계이며, 임의 문구의 고정 폭을 뜻하지 않는다. 폰트 draw origin과 baseline은 해당 bbox를 재현하기 위해 Renderer가 정한 `[INFERRED]` 값이다.

### 1.4.3 가이드 색상 해석

- `#D9D9D9`는 제작툴 샘플에서 **이미지가 최대로 들어갈 수 있는 영역을 표시한 가이드 색상**이다.
- `#D9D9D9` 사각형과 내부의 `Image` placeholder 문자는 최종 소재에 렌더링하지 않는다.
- 다른 참고 템플릿의 `#FFFFFF` 영역은 로고 가이드 영역을 뜻하지만, `OBJECT_RIGHT`에는 별도 로고 영역이 없다.
- C6 이전 문서의 `THUMBNAIL_MULTI_RIGHT`, `MASK_SEMICIRCLE_RIGHT`, `THUMBNAIL_BOX_RIGHT` 비범위 문장은 historical snapshot이다. 현재 v1.8.0에서는 네 유형과 C6 v2 MASK 계약을 구현·Acceptance 대상으로 한다. **[PROJECT]**

## 1.5 v1 설계 원칙

1. 일반 `OBJECT_RIGHT`의 이미지 최대 영역은 제작툴 출력에서 확인된 `x=666, y=0, w=315, h=258`을 사용한다.
2. 이미지 영역 안에 임의 inset을 추가하지 않는다.
3. 별도 광고주체 텍스트 또는 로고 레이어를 오브젝트 영역에 생성하지 않는다.
4. 광고주체는 구조화된 metadata로 입력받되, Headline 또는 Subcopy 안에 포함되었는지 자동 검증한다.
5. 일반 배너에 임의 CTA 버튼을 그리지 않는다.
6. CTA Registry는 `NONE`, `APP_DOWNLOAD`, `KAKAO_SERVICE_ACTION`을 정의하지만 Phase C0 v1에서는 `NONE`만 활성화한다. 나머지는 승인 asset과 정책 자료 확보 전까지 비활성이고 좌표도 `[INFERRED]`로 유지한다. **[PROJECT]**
7. 일반 URL 랜딩 CTA는 manifest의 의미 정보로만 보존하고, 이미지에는 임의 버튼을 생성하지 않는다.
8. 좌표와 픽셀 폰트값은 이 문서의 Template Contract로 버전 고정한다.

---

# 2. Renderer PRD

## 2.1 제품 정의

**Kakao Bizboard Local Renderer**는 구조화된 카피와 Template Capability가 허용하는 제품 image slot을 입력받아 카카오 비즈보드 우측형 배너를 로컬에서 생성하고, 자동 Validator 결과의 `ERROR`가 0개일 때만 최종 artifact 다운로드를 허용하는 독립 실행형 도구다. Template-locked 경로의 기존 PNG 계약은 유지하며, F3A에서는 동일 Core에 고정 Canvas FREEFORM Profile과 명시적 PNG/JPEG 출력을 additive하게 제공한다(현재 계약은 §29). `OBJECT_RIGHT`는 투명 PNG만, `THUMBNAIL_BOX_RIGHT`·`THUMBNAIL_MULTI_RIGHT`·MASK의 IMAGE_PRIMARY는 PNG/JPG/JPEG를 허용한다. MASK의 LOGO_PRIMARY는 선택형 검정 투명 PNG 슬롯이다. **[PROJECT]**

## 2.2 목표

1. 구조화 입력으로 반복 가능한 비즈보드 소재 생성
2. 템플릿 좌표와 렌더링 결과의 결정성 확보
3. 파일 규격·텍스트 폭·오브젝트 영역·CTA 호환성 자동 검증
4. `ERROR 0` 다운로드 게이트 강제
5. 기존 플룸 서비스와의 런타임·데이터·배포 의존성 제거

## 2.3 v1 Template-locked baseline 범위 (F0–F2)

| 항목 | 값 |
|---|---|
| Channel | `KAKAO_MOMENT` |
| Placement | `BIZBOARD` |
| Template | `OBJECT_RIGHT` |
| Canvas | `1029×258` |
| Product image | 투명 PNG 1개 |
| Copy | 광고주체 metadata, 헤드라인, 서브카피 |
| CTA | `NONE`만 활성화. `APP_DOWNLOAD`, `KAKAO_SERVICE_ACTION`은 Registry에 비활성 상태로만 보존 [PROJECT] |
| Output | PNG 1개 + validation manifest JSON 1개 |
| Execution | 로컬 전용 |
| Download gate | `errorCount === 0` |

위 표는 F0–F2의 Template-locked baseline을 보존한 것이다. 현재 F3A의
FREEFORM fixed-format catalog와 PNG/JPEG output 계약은 §29 및
`contracts/freeform-format-profiles.json`을 우선한다. **[PROJECT]**

## 2.4 명시적 제외 범위

다음은 v1에 포함하지 않는다.

- 기존 플룸 Agent
- LLM 또는 카피 생성
- Queue, Worker, SSE
- Railway 또는 원격 배포
- PostgreSQL, Redis, MinIO
- Evidence 수집·증빙 업로드
- 사용자 계정·조직·권한
- 캠페인 저장소
- 다중 결과물 또는 배치 렌더링
- 좌측 오브젝트형
- 썸네일형, 마스킹형, 텍스트형
- 익스팬더블 이미지·동영상·멀티형
- 배지, 하단고지, 가격 취소선
- 자동 배경 제거
- 이미지 생성·보정 AI
- 카카오모먼트 API 업로드
- 실제 광고 심사 승인 보장

## 2.5 핵심 사용자 흐름

1. 사용자가 제품 투명 PNG 1개 선택
2. 광고주체 metadata·헤드라인·서브카피 입력
3. CTA 모드와 랜딩 유형 선택
4. Raw JSON Schema 검증
5. 명시적 `applyDefaults`, Unicode NFC, trim 정규화
6. Canonical Input과 RFC 8785 JCS digest 생성
7. Alpha Trim 분석과 Template Layout 계산
8. 임시 1029×258 RGBA PNG 렌더링
9. 출력 Validator 실행
10. 오류 목록과 경고 목록 표시
11. `ERROR 0`이면 manifest와 PNG publish 및 다운로드 활성화
12. `ERROR >= 1`이면 최종 PNG와 manifest publish 금지

## 2.6 기능 요구사항

### FR-001 입력

- 앱은 JSON 입력과 Form 입력을 모두 지원해야 한다.
- Form 입력은 내부적으로 동일한 Input JSON으로 직렬화해야 한다.
- 모든 문자열은 Unicode NFC로 정규화해야 한다.

### FR-002 렌더링

- 동일한 입력, 동일한 폰트 파일, 동일한 Renderer 버전에서는 동일한 픽셀 결과를 생성해야 한다.
- Renderer는 네트워크 호출 없이 실행되어야 한다.
- 출력은 1배수 `1029×258`로 생성해야 한다.

### FR-003 Preview

- Preview는 `#F3F3F3` 회색 박스 위에 투명 PNG를 합성하여 보여줄 수 있다.
- Preview 박스는 최종 PNG에 포함하면 안 된다.
- Preview에는 좌표 가이드, 텍스트 박스, 오브젝트 슬롯을 토글할 수 있다.

### FR-004 Validator

- 입력 전 Validator와 렌더 후 Validator를 모두 실행해야 한다.
- 모든 오류는 안정적인 오류 코드, 심각도, 경로, 메시지, 측정값을 가져야 한다.
- `ERROR` 1개 이상이면 다운로드 버튼을 비활성화해야 한다.

### FR-005 산출물

- 최종 PNG `output.png` 1개
- 검증 manifest `render-manifest.json` 1개
- 비영속 runtime response envelope 1개
- 임시 Preview 파일은 최종 산출물로 계산하지 않는다.

### FR-006 로컬 보안

- 파일은 사용자가 선택한 로컬 경로에서만 읽어야 한다.
- HTTP 업로드, 원격 로그, 원격 텔레메트리를 사용하지 않는다.
- 입력 경로의 상위 디렉터리 탈출을 방지해야 한다.
- SVG, HTML, PSD를 제품 입력으로 허용하지 않는다.

## 2.7 비기능 요구사항

| ID | 요구사항 |
|---|---|
| NFR-001 | 일반 노트북에서 단일 소재 렌더링 2초 이내 목표 |
| NFR-002 | cold start 5초 이내 목표 |
| NFR-003 | 렌더 실패 시 부분 PNG를 최종 경로에 남기지 않음 |
| NFR-004 | 원자적 파일 저장: temp 생성 후 rename |
| NFR-005 | 폰트 fallback 금지 |
| NFR-006 | 비결정적 시스템 폰트 사용 금지 |
| NFR-007 | 오류 코드는 버전 내에서 의미 변경 금지 |
| NFR-008 | v1 공식 지원은 Windows 10/11 x64. macOS/Linux는 별도 계약 버전에서 추가 |

## 2.8 성공 지표

- 지원 샘플 100건의 Renderer crash 0건은 후속 구현 성공 지표이며 Contract Freeze 선행 조건이 아님
- 자동 Acceptance 전체 통과
- `ERROR 0`이 아닌 상태에서 다운로드 가능 사례 0건
- Golden fixture의 픽셀 차이 0 또는 허용된 명시 임계치 이내
- 최종 파일 `300001` decimal bytes 이상 다운로드 사례 0건

---

# 3. Template 좌표 계약

## 3.1 좌표계

- 원점: 좌상단 `(0, 0)`
- 단위: integer device pixel
- Canvas: `1029×258`
- Pixel ratio: `1`
- 회전: 없음
- Export background: 완전 투명 RGBA
- Bounding box 표기: `{x, y, width, height}`
- 경계 표기: 좌·상 포함, 우·하 제외의 half-open rectangle

## 3.2 Contract 식별자

```json
{
  "templateId": "KAKAO_MOMENT_BIZBOARD_OBJECT_RIGHT_1029X258_V1",
  "templateContractVersion": "1.2.0",
  "coordinateSource": "KAKAO_BUSINESS_TOOL_OUTPUT_MEASURED_PLUS_INFERRED_TEXT_ANCHORS",
  "referenceFixture": {
    "path": "reference/kakao-tool/OBJECT_RIGHT.png",
    "sha256": "33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b"
  }
}
```

## 3.3 가이드 레이어와 최종 레이어 구분

| 항목 | 가이드 표시 | 최종 PNG |
|---|---|---|
| 이미지 최대 영역 | `#D9D9D9` | 렌더링 금지 |
| 이미지 placeholder `Image` | 검정 문자 | 렌더링 금지 |
| 템플릿 디버그 박스 | 선택 표시 | 렌더링 금지 |
| 제품 PNG | 해당 영역을 대체 | 렌더링 |
| Headline/Subcopy | 렌더링 | 렌더링 |
| 시스템 비즈보드 박스 | 제작툴 밖에서 카카오가 제공 | 렌더링 금지 |

## 3.4 고정 영역

| 영역 | 좌표 | 분류 | 설명 |
|---|---|---|---|
| Canvas | `x=0, y=0, w=1029, h=258` | [OFFICIAL][TOOL_OUTPUT] | 최종 출력 크기 |
| Text draw origin x | `48px` | [INFERRED] | 샘플 visible ink가 `x=49`에서 시작하도록 정한 draw origin |
| Object slot | `x=666, y=0, w=315, h=258` | [TOOL_OUTPUT] | 제품 이미지가 최대로 들어갈 수 있는 영역 |
| Right outer margin | `x=981, y=0, w=48, h=258` | [TOOL_OUTPUT] | 완전 투명 유지 |
| Text hard right edge | `x=633` | [DERIVED] | `666 - 33`, 카피와 Object slot 간 최소 간격 |
| Copy↔object minimum gap | `33px` | [OFFICIAL] | 실제 visible bbox 기준 |
| Object recommended min visible width | `219px` | [OFFICIAL] | 미달 시 Warning |
| Advertiser/logo slot | 없음 | [TOOL_OUTPUT] | `OBJECT_RIGHT`에 별도 광고주체 레이어를 생성하지 않음 |

### 3.4.1 좌표 도식

```text
0        48                                      633  666              981 1029
┌────────┬────────────────────────────────────────┬────┬────────────────┬────┐
│        │ Headline / Subcopy                     │33px│ Object slot    │48px│
│        │                                        │gap │ 315×258       │    │
│        │                                        │    │ x=666, y=0    │    │
│        │                                        │    │ max image area│    │
└────────┴────────────────────────────────────────┴────┴────────────────┴────┘
```

## 3.5 카카오 제작툴 기준 샘플 측정

`OBJECT_RIGHT.png`의 샘플 문구에 대해 다음 visible ink bbox를 Golden coordinate evidence로 고정한다.

| 요소 | visible ink bbox | 기준색 |
|---|---|---|
| Main sample | `x=49, y=77, w=523, h=45` | `#4C4C4C` |
| Sub sample | `x=50, y=144, w=533, h=36` | `#777777` |

- 위 bbox는 샘플 문자열에만 해당한다.
- Renderer의 일반 문구 폭은 동일 폰트 엔진의 실제 glyph metrics로 계산한다.
- 1px의 좌측 side bearing 때문에 draw origin과 visible ink 시작점이 다를 수 있다.

## 3.6 텍스트 영역 프로파일

### 3.6.1 CTA 없음 — 제작툴 출력 재현 프로파일

| 요소 | draw x | baseline y | max right | font |
|---|---:|---:|---:|---|
| Headline | 48 | 120 | 633 | 48px Bold |
| Subcopy | 48 | 178 | 633 | 39px Regular |

`draw x`와 baseline은 TOOL-003·004의 visible ink bbox를 재현하기 위한 `[INFERRED]` 렌더 좌표이며, Phase C2a에서 기존 baseline에 +4px을 적용했다 `[PROJECT]`. Canvas와 Object slot의 절대 좌표는 `[TOOL_OUTPUT]`이다.

### 3.6.2 CTA 상단 행 있음 — 비활성 잠정 프로파일

| 요소 | x | y/baseline | max right | font | 분류 |
|---|---:|---:|---:|---|---|
| CTA icon | 48 | top 26 | 86 | 38×38 | [OFFICIAL size][INFERRED position] |
| CTA label | 94 | baseline 55 | 633 | 26px Regular | [INFERRED] |
| Headline | 48 | baseline 127 | 633 | 48px Bold | [INFERRED] |
| Subcopy | 48 | baseline 181 | 633 | 39px Regular | [INFERRED] |

CTA 포함 실제 제작툴 샘플과 승인 asset·digest·landing compatibility matrix를 확보하기 전에는 이 프로파일을 `PROVISIONAL_DISABLED`로 표시한다. Phase C0 v1에서는 Golden 또는 자동 Acceptance 근거로 사용할 수 없다. **[PROJECT]**

## 3.7 광고주체 계약

- `advertiser.text`는 필수 구조화 metadata다. **[PROJECT]**
- `OBJECT_RIGHT` 최종 PNG에 별도 광고주체 텍스트, 로고 박스 또는 wordmark 레이어를 자동 생성하지 않는다. **[TOOL_OUTPUT][PROJECT]**
- 정규화된 `advertiser.text`가 Headline 또는 Subcopy 중 하나에 완전한 연속 문자열로 포함되어야 한다. **[PROJECT]**
- 포함되지 않으면 `KBR-TEXT-007` ERROR다.
- 광고주체가 제품 자체에만 표시되었다는 판단은 OCR 없이 자동 확정하지 않는다. 제품에만 표기하려는 경우 v1 자동 Acceptance 대상이 아니며 `MANUAL-ADV-001` 검토가 필요하다.
- v1은 별도 로고 PNG 입력을 지원하지 않는다.

## 3.8 제품 배치 알고리즘

1. Alpha Trim 결과의 실제 경계 상자를 구한다.
2. 원본 비율을 유지한다.
3. 회전, 비균등 스케일, perspective 변형은 금지한다.
4. `Object slot(x=666, y=0, w=315, h=258)` 전체를 `contain` fit box로 사용한다.
5. 추가 상·하·좌·우 inset을 적용하지 않는다.
6. 기본 정렬은 `CENTER_CENTER`로 고정한다. **[PROJECT]**
7. 업스케일은 최대 `1.5×`까지만 허용한다.
8. 불투명·반투명 제품 픽셀은 Object slot 밖으로 나갈 수 없다.
9. 제품의 좌우 또는 상하가 잘리지 않아야 한다.
10. 투명 여백은 Alpha Trim 후 배치 계산에서 제외한다.
11. `#D9D9D9` 가이드 사각형과 `Image` placeholder는 최종 PNG에 합성하지 않는다.
12. 부동소수점 contain scale과 최종 정수 pixel 크기·좌표는 6.2의 `round`/`floor` 공식으로만 변환한다. **[PROJECT]**

## 3.9 CTA 표시 계약

### 3.9.1 `NONE`

- CTA 행을 렌더링하지 않는다.
- 일반 URL 직접 랜딩의 기본 모드다.
- `OBJECT_RIGHT.png` 제작툴 기준 샘플과 동일한 텍스트 프로파일을 사용한다.

### 3.9.2 `APP_DOWNLOAD`

> **Phase C0 상태: `enabled=false`. 입력되면 `KBR-CTA-009` ERROR. 아래 항목은 향후 활성화를 위한 미완료 조건이며 v1 구현 요구가 아니다. [PROJECT]**

- `38×38` 앱 아이콘이 필수다.
- label에 `앱` 또는 `APP`이 포함되어야 한다.
- label은 `26px`, `#777777`, 한 줄이다.
- 앱 아이콘은 광고주체로 인정하지 않는다.
- CTA 포함 좌표는 추가 제작툴 샘플 확보 전까지 `[INFERRED]`다.

### 3.9.3 `KAKAO_SERVICE_ACTION`

> **Phase C0 상태: `enabled=false`. 입력되면 `KBR-CTA-009` ERROR. 아래 항목은 향후 활성화를 위한 미완료 조건이며 v1 구현 요구가 아니다. [PROJECT]**

- 승인된 카카오톡 아이콘 에셋이 필수다.
- label은 공식 Registry의 액션명과 정확히 일치해야 한다.
- 액션명 임의 축약·맞춤법 변경·공백 변경을 허용하지 않는다.
- 일반 배너 안에 별도 pill/button/rounded rectangle을 그리지 않는다.
- CTA 포함 좌표는 추가 제작툴 샘플 확보 전까지 `[INFERRED]`다.

## 3.10 CTA Registry v1

Phase C0의 규범 Registry는 `contracts/cta-registry.json`이다. 아래 액션명 목록은 v1.1.0 조사 기록으로만 보존하며 `allowedLabels` 또는 활성 CTA의 근거로 사용하지 않는다. `NONE`만 enabled이고 다른 mode의 `allowedLabels`, `allowedLandingTypes`, `requiredAssetIds`는 승인 전까지 빈 배열이다. **[PROJECT]**

아래 Registry는 공식 가이드에서 확인된 액션명을 Renderer 입력 enum으로 제한한 것이다. 랜딩 유형과의 호환성 검사는 별도 수행한다.

```json
[
  "자세히보기",
  "구매하기",
  "선물하기",
  "LIVE보기",
  "이모티콘 받기",
  "주문하기",
  "채널추가하기",
  "톡에서 설문하기",
  "톡에서 시승하기",
  "톡에서 응모하기",
  "톡에서 참여하기",
  "톡에서 예약하기",
  "톡에서 회원가입",
  "톡으로 공유하기",
  "톡으로 문의하기"
]
```

> 위 label은 향후 공식 재확인 대상이다. 비활성 mode는 label이나 landingType 검사보다 먼저 `KBR-CTA-009`로 결정적으로 차단한다. **[PROJECT]**

---

# 4. 입력 JSON Schema 1.2.0

JSON Schema Draft 2020-12를 사용한다.

규범 machine-readable Schema는 `contracts/input.schema.json`이다. 아래 inline Schema는 사람이 읽기 위한 snapshot이며, `default` annotation만으로 값을 적용하지 않는다. Raw Schema validation을 통과한 뒤 13.5의 `applyDefaults`가 모든 기본값을 실제 필드로 물질화한다. 공개 Input에는 `dryRun` 또는 `validateOnly`를 허용하지 않는다. **[PROJECT]**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://local.renderer/contracts/kakao-bizboard-input-1.2.0.schema.json",
  "title": "Kakao Bizboard Renderer Input 1.2.0",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "channel",
    "placement",
    "template",
    "advertiser",
    "copy",
    "cta",
    "assets",
    "output"
  ],
  "properties": {
    "schemaVersion": {
      "const": "1.2.0"
    },
    "channel": {
      "const": "KAKAO_MOMENT"
    },
    "placement": {
      "const": "BIZBOARD"
    },
    "template": {
      "const": "OBJECT_RIGHT"
    },
    "canvas": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "width": { "const": 1029 },
        "height": { "const": 258 }
      },
      "required": ["width", "height"],
      "default": { "width": 1029, "height": 258 }
    },
    "advertiser": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "renderMode"],
      "properties": {
        "text": {
          "type": "string",
          "minLength": 1,
          "maxLength": 40
        },
        "renderMode": {
          "const": "REQUIRE_IN_COPY",
          "default": "REQUIRE_IN_COPY"
        }
      }
    },
    "copy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["headline", "subcopy"],
      "properties": {
        "headline": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80
        },
        "subcopy": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        }
      }
    },
    "cta": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["mode", "landingType"],
          "properties": {
            "mode": { "const": "NONE" },
            "landingType": {
              "enum": ["DIRECT_URL", "ADVIEW", "KAKAO_SERVICE"]
            },
            "label": { "type": "null" },
            "iconPath": { "type": "null" }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["mode", "landingType", "label", "iconPath"],
          "properties": {
            "mode": { "const": "APP_DOWNLOAD" },
            "landingType": { "const": "APP_STORE" },
            "label": {
              "type": "string",
              "minLength": 2,
              "maxLength": 40
            },
            "iconPath": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": ["mode", "landingType", "label"],
          "properties": {
            "mode": { "const": "KAKAO_SERVICE_ACTION" },
            "landingType": {
              "enum": [
                "KAKAO_CHANNEL",
                "KAKAO_GIFT",
                "KAKAO_TALKSTORE",
                "KAKAO_MAKERS",
                "KAKAO_SHOPPING_LIVE",
                "KAKAO_EMOTICON",
                "KAKAO_ORDER",
                "KAKAO_BIZFORM",
                "KAKAO_BOOKING",
                "KAKAO_SYNC",
                "KAKAO_SHARE",
                "KAKAO_CHATBOT"
              ]
            },
            "label": {
              "enum": [
                "자세히보기",
                "구매하기",
                "선물하기",
                "LIVE보기",
                "이모티콘 받기",
                "주문하기",
                "채널추가하기",
                "톡에서 설문하기",
                "톡에서 시승하기",
                "톡에서 응모하기",
                "톡에서 참여하기",
                "톡에서 예약하기",
                "톡에서 회원가입",
                "톡으로 공유하기",
                "톡으로 문의하기"
              ]
            },
            "iconPath": {
              "type": ["string", "null"],
              "default": null
            }
          }
        }
      ]
    },
    "assets": {
      "type": "object",
      "additionalProperties": false,
      "required": ["product"],
      "properties": {
        "product": {
          "type": "object",
          "additionalProperties": false,
          "required": ["path"],
          "properties": {
            "path": {
              "type": "string",
              "minLength": 1
            },
            "expectedSha256": {
              "type": ["string", "null"],
              "pattern": "^[a-fA-F0-9]{64}$",
              "default": null
            },
            "alphaTrim": {
              "type": "boolean",
              "const": true,
              "default": true
            }
          }
        }
      }
    },
    "render": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "templateContractVersion": {
          "const": "1.2.0",
          "default": "1.2.0"
        },
        "includeDebugOverlay": {
          "type": "boolean",
          "const": false,
          "default": false
        },
        "pixelRatio": {
          "const": 1,
          "default": 1
        }
      },
      "default": {
        "templateContractVersion": "1.2.0",
        "includeDebugOverlay": false,
        "pixelRatio": 1
      }
    },
    "output": {
      "type": "object",
      "additionalProperties": false,
      "required": ["directory", "baseName"],
      "properties": {
        "directory": {
          "type": "string",
          "minLength": 1
        },
        "baseName": {
          "type": "string",
          "pattern": "^[A-Za-z0-9._-]+$",
          "minLength": 1,
          "maxLength": 120
        },
        "overwrite": {
          "type": "boolean",
          "default": false
        }
      }
    }
  }
}
```

## 4.1 유효 입력 예시

```json
{
  "schemaVersion": "1.2.0",
  "channel": "KAKAO_MOMENT",
  "placement": "BIZBOARD",
  "template": "OBJECT_RIGHT",
  "canvas": {
    "width": 1029,
    "height": 258
  },
  "advertiser": {
    "text": "자코모",
    "renderMode": "REQUIRE_IN_COPY"
  },
  "copy": {
    "headline": "거실을 바꾸는 프리미엄 소파",
    "subcopy": "당신의 취향에 맞춘 자코모"
  },
  "cta": {
    "mode": "NONE",
    "landingType": "DIRECT_URL",
    "label": null,
    "iconPath": null
  },
  "assets": {
    "product": {
      "path": "./fixtures/sofa.png",
      "expectedSha256": null,
      "alphaTrim": true
    }
  },
  "render": {
    "templateContractVersion": "1.2.0",
    "includeDebugOverlay": false,
    "pixelRatio": 1
  },
  "output": {
    "directory": "./out",
    "baseName": "jakomo-bizboard-object-right",
    "overwrite": false
  }
}
```

---

# 5. 출력 계약 2.0.0

Phase C0에서 persisted `render-manifest.json`과 비영속 response envelope를 분리했다. 규범 machine-readable 계약은 다음 파일이다. **[PROJECT]**

- `contracts/output.schema.json` — published output contract `2.0.0`
- `contracts/render-manifest.schema.json` — persisted manifest `1.0.0`
- `contracts/response-envelope.schema.json` — runtime response `1.0.0`

아래 JSON block은 **LEGACY v1.1.0 / NON-NORMATIVE** snapshot이다. 변경 이력 확인용으로만 보존하며 구현하면 안 된다. 특히 legacy `artifacts.manifest.sha256` 구조는 폐기되었다.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://local.renderer/schema/kakao-bizboard-output-v1.json",
  "title": "Kakao Bizboard Renderer Output v1",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "rendererVersion",
    "templateId",
    "templateContractVersion",
    "status",
    "downloadAllowed",
    "inputDigest",
    "artifacts",
    "measurements",
    "validation"
  ],
  "properties": {
    "schemaVersion": { "const": "1.1" },
    "rendererVersion": { "type": "string" },
    "templateId": {
      "const": "KAKAO_MOMENT_BIZBOARD_OBJECT_RIGHT_1029X258_V1"
    },
    "templateContractVersion": { "const": "1.1.0" },
    "status": { "enum": ["PASS", "FAIL"] },
    "downloadAllowed": { "type": "boolean" },
    "inputDigest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "artifacts": {
      "type": "object",
      "additionalProperties": false,
      "required": ["png", "manifest"],
      "properties": {
        "png": {
          "oneOf": [
            { "type": "null" },
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["path", "sha256", "bytes", "width", "height", "format"],
              "properties": {
                "path": { "type": "string" },
                "sha256": {
                  "type": "string",
                  "pattern": "^[a-f0-9]{64}$"
                },
                "bytes": { "type": "integer", "minimum": 1 },
                "width": { "const": 1029 },
                "height": { "const": 258 },
                "format": { "enum": ["PNG-24", "PNG-32"] },
                "hasAlpha": { "const": true }
              }
            }
          ]
        },
        "manifest": {
          "type": "object",
          "additionalProperties": false,
          "required": ["path", "sha256"],
          "properties": {
            "path": { "type": "string" },
            "sha256": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            }
          }
        }
      }
    },
    "measurements": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "headlineWidthPx",
        "subcopyWidthPx",
        "advertiserMatchedInCopy",
        "advertiserMatchedField",
        "copyObjectGapPx",
        "objectOpaqueWidthPx",
        "objectOpaqueHeightPx",
        "objectScale",
        "objectSlot",
        "productPlacedBox"
      ],
      "properties": {
        "headlineWidthPx": { "type": "number", "minimum": 0 },
        "subcopyWidthPx": { "type": "number", "minimum": 0 },
        "ctaWidthPx": { "type": ["number", "null"], "minimum": 0 },
        "advertiserMatchedInCopy": { "type": "boolean" },
        "advertiserMatchedField": {
          "type": ["string", "null"],
          "enum": ["headline", "subcopy", null]
        },
        "copyObjectGapPx": { "type": "number" },
        "objectOpaqueWidthPx": { "type": "number", "minimum": 0 },
        "objectOpaqueHeightPx": { "type": "number", "minimum": 0 },
        "objectScale": { "type": "number", "exclusiveMinimum": 0 },
        "objectSlot": {
          "type": "object",
          "additionalProperties": false,
          "required": ["x", "y", "width", "height"],
          "properties": {
            "x": { "const": 666 },
            "y": { "const": 0 },
            "width": { "const": 315 },
            "height": { "const": 258 }
          }
        },
        "productPlacedBox": {
          "type": "object",
          "additionalProperties": false,
          "required": ["x", "y", "width", "height"],
          "properties": {
            "x": { "type": "number" },
            "y": { "type": "number" },
            "width": { "type": "number", "exclusiveMinimum": 0 },
            "height": { "type": "number", "exclusiveMinimum": 0 }
          }
        },
        "alphaTrimBox": {
          "type": "object",
          "additionalProperties": false,
          "required": ["x", "y", "width", "height"],
          "properties": {
            "x": { "type": "integer", "minimum": 0 },
            "y": { "type": "integer", "minimum": 0 },
            "width": { "type": "integer", "minimum": 1 },
            "height": { "type": "integer", "minimum": 1 }
          }
        }
      }
    },
    "validation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["errorCount", "warningCount", "infoCount", "issues"],
      "properties": {
        "errorCount": { "type": "integer", "minimum": 0 },
        "warningCount": { "type": "integer", "minimum": 0 },
        "infoCount": { "type": "integer", "minimum": 0 },
        "issues": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["code", "severity", "path", "message"],
            "properties": {
              "code": { "type": "string" },
              "severity": { "enum": ["ERROR", "WARNING", "INFO"] },
              "path": { "type": "string" },
              "message": { "type": "string" },
              "expected": {},
              "actual": {},
              "bbox": {
                "type": ["object", "null"],
                "properties": {
                  "x": { "type": "number" },
                  "y": { "type": "number" },
                  "width": { "type": "number" },
                  "height": { "type": "number" }
                },
                "required": ["x", "y", "width", "height"]
              }
            }
          }
        }
      }
    }
  }
}
```

## 5.1 Phase C0 출력 불변식

```text
downloadAllowed === (errors.length === 0)
status === (downloadAllowed ? "PASS" : "FAIL")
errors.length > 0  => final output.png MUST NOT exist
errors.length > 0  => final render-manifest.json MUST NOT exist
errors.length === 0 => output.png and render-manifest.json MUST both exist
render-manifest.json MUST NOT contain its own SHA-256
responseEnvelope.manifestDigest === SHA256(published render-manifest.json)
responseEnvelope.pngDigest === SHA256(published output.png)
pngCount === 1
manifestCount === 1
responseEnvelopeCount === 1
```

response envelope는 저장 파일이 아니며 세 번째 최종 artifact로 계산하지 않는다. `output.directory`와 `output.baseName`은 trusted output root 아래 job directory를 결정하고, 그 내부 published filename은 각각 `output.png`, `render-manifest.json`으로 고정한다. **[PROJECT]**

---

# 6. 이미지 Alpha Trim 규칙

## 6.1 OBJECT_RIGHT 입력 조건

1. 제품 이미지는 PNG만 허용한다.
2. alpha channel이 반드시 존재해야 한다.
3. 완전 불투명 사각형 배경 이미지는 허용하지 않는다.
4. Renderer는 배경 제거를 수행하지 않는다.
5. EXIF orientation에 의존하지 않고 픽셀을 정규 방향으로 디코딩한다.

## 6.2 Trim 알고리즘

```text
TRIM_PRESERVE_THRESHOLD = 1       // alpha >= 1은 Trim 보존 대상
LAYOUT_VISIBLE_THRESHOLD = 8      // alpha >= 8은 bbox/gap/containment 대상
ALPHA_SOLID_THRESHOLD = 245
NOISE_COMPONENT_RATIO = 0.0005
CONNECTEDNESS = 8
MAX_UPSCALE = 1.5
```

1. PNG를 RGBA로 디코딩한다.
2. `alpha >= 1`인 모든 픽셀의 최소 경계 상자를 보존 Trim box로 계산한다.
3. `alpha >= 8`인 픽셀이 없으면 `KBR-ASSET-005` ERROR다.
4. layout bbox는 `alpha >= 8` 픽셀만 사용한다.
5. 8-neighbor 연결요소 중 pixel count가 가장 큰 요소를 주 콘텐츠로 선택한다. 동률이면 `(minY,minX,maxY,maxX)` 사전식 순서가 앞선 요소를 선택한다.
6. 주 콘텐츠와 분리된 요소의 pixel count가 주 콘텐츠 pixel count의 `0.0005` 미만이면 layout bbox 확장에서는 제외하되 원본/보존 RGBA에서 삭제하지 않고 `KBR-ASSET-012` Warning을 발생시킨다. 그 이상이면 layout bbox에 포함한다.
7. 내부 투명 hole과 `alpha >= 1` 반투명 그림자·fringe를 원본 alpha 그대로 보존하며 alpha를 이진화하지 않는다.
8. 완전 투명 픽셀의 RGB 값은 시각 콘텐츠 또는 bbox 근거로 사용하지 않는다.
9. Trim 후 원본 비율을 유지하여 `Object slot(x=666, y=0, w=315, h=258)` 전체에 `contain` 배치한다.
10. `scale = min(315 / trimmedWidth, 258 / trimmedHeight)`로 계산하되 `scale > 1.5`이면 ERROR다.
11. `resizedWidth = max(1, round(trimmedWidth * scale))`, `resizedHeight = max(1, round(trimmedHeight * scale))`로 고정한다.
12. `destinationX = 666 + floor((315 - resizedWidth) / 2)`, `destinationY = floor((258 - resizedHeight) / 2)`로 고정한다. 홀수 잔여 pixel은 우측 또는 하단에 1px 더 남긴다.
13. Resize kernel은 `Lanczos3`로 고정하고 좌우·상하 크롭을 금지한다.
14. 색 공간은 sRGB로 정규화한다.
15. premultiplied alpha 처리 후 정상 RGBA로 export한다.

## 6.3 Alpha 관련 판정

| 조건 | 결과 |
|---|---|
| alpha channel 없음 | ERROR |
| visible pixel 없음 | ERROR |
| 네 모서리 모두 alpha 255이며 전체 프레임의 95% 이상 불투명 | ERROR: 배경 포함 의심 |
| 외딴 alpha noise 존재 | WARNING |
| 반투명 fringe가 trim 경계에 2px 이상 연속 | WARNING |
| 제품 실제 폭 219px 미만 | WARNING |
| 제품이 1.5× 초과 업스케일 필요 | ERROR |
| Object slot 밖으로 제품 visible pixel 이탈 | ERROR |
| 좌우 또는 상하 실제 픽셀 크롭 | ERROR |

## 6.4 제품 이미지 내부 텍스트

- OCR을 사용한 자동 텍스트 검출은 v1 범위에서 제외한다.
- 사용자가 제품 PNG 내부에 광고 카피를 포함하면 공식 가이드 위반 가능성이 있다.
- 자동으로 확정할 수 없으므로 `MANUAL-IMG-001` 항목으로 수동 확인한다.

---

# 7. 텍스트 Layout 규칙

## 7.1 폰트 정책

1. Renderer는 프로젝트가 고정한 로컬 폰트 파일만 사용한다.
2. 시스템 fallback을 허용하지 않는다.
3. 폰트 파일이 없거나 SHA-256이 일치하지 않으면 렌더링을 중단한다.
4. 폰트 파일 자체는 이 문서에 포함하지 않는다.
5. 폰트의 배포·번들 정책은 별도의 라이선스 검토 후 확정한다.
6. Phase C0 당시 Spoqa Bold/Regular intake는 `UNRESOLVED_ASSET` 검사 결과였으나, 현재 Kakao
   `contracts/font-asset-registry.json`은 pinned Spoqa 자산으로 `RESOLVED_ASSET`이다. N7.4
   SmartChannel Nanum roles는 별도의 bundled registry에서 관리한다. **[PROJECT]**

## 7.2 공식 스타일과 Renderer 매핑

| 요소 | 공식 | Renderer v1 |
|---|---|---|
| Headline | Spoqa Han Sans Bold 48pt, #4C4C4C | pinned font Bold 48px, #4C4C4C |
| Subcopy | Spoqa Han Sans Regular 39pt, #777777 | pinned font Regular 39px, #777777 |
| CTA action row | Spoqa Han Sans 26pt, #777777 | pinned font Regular 26px, #777777 |
| Advertiser | 카피 또는 오브젝트에 광고주체 표기 | 별도 렌더 없음, 카피 포함 여부 검증 [PROJECT] |

> `pt → px`를 1:1로 매핑한 것은 PSD 기반 웹 배너 렌더링을 재현하기 위한 v1 구현 계약이며 카카오 공식 변환 규칙을 주장하지 않는다.

## 7.3 공통 정규화

- Unicode NFC 정규화
- 문자열 앞뒤 공백 제거
- 연속 공백 2개 이상을 1개로 정규화
- `\r`, `\n`, `\t` 금지
- zero-width character 금지
- bidi control character 금지
- variation selector와 emoji sequence 금지

## 7.4 줄바꿈

- Headline: 한 줄 고정
- Subcopy: 한 줄 고정
- CTA label: 한 줄 고정
- 자동 줄바꿈 금지
- overflow 시 축소하지 않고 ERROR 처리

## 7.5 폭 측정

1. 실제 렌더링에 사용할 동일 폰트 엔진으로 측정한다.
2. glyph advance와 kerning을 포함한다.
3. 소수점 폭은 보존하고 충돌 계산에서 `ceil`한다.
4. Headline과 Subcopy 중 적어도 하나의 실제 폭이 `290px 이상`이어야 한다.
5. Headline 또는 Subcopy의 우측 끝은 `x=633`을 넘을 수 없다.
6. 실제 카피 불투명 bbox와 실제 제품 불투명 bbox 사이 수평 간격이 `33px 이상`이어야 한다.

## 7.6 금지 문자

자동 Validator는 다음을 금지한다.

- Unicode Emoji Presentation 문자
- pictograph와 dingbat 계열
- 자판 외 장식 특수기호
- emoticon 패턴: `^^`, `:D`, `:-)`, `☞`, `☑`, `♨`
- 제어문자
- 줄바꿈

다음은 허용한다.

- 한글, 영문, 숫자
- 일반 문장부호
- 가격 문맥의 `→`
- 공식 CTA Registry에 포함된 문자열의 공백

## 7.7 문구 관계

- `headline !== subcopy`이어야 한다.
- 대소문자·공백 정규화 후 동일한 경우도 ERROR다.
- 정규화된 `advertiser.text`는 Headline 또는 Subcopy 중 하나에 연속 문자열로 포함되어야 한다.
- 광고주체는 별도 레이어로 중복 렌더링하지 않는다.

## 7.8 자동 축소 금지

공식 스타일 고정을 위해 다음을 금지한다.

- 글자 크기 자동 축소
- 자간 강제 축소
- 비균등 수평 스케일
- line-height 축소
- 임의 색상 변경
- 그림자, 외곽선, 그라데이션, 하이라이트

---

# 8. Validator 오류 코드

## 8.1 Issue 형식

```ts
type ValidationIssue = {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  bbox?: { x: number; y: number; width: number; height: number };
};
```

## 8.2 입력·Schema

| Code | Severity | 조건 |
|---|---|---|
| KBR-INPUT-001 | ERROR | JSON 파싱 실패 |
| KBR-INPUT-002 | ERROR | Input JSON Schema 불일치 |
| KBR-INPUT-003 | ERROR | 지원하지 않는 channel |
| KBR-INPUT-004 | ERROR | 지원하지 않는 placement |
| KBR-INPUT-005 | ERROR | 지원하지 않는 template |
| KBR-INPUT-006 | ERROR | Canvas가 1029×258이 아님 |
| KBR-INPUT-007 | ERROR | 필수 문자열 누락 또는 공백 |
| KBR-INPUT-008 | ERROR | 출력 파일명 안전 규칙 위반 |
| KBR-INPUT-009 | ERROR | 출력 경로 탈출 또는 허용되지 않은 경로 |
| KBR-INPUT-010 | ERROR | overwrite=false인데 파일 존재 |

## 8.3 폰트·런타임

| Code | Severity | 조건 |
|---|---|---|
| KBR-SYSTEM-001 | ERROR | 필수 폰트 파일 없음 |
| KBR-SYSTEM-002 | ERROR | 폰트 SHA-256 불일치 |
| KBR-SYSTEM-003 | ERROR | 렌더 엔진 초기화 실패 |
| KBR-SYSTEM-004 | ERROR | 임시 파일 생성 또는 원자적 저장 실패 |
| KBR-SYSTEM-005 | ERROR | 예상하지 못한 내부 Validator 예외 |
| KBR-SYSTEM-006 | ERROR | 네트워크 호출 시도 감지 |

## 8.4 제품 이미지

| Code | Severity | 조건 |
|---|---|---|
| KBR-ASSET-001 | ERROR | 제품 파일 없음 |
| KBR-ASSET-002 | ERROR | PNG가 아님 |
| KBR-ASSET-003 | ERROR | PNG 디코딩 실패 |
| KBR-ASSET-004 | ERROR | alpha channel 없음 |
| KBR-ASSET-005 | ERROR | visible alpha pixel 없음 |
| KBR-ASSET-006 | ERROR | 불투명 배경 포함 의심 기준 초과 |
| KBR-ASSET-007 | ERROR | 기대 SHA-256 불일치 |
| KBR-ASSET-008 | ERROR | 1.5× 초과 업스케일 필요 |
| KBR-ASSET-009 | ERROR | 제품 실제 픽셀이 Object slot 밖으로 나감 |
| KBR-ASSET-010 | ERROR | 제품 좌우 크롭 발생 |
| KBR-ASSET-011 | WARNING | 실제 오브젝트 폭 219px 미만 |
| KBR-ASSET-012 | WARNING | 외딴 alpha noise 감지 |
| KBR-ASSET-013 | WARNING | alpha fringe 감지 |
| KBR-ASSET-014 | WARNING | 입력 제품 PNG가 150KB 초과 |
| KBR-ASSET-MIME-NOT-ALLOWED | ERROR | Template Capability가 허용하지 않는 실제 입력 MIME |
| KBR-ASSET-MIME-EXTENSION-MISMATCH | ERROR | 파일 확장자/선언 MIME과 bytes에서 감지한 MIME 불일치 |
| KBR-IMAGE-DECODE-FAILED | ERROR | PNG/JPEG decoder 실패 또는 손상 bytes |
| KBR-IMAGE-DIMENSION-INVALID | ERROR | decode 후 width/height가 유효하지 않음 |
| KBR-ALPHA-CHANNEL-REQUIRED | ERROR | OBJECT_RIGHT에 alpha channel이 없는 입력 |
| KBR-EXIF-ORIENTATION-INVALID | ERROR | JPEG EXIF Orientation이 malformed 또는 1..8 밖 |

## 8.5 텍스트

| Code | Severity | 조건 |
|---|---|---|
| KBR-TEXT-001 | ERROR | 금지 Unicode 또는 emoji 포함 |
| KBR-TEXT-002 | ERROR | 줄바꿈 또는 제어문자 포함 |
| KBR-TEXT-003 | ERROR | Headline과 Subcopy 동일 |
| KBR-TEXT-004 | ERROR | Headline overflow |
| KBR-TEXT-005 | ERROR | Subcopy overflow |
| KBR-TEXT-006 | ERROR | Headline·Subcopy 모두 290px 미만 |
| KBR-TEXT-007 | ERROR | 광고주체가 Headline 또는 Subcopy에 포함되지 않음 |
| KBR-TEXT-008 | ERROR | CTA label overflow |
| KBR-TEXT-009 | ERROR | 허용되지 않은 취소선 요청 |
| KBR-TEXT-010 | INFO | 광고주체가 Headline과 Subcopy 양쪽에 모두 포함됨 |

## 8.6 CTA

| Code | Severity | 조건 |
|---|---|---|
| KBR-CTA-001 | ERROR | 지원하지 않는 CTA mode |
| KBR-CTA-002 | ERROR | CTA Registry에 없는 label |
| KBR-CTA-003 | ERROR | APP_DOWNLOAD label에 앱/APP 없음 |
| KBR-CTA-004 | ERROR | CTA와 landingType 불일치 |
| KBR-CTA-005 | ERROR | 필수 CTA 아이콘 누락 |
| KBR-CTA-006 | ERROR | CTA 아이콘이 38×38 요구조건을 충족하지 않음 |
| KBR-CTA-007 | ERROR | 액션명 임의 축약·변형 |
| KBR-CTA-008 | ERROR | 일반 배너에 임의 CTA button shape 요청 |
| KBR-CTA-009 | ERROR | Registry에 존재하지만 `enabled=false`인 CTA mode 입력 [PROJECT] |

## 8.7 Layout

| Code | Severity | 조건 |
|---|---|---|
| KBR-LAYOUT-001 | ERROR | 카피와 제품 실제 bbox 간격 33px 미만 |
| KBR-LAYOUT-002 | ERROR | 카피 bbox가 Text hard edge 초과 |
| KBR-LAYOUT-003 | ERROR | CTA 행과 Headline 충돌 |
| KBR-LAYOUT-004 | ERROR | Headline과 Subcopy 충돌 |
| KBR-LAYOUT-005 | ERROR | 제품 visible bbox가 Object slot을 초과 |
| KBR-LAYOUT-006 | ERROR | 제품 배치 결과가 `CENTER_CENTER contain` 계약과 불일치 |
| KBR-LAYOUT-007 | ERROR | 요소가 Canvas 밖으로 나감 |
| KBR-LAYOUT-008 | ERROR | 비균등 스케일 또는 회전 감지 |
| KBR-LAYOUT-009 | WARNING | 제품 visible pixel이 Object slot 경계에 1px 이내로 근접 |

## 8.8 출력

| Code | Severity | 조건 |
|---|---|---|
| KBR-OUTPUT-001 | ERROR | 최종 PNG 미생성 |
| KBR-OUTPUT-002 | ERROR | 최종 크기 1029×258 불일치 |
| KBR-OUTPUT-003 | ERROR | PNG IHDR이 `colorType=6 RGBA`, `bitDepth=8` 계약과 불일치 [PROJECT] |
| KBR-OUTPUT-004 | ERROR | alpha channel 없음 |
| KBR-OUTPUT-005 | ERROR | 파일 크기 `300001` decimal bytes 이상 [PROJECT] |
| KBR-OUTPUT-006 | ERROR | Preview 배경이 최종 PNG에 합성됨 |
| KBR-OUTPUT-007 | ERROR | debug overlay가 최종 PNG에 포함됨 |
| KBR-OUTPUT-008 | ERROR | 동일 입력 반복 렌더 hash 불일치 |
| KBR-OUTPUT-009 | WARNING | 파일 크기 `270001..300000` decimal bytes [PROJECT] |
| KBR-OUTPUT-010 | INFO | 최종 PNG 및 manifest 생성 완료 |
| KBR-OUTPUT-011 | ERROR | `#D9D9D9` 가이드 사각형 또는 `Image` placeholder가 최종 PNG에 잔존 |

## 8.9 Download gate

| Code | Severity | 조건 | 동작 |
|---|---|---|---|
| KBR-DOWNLOAD-001 | ERROR | `downloadAllowed=false` 상태에서 다운로드 또는 publish 시도 | 파일 반환 금지, Core와 IPC 양쪽에서 차단 [PROJECT] |

JSON Schema validator의 `required`, `type`, `enum`, `const`, `additionalProperties`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `oneOf`, `anyOf` 오류는 `contracts/ajv-error-mapping.json`에 따라 KBR code로 변환한다. AJV 원문 메시지는 외부 안정 계약이 아니다. Issue는 severity(`ERROR`, `WARNING`, `INFO`), input JSON pointer, KBR code, message key 순으로 정렬한다. **[PROJECT]**

---

# 9. Acceptance 기준

## 9.1 자동 Acceptance

### A. Build & Test

- [ ] clean install 성공
- [ ] typecheck 성공
- [ ] lint 성공
- [ ] unit test 성공
- [ ] integration test 성공
- [ ] Golden Image test 성공
- [ ] 네트워크 없는 환경에서 전체 테스트 성공

### B. Input

- [ ] 유효 Input JSON이 Schema를 통과
- [ ] channel, placement, template, canvas의 모든 비지원 값 차단
- [ ] OBJECT_RIGHT는 PNG 이외 포맷과 alpha 없는 PNG를 차단
- [ ] THUMBNAIL_BOX_RIGHT는 유효 PNG/JPG/JPEG를 허용하고 WebP/GIF/AVIF/BMP/TIFF/SVG를 차단
- [ ] 경로 traversal 차단

### C. Alpha Trim

- [ ] 완전 투명 이미지 차단
- [ ] 불투명 배경 이미지 차단
- [ ] 반투명 그림자 보존
- [ ] 내부 투명 구멍 보존
- [ ] 외딴 noise Warning 발생
- [ ] Trim bbox가 fixture 기대값과 일치

### D. Text

- [ ] Headline 48px Bold로 렌더
- [ ] Subcopy 39px Regular로 렌더
- [ ] 색상 정확히 일치
- [ ] 동일 문구 차단
- [ ] 양쪽 모두 290px 미만일 때 차단
- [ ] Text hard edge overflow 차단
- [ ] emoji·금지 특수문자 차단
- [ ] 자동 축소 미발생

### E. Layout

- [ ] Object slot `315×258` 준수
- [ ] 실제 copy-object gap `33px 이상`
- [ ] 좌우 크롭 없음
- [ ] Object slot이 정확히 `x=666, y=0, w=315, h=258`
- [ ] 제품이 Object slot 전체를 inset 없이 contain 대상으로 사용
- [ ] 제품 기본 정렬이 `CENTER_CENTER`
- [ ] 광고주체가 Headline 또는 Subcopy에 포함됨
- [ ] 별도 광고주체/로고 레이어가 생성되지 않음
- [ ] 모든 불투명 픽셀이 Canvas 내부

### F. CTA

- [ ] `NONE` 정상 처리
- [ ] `APP_DOWNLOAD` 입력 시 `KBR-CTA-009` 차단
- [ ] `KAKAO_SERVICE_ACTION` 입력 시 `KBR-CTA-009` 차단
- [ ] 승인 icon Registry가 비어 있고 비활성 CTA가 enabled되지 않음
- [ ] 임의 button shape 입력 차단

### G. Output

- [ ] `1029×258`
- [ ] PNG IHDR `colorType=6`, `bitDepth=8`, RGBA
- [ ] `300000` decimal bytes 이하
- [ ] 시스템 회색 박스 미포함
- [ ] `#D9D9D9` 이미지 가이드와 `Image` placeholder 미포함
- [ ] debug overlay 미포함
- [ ] `ERROR 0`일 때만 PNG 다운로드 가능
- [ ] `ERROR ≥1`이면 PNG 다운로드 불가능
- [ ] manifest의 SHA-256이 실제 파일과 일치
- [ ] 동일 입력 3회 반복 결과 SHA-256 동일

## 9.2 필수 Golden Fixtures

Phase C0는 fixture의 **요구사항과 naming만 동결**하며 reference 외 실제 대규모 fixture 생성은 구현 단계로 이관한다. 100개 fixture는 Contract Freeze 선행 조건이 아니다. **[PROJECT]**

1. 가로형 소파 PNG + CTA 없음
2. 세로형 제품 PNG + CTA 없음
3. 반투명 그림자 제품 PNG
4. APP_DOWNLOAD 비활성 mode 오류
5. KAKAO_SERVICE_ACTION 비활성 mode 오류
6. 최대 폭에 가까운 한글 카피
7. 영문·숫자 혼합 카피
8. 광고주체가 Headline·Subcopy 어디에도 포함되지 않은 케이스
9. `300001` decimal bytes 이상을 유발하는 복잡 이미지
10. emoji·금지문자 입력

## 9.3 수동 Acceptance

### M-001 카카오 제작툴 기준 파일 비교

- `reference/kakao-tool/OBJECT_RIGHT.png`를 100% 배율로 비교
- Object slot `x=666, y=0, w=315, h=258` 확인
- 기준 샘플의 Main visible ink bbox `49,77,523,45` 확인
- 기준 샘플의 Sub visible ink bbox `50,144,533,36` 확인
- 텍스트 baseline 추론값과 제품 `CENTER_CENTER contain`의 시각 균형 승인

### M-002 광고주체 적합성

- 광고주명, 브랜드명, 상품명 중 실제 광고주체로 인정 가능한 표기인지 확인
- Headline 또는 Subcopy에 명확하게 포함되어 있는지 확인
- 제품에만 표시된 광고주체를 인정하려는 경우 `MANUAL-ADV-001`로 별도 승인

### M-003 제품 이미지 품질

- 제품이 카피와 연관되는지 확인
- 합성 부자연스러움, 저해상도, 왜곡 여부 확인
- 제품 PNG 내부 임의 텍스트 여부 확인

### M-004 문구·심사 정책

- 허위·과장, 자극적 유인, 업종별 법적 고지 필요 여부 확인
- 가격·할인·최상급 표현의 증빙 가능 여부 확인
- 저작권·상표권·초상권 확인

### M-005 CTA·랜딩 일치

- CTA label과 실제 랜딩 페이지 기능이 일치하는지 확인
- 카카오 서비스 액션명이 실제 랜딩 동작과 일치하는지 확인

### M-006 카카오모먼트 외부 UAT

- Renderer 자체는 업로드 기능을 포함하지 않는다.
- 출시 전 사람이 카카오모먼트 소재 등록 화면에서 PNG를 업로드한다.
- 플랫폼 미리보기에서 잘림·배경·가독성을 확인한다.
- 실제 심사 결과는 Renderer의 자동 검증과 별도 기록한다.
- 보류가 발생하면 공식 사유를 기준으로 Spec 또는 Validator를 버전업한다.

## 9.4 Release Gate

다음 조건을 모두 만족해야 v1을 Release Candidate로 승인한다.

```text
Automated Acceptance: ALL PASS
Manual Acceptance M-001..M-005: ALL APPROVED
External UAT M-006: UPLOADABLE AND PREVIEW ACCEPTABLE
Known ERROR bypass: 0
Open P0/P1 defects: 0
```

---

# 10. Codex에 전달할 구현 계약

## 10.1 최상위 지시

Codex는 이 문서를 단일 진실 공급원으로 사용한다. 기존 플룸 코드베이스의 Agent, Queue, Railway, PostgreSQL, Evidence 모듈을 복사하거나 의존하지 않는다.

### MUST

- 독립 repository 또는 독립 root package
- 로컬 실행
- 네트워크 호출 0
- 최종 PNG 1개
- Validator manifest 1개
- `ERROR 0` 다운로드 게이트
- 고정 폰트와 고정 좌표
- 카카오 제작툴 기준 `OBJECT_RIGHT.png` 좌표 fixture 검증
- deterministic rendering
- 모든 오류 코드 테스트

### MUST NOT

- OpenAI 또는 외부 AI API
- Railway
- PostgreSQL/Redis/MinIO
- background worker
- remote telemetry
- 자동 업로드
- 여러 템플릿 일반화
- 자동 글자 크기 축소
- 자동 배경 제거
- 공식 근거 없는 CTA 버튼 생성

## 10.2 권장 기술 구조

```text
kakao-bizboard-renderer/
├─ docs/
│  └─ kakao-bizboard-renderer-spec-v1.md
├─ apps/
│  └─ desktop/
│     ├─ electron-main/
│     └─ renderer-ui/
├─ packages/
│  ├─ core/
│  │  ├─ schema/
│  │  ├─ normalize/
│  │  ├─ alpha-trim/
│  │  ├─ layout/
│  │  ├─ render/
│  │  ├─ validate/
│  │  └─ manifest/
│  └─ cli/
├─ assets/
│  ├─ fonts/
│  │  └─ README.md
│  └─ approved-icons/
│     └─ README.md
├─ reference/
│  └─ kakao-tool/
│     ├─ OBJECT_RIGHT.png
│     ├─ THUMBNAIL_MULTI_RIGHT.png
│     ├─ MASK_SEMICIRCLE_RIGHT.png
│     └─ THUMBNAIL_BOX_RIGHT.png
├─ fixtures/
│  ├─ valid/
│  └─ invalid/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ golden/
└─ out/
```

## 10.3 기술 선택

- Language: TypeScript strict mode
- Desktop shell: Electron
- UI: React + Vite
- Core renderer: UI와 분리된 pure Node package
- Schema validation: AJV Draft 2020-12
- Test: Vitest
- Hash: Node crypto SHA-256

> Phase C0에서는 PNG decode/resize/raster/text engine 라이브러리를 선택하지 않는다. 후속 구현 단계에서 후보를 검증한 뒤 lockfile에 고정한다. v1 Golden 공식 환경은 Windows 10/11 x64만 지원하며 macOS/Linux tolerance는 별도 계약 버전으로 이관한다. **[PROJECT]**

## 10.4 Core API 계약

```ts
export type RenderRequest = KakaoBizboardInputV1;
export type RenderResponse = KakaoBizboardOutputV1;

export async function renderKakaoBizboard(
  request: RenderRequest
): Promise<RenderResponse>;
```

공개 Input 및 공개 Core API에는 `dryRun`, `validateOnly` 또는 publish gate를 우회하는 mode를 노출하지 않는다. 내부 단위 테스트 함수는 단계별 실행이 가능하지만 공개 계약이 아니다. **[PROJECT]**

### 실행 단계

```text
parse
→ schemaValidate
→ applyDefaults
→ normalizeUnicodeNFC
→ applyStringTrimPolicy
→ createCanonicalInput
→ serializeRFC8785JCS
→ computeInputDigests
→ verifyAssets
→ verifyFonts
→ decodeProduct
→ alphaTrim
→ calculateLayout
→ validateAdvertiserInCopy
→ preRenderValidate
→ renderRGBA
→ encodeLosslessPNG
→ postRenderValidate
→ if ERROR: denyPublish
→ writeStagedPng
→ writeStagedManifestWithoutSelfDigest
→ flushAndCloseBoth
→ renameFinalManifest
→ renameFinalPngLast
→ computeResponseEnvelopeDigests
→ return response
```

## 10.5 다운로드 게이트 구현

UI에서 버튼 상태만 제어해서는 안 된다. Core와 IPC 양쪽에서 강제한다.

```ts
if (result.validation.errorCount !== 0) {
  throw new DownloadBlockedError("KBR-DOWNLOAD-001");
}
```

- renderer process에서 임의 IPC 호출로 우회할 수 없어야 한다.
- main process는 manifest를 다시 읽고 `errorCount === 0`을 확인한다.
- 실제 PNG SHA-256은 manifest의 `outputPngDigest` 및 response의 `pngDigest`와 일치해야 한다.
- 실제 manifest SHA-256은 response의 `manifestDigest`와 일치해야 한다. manifest 내부에는 자기 digest를 기록하지 않는다.
- `KBR-DOWNLOAD-001`은 `contracts/error-registry.json`의 정식 ERROR다.

## 10.6 결정성 계약

Input digest는 RFC 8785 JCS 원칙과 프로젝트 규칙으로 생성한 Canonical Input UTF-8 bytes의 SHA-256이다. 구현 라이브러리는 Phase C0에서 선택하지 않는다. **[PROJECT]**

```text
default가 물질화된 canonical input JSON
+ product file SHA-256
+ font file SHA-256 list
+ approved icon SHA-256 list
+ renderer version
+ template contract version
```

- UTF-8, BOM 없음
- digest 전 모든 문자열 Unicode NFC
- object key canonical order, array order 보존
- 불필요한 whitespace 없음
- 파일 경로는 OS 절대 경로가 아닌 정규화된 프로젝트 상대 참조값

Golden test는 최소 다음을 고정한다.

- PNG SHA-256
- file bytes
- reference fixture SHA-256
- alpha trim box
- object slot `{x:666,y:0,width:315,height:258}`
- product placed box
- layout bounding boxes
- text measured widths
- validator issue list

## 10.7 파일 인코딩 계약

- 최종 output은 PNG IHDR `colorType=6`, `bitDepth=8`의 RGBA PNG-32로만 생성한다. **[PROJECT]**
- alpha가 실제로 필요 없는 경우에도 v1은 투명 배경 계약을 유지한다.
- lossless compression만 사용한다.
- palette PNG로 자동 변환하지 않는다.
- `<=270000` decimal bytes는 PASS, `270001..300000`은 WARNING, `>=300001`은 ERROR다.
- 크기 초과 시 품질을 임의 저하하지 않는다.
- job directory 내부 최종 파일명: `output.png`
- job directory 내부 manifest 파일명: `render-manifest.json`

위 10.7의 PNG-32/`output.png` 규칙은 Template-locked F0–F2 baseline이다.
F3A fixed FREEFORM Profile은 Profile의 명시적 `PNG` 또는 `JPEG` output과
`output.jpg` 경로를 사용하며, JPEG 세부 규칙은 §29.2를 따른다. **[PROJECT]**

## 10.8 UI 최소 요구사항

1. Template Capability에 맞는 제품 이미지(PNG/JPG/JPEG) 선택
2. 광고주체 입력
3. Headline 입력
4. Subcopy 입력
5. CTA mode 선택
6. CTA label과 landing type 선택
7. 미리보기
8. 실시간 폭·간격 측정값 표시
9. ERROR/WARNING 목록
10. `ERROR 0`일 때만 다운로드 활성화
11. Preview guide overlay 토글
12. Input JSON 내보내기·불러오기

## 10.9 테스트 우선순위

### Phase A — Contract

- JSON Schema
- error code registry
- template constants
- `OBJECT_RIGHT.png` fixture SHA-256 및 좌표 측정 테스트
- font verification

### Phase B — Image

- PNG decode
- alpha trim
- resize
- bbox

### Phase C — Text & Layout

- text normalize
- font metrics
- CTA Registry
- collision detection

### Phase D — Render

- transparent canvas
- layer composition
- PNG encode
- `300000` decimal byte hard-limit validation

### Phase E — Desktop Gate

- form
- preview
- IPC
- download gate

### Phase F — Acceptance

- fixtures
- golden tests
- manual checklist
- external Kakao Moment UAT record

## 10.10 완료 정의

Codex는 다음을 모두 제시해야 작업 완료로 본다.

```yaml
deliverables:
  spec: PASS
  input_schema: PASS
  output_schema: PASS
  renderer_core: PASS
  validator: PASS
  desktop_ui: PASS
  cli: PASS
  golden_tests: PASS
  error_zero_download_gate: PASS
  network_calls: 0
  external_services: 0
  pngCount: 1
  manifestCount: 1
  responseEnvelopeCount: 1

quality_gates:
  typecheck: PASS
  lint: PASS
  unit_tests: PASS
  integration_tests: PASS
  golden_tests: PASS
  clean_worktree: PASS
```

## 10.11 구현 중 변경 금지 사항

Codex는 다음을 임의 변경하지 않는다.

- Canvas 크기
- Template ID
- Object slot `x=666, y=0, w=315, h=258`
- 메인·서브 폰트 크기와 색상
- 33px 최소 간격
- 광고주체 별도 레이어 금지 및 카피 포함 검증
- 290px 최소 카피 폭 규칙
- `300000` decimal byte hard limit
- 투명 배경
- ERROR 0 다운로드 조건
- 출력 1개 제한

변경이 필요하면 구현 전에 이 문서의 `templateContractVersion` 또는 `document version`을 올리는 변경안을 먼저 작성한다.

---

# 11. 알려진 한계와 후속 검증

1. Canvas와 `OBJECT_RIGHT` 이미지 영역은 카카오 비즈니스 제작툴 출력에서 픽셀 단위로 측정했지만, 폰트 draw origin과 baseline은 샘플 visible ink bbox를 재현하기 위한 `[INFERRED]` 값이다.
2. 제품 PNG의 `CENTER_CENTER contain` 정렬은 최대 이미지 영역만 확인된 상태에서 프로젝트가 고정한 배치 정책이다.
3. CTA 상단 행의 절대 좌표는 CTA 포함 제작툴 샘플이 없어 `[INFERRED]` 상태다.
4. 카카오의 실제 심사는 이미지 규격 외 광고 정책·업종 정책·랜딩 페이지까지 포함하므로 자동 Validator가 승인을 보장하지 않는다.
5. 다른 세 템플릿 이미지는 참고 자료이며 `OBJECT_RIGHT v1`의 구현 요구사항으로 일반화하지 않는다.
6. 추가 제작툴 샘플 또는 공식 PSD를 확보하면 다음 절차를 따른다.

```text
official/tool-output source diff
→ affected rule list
→ new templateContractVersion
→ schema compatibility review
→ validator update
→ golden fixture regeneration
→ external UAT
```

---

# 12. 최종 의사결정 요약

- v1은 **일반 성과형 비즈보드 우측 오브젝트형**만 지원한다.
- 최종 산출물은 **투명 1029×258 PNG**이며 회색 시스템 박스와 가이드 레이어를 포함하지 않는다.
- 카카오 제작툴에서 측정한 제품 최대 영역은 **`x=666, y=0, w=315, h=258`**이다.
- `#D9D9D9`는 이미지 최대 영역을 표시하는 가이드 색상이며 최종 PNG에 렌더링하지 않는다.
- `OBJECT_RIGHT`에는 별도 로고 영역이 없으므로 광고주체 전용 텍스트·로고 레이어를 생성하지 않는다.
- 광고주체는 구조화 metadata로 입력받고 Headline 또는 Subcopy 포함 여부를 검증한다.
- 제품 PNG는 Alpha Trim 후 비율을 유지하여 Object slot 전체에 `CENTER_CENTER contain`으로 배치한다.
- Headline은 `48px Bold #4C4C4C`, Subcopy는 `39px Regular #777777`로 고정한다.
- CTA 없음 기준 draw 좌표는 `Headline x=48/baseline=120`, `Subcopy x=48/baseline=178`다. **[INFERRED][PROJECT]**
- 카피와 Object slot의 간격은 최소 `33px`이며 Text hard right edge는 `x=633`이다.
- Headline·Subcopy 중 하나는 실제 폭 `290px 이상`이어야 한다.
- 일반 배너 안에 근거 없는 CTA 버튼을 그리지 않는다.
- 모든 `ERROR`가 0개일 때만 다운로드를 허용한다.
- 추가 제작툴 샘플 또는 공식 PSD가 현재 계약과 다르면 추론값을 숨기지 않고 Contract 버전을 올린다.

---

# 13. Phase C0 Contract Freeze (historical baseline)

이 절은 Phase C0에서 승인한 `[PROJECT]` 기준선이다. Phase C2a amendment가 명시한 텍스트 기준선과 카피 제한은 이 절보다 우선한다. C0의 object slot, X 좌표, asset, PNG, CTA 및 보안 계약은 유지한다.

## 13.1 버전 동결

| 계약 | 이전 | 동결 버전 | 사유 |
|---|---:|---:|---|
| Canonical document | `1.1.0` | `1.2.0` | C0 clarification minor bump |
| Template Contract | `1.1.0` | `1.1.0` | C0 좌표 변경 없음; C2a에서 1.2.0으로 amendment |
| Input Schema | `1.1` (`1.1.0`) | `1.2.0` | 하위 호환 default 물질화와 canonicalization |
| Output Schema | `1.1` (`1.1.0`) | `2.0.0` | manifest/response 구조 분리 |
| Render Manifest Schema | 없음 | `1.0.0` | 신규 persisted schema |
| Response Envelope Schema | 없음 | `1.0.0` | 신규 runtime response schema |

규범 파일:

- `contracts/input.schema.json`
- `contracts/output.schema.json`
- `contracts/render-manifest.schema.json`
- `contracts/response-envelope.schema.json`
- `contracts/error-registry.json`
- `contracts/ajv-error-mapping.json`
- `contracts/cta-registry.json`
- `contracts/font-asset-registry.json`
- `contracts/approved-icons.json`
- `contracts/reference-fixture.json`
- `contracts/contract-versions.json`

## 13.2 Font Asset Freeze

Phase C0 freeze 시점에는 Spoqa Han Sans Bold와 Regular 파일이 unresolved였으나, 현재 registry는 C1에서 검증된 패키지 자산으로 해소되었다.

- 상태: `RESOLVED_ASSET`
- 시스템 font fallback: MUST NOT
- 원격 font 또는 인터넷 다운로드: MUST NOT
- 임의 filename 또는 SHA-256 생성: MUST NOT
- 실제 파일: `assets/fonts/SpoqaHanSansBold.ttf`, `assets/fonts/SpoqaHanSansRegular.ttf`
- 필요한 weight: Bold `700`, Regular `400`
- 라이선스 확인: `VERIFIED_OFL_1.1`

정확한 조건은 `assets/fonts/README.md`와 `contracts/font-asset-registry.json`에 기록한다.

## 13.3 Persisted Manifest와 Response Envelope

성공 publish 결과:

- `pngCount: 1` — `output.png`
- `manifestCount: 1` — `render-manifest.json`
- `responseEnvelopeCount: 1` — 비영속 Core/IPC 반환값

`render-manifest.json` MAY 포함:

- `canonicalInputDigest`
- `normalizedInputDigest`
- `outputPngDigest`
- `templateContractVersion`
- `inputSchemaVersion`
- `outputSchemaVersion`
- `validatorResult`
- `assetDigests`
- `manualAcceptanceStatus`
- F3A additive fields: `outputArtifactDigest`, `outputFileName`, `outputEncoding`,
  `formatProfileId`, `appliedElements`, `pixelFingerprint`, `requestFingerprint`

`render-manifest.json`은 자신의 SHA-256을 MUST NOT 포함한다. `manifestDigest`, `pngDigest`, `manifestPath`, `pngPath`, `downloadAllowed`, `status`, `errors`, `warnings`는 response envelope에만 둔다.
F3A JPEG 결과에서는 기존 `outputPngDigest`/`pngDigest` 필드를 호환성을 위해
artifact digest와 함께 유지하고, canonical artifact 형식·경로·인코딩은 위 additive
fields와 `artifact*` response fields로 구분한다.

## 13.4 CTA Activation Gate

| id | enabled | allowedLabels | allowedLandingTypes | requiredAssetIds |
|---|---:|---|---|---|
| `NONE` | true | `[null]` | `DIRECT_URL`, `ADVIEW`, `KAKAO_SERVICE` | 없음 |
| `APP_DOWNLOAD` | false | 빈 배열 | 빈 배열 | 빈 배열 |
| `KAKAO_SERVICE_ACTION` | false | 빈 배열 | 빈 배열 | 빈 배열 |

비활성 사유는 승인 icon 원본·SHA-256, 전체 label Registry, landing compatibility matrix, 측정 절대 좌표 미확보다. 비활성 mode 입력은 `KBR-CTA-009` ERROR다. Codex와 Renderer는 카카오 icon을 제작하거나 다운로드하지 않는다.

## 13.5 공개 실행 및 Input Normalization

공개 Input과 Core API는 단일 실행 mode만 제공한다. `dryRun`과 `validateOnly`는 허용하지 않는다.

```text
1. Raw JSON parse
2. JSON Schema validation
3. applyDefaults
4. Unicode NFC normalization
5. 문자열 trim 정책 적용; 중간 연속 U+0020은 자동 축약하지 않음
6. Canonical Input 생성
7. RFC 8785 JCS 호환 직렬화
8. Digest 계산
9. Layout 및 임시 PNG 생성
10. Validator 실행
11. ERROR 0이면 manifest와 PNG publish
12. ERROR가 있으면 최종 publish 금지
```

Schema의 `default`는 annotation이며 `applyDefaults` 동작을 대신하지 않는다. Canonical Input에는 `canvas`, `render`, CTA null field, product default, overwrite 등 적용된 모든 기본값이 실제 field로 존재해야 한다.

## 13.6 Alpha Trim과 Layout Visibility

```text
trimPreserveThreshold = 1
layoutVisibleThreshold = 8
connectedness = 8-neighbor
isolatedComponentRatio = 0.0005
maxUpscale = 1.5
```

- `alpha >= 1`은 보존 Trim box에 포함한다.
- `alpha >= 8`은 visible bbox, gap, containment에 포함한다.
- 리사이즈 후 alpha를 이진화하지 않는다.
- 반투명 pixel은 원본 alpha 의미를 보존한다.
- 완전 투명 pixel의 RGB는 시각 콘텐츠가 아니다.
- 8-neighbor 컴포넌트 중 pixel count 최대를 주 콘텐츠로 선택한다.
- 동률이면 `(minY,minX,maxY,maxX)` 사전식 순서로 선택한다.
- 분리 컴포넌트가 주 콘텐츠 pixel count의 `0.0005` 미만이면 layout bbox에서 제외하고 Warning을 기록한다. pixel 자체는 삭제하지 않는다.
- 그 이상 크기의 분리 컴포넌트는 layout bbox에 포함한다.

이 규칙은 원본 파일을 수정하지 않고 내부 계산에만 적용한다. 작은 분리형 제품 부품이 noise로 분류될 가능성은 수동 검토 한계로 기록한다.

## 13.7 Resize와 정수 좌표

```text
scale = min(slotWidth / trimmedWidth, slotHeight / trimmedHeight)
resizedWidth = max(1, round(trimmedWidth * scale))
resizedHeight = max(1, round(trimmedHeight * scale))
destinationX = slotX + floor((slotWidth - resizedWidth) / 2)
destinationY = slotY + floor((slotHeight - resizedHeight) / 2)
```

`slotX=666`, `slotY=0`, `slotWidth=315`, `slotHeight=258`이다. 남는 pixel이 홀수이면 우측 또는 하단에 1px 더 남는다. 좌우·상하 crop은 금지하며 `scale > 1.5`는 ERROR다.

## 13.8 PNG 및 크기 계약

v1 published PNG는 PNG IHDR 기준 다음을 모두 만족해야 한다.

- `format: PNG`
- `colorType: RGBA` — IHDR color type `6`
- `bitDepth: 8`
- `hasAlpha: true`
- `width: 1029`
- `height: 258`

PNG-24는 카카오 공식 허용 범위이나 Renderer v1 프로젝트 지원 범위에서는 제외한다.

크기 단위는 decimal byte다.

- `0..270000`: PASS
- `270001..300000`: WARNING
- `300001 이상`: ERROR

## 13.9 Canonical JSON

Canonical JSON은 RFC 8785 JCS 원칙과 다음 프로젝트 규칙을 만족해야 한다.

- UTF-8, BOM 없음
- digest 전 Unicode NFC
- object key canonical 순서
- array 순서 보존
- 불필요한 whitespace 없음
- `applyDefaults` 완료된 Canonical Input 대상
- OS 절대 경로 대신 정규화된 프로젝트 상대 참조값

Phase C0에서는 구현 라이브러리를 선택하지 않는다.

## 13.10 Error Contract

- `KBR-DOWNLOAD-001`: `downloadAllowed=false`에서 download 또는 publish를 시도하면 ERROR. Core와 IPC 양쪽에서 파일 반환을 차단한다.
- `KBR-CTA-009`: Registry에서 `enabled=false`인 CTA mode 입력 시 ERROR.
- AJV keyword 오류는 `contracts/ajv-error-mapping.json`으로 KBR code에 매핑한다.
- AJV 원문 영어 message는 외부 안정 계약이 아니다.
- 안정 필드는 `code`, `severity`, `path`, `messageKey`, 선택적 `expected`, `actual`, `bbox`다.

정렬 순서:

1. severity rank: `ERROR`, `WARNING`, `INFO`
2. input JSON pointer 사전식 오름차순
3. KBR code 사전식 오름차순
4. message key 사전식 오름차순

## 13.11 Trusted Root Security

CLI:

- `--input-root` 필수
- `--output-root` 필수

Desktop:

- Electron Main Process 파일/폴더 선택창에서 승인된 target만 사용
- Renderer Process가 전달한 임의 절대 경로를 신뢰하지 않음

공통:

- `path.resolve` 후 descendant 검사
- `..` traversal 금지
- UNC 경로 금지
- symlink 및 Windows reparse point 경유 금지
- 명시적 `overwrite=true` 없이는 기존 파일 overwrite 금지
- 최종 판정은 Core 또는 Electron Main에서 수행
- UI 문자열 검사만으로 보안 판정을 완료하지 않음

## 13.12 Atomic Publish

staging은 동일 output root 내부 `.out-staging/<jobId>/`에 둔다.

```text
1. staged PNG 작성
2. PNG Validator 실행
3. staged manifest 작성
4. 두 파일 flush 및 close
5. staging과 final 경로가 동일 volume인지 확인
6. final render-manifest.json rename
7. final output.png를 마지막으로 rename
8. response envelope 생성
9. 실패 시 staging과 부분 manifest 정리
```

최종 `output.png` 존재는 Template-locked PNG publish 완료를 의미해야 한다. F3A에서는
Profile에 따른 `output.png` 또는 `output.jpg`가 ERROR 0 publish 완료의 artifact다.
최종 artifact rename 후 response 생성 실패가 발생하더라도 Core는 published 두 파일을
재검증하여 일관된 response를 복구하거나 둘 다 정리해야 한다.

## 13.13 Runtime Network

- Runtime network access: `PROHIBITED`
- Build dependency resolution: lockfile 기반
- Offline install: pnpm store가 준비된 환경에서만 가능

외부 API, 원격 폰트, CDN, telemetry, update check, analytics, Railway, plume 서버, 카카오 API 업로드를 금지한다. 신규 PC의 최초 `pnpm install`까지 완전 오프라인이라고 주장하지 않는다.

## 13.14 Golden과 Fixture

v1 공식 지원 플랫폼은 Windows 10/11 x64다. 동일 입력, asset, dependency version, runtime 조건에서 Template PNG와 F3A JPEG 모두 byte-equal을 목표로 하며 동일 입력 3회 SHA-256이 같아야 한다. 다른 OS의 pixel tolerance는 v1 Acceptance에 포함하지 않는다.

Phase C0 최소 fixture 계약:

1. `OBJECT_RIGHT` reference fixture 1개
2. 최소 valid input fixture
3. Error Registry code별 최소 invalid fixture 요구
4. CTA NONE fixture
5. Alpha 경계 fixture: alpha 0, 1, 7, 8, hole, shadow, isolated component, tie-break, 1.5× 경계

Naming:

```text
<template>__<category>__<case-id>__<expected-severity>.<ext>
```

100개 fixture는 Contract Freeze 선행 조건이 아니며 실제 생성은 구현 단계로 이관한다.

## 13.15 Phase C0 미해결 Blocker (historical record)

1. Spoqa Han Sans Bold 실제 파일, SHA-256, 라이선스
2. Spoqa Han Sans Regular 실제 파일, SHA-256, 라이선스
3. APP_DOWNLOAD 승인 asset과 정책 자료
4. KAKAO_SERVICE_ACTION 승인 asset과 정책 자료
5. 후속 Windows x64 구현 runtime 및 native dependency pin

첫 두 항목은 C1에서 실제 자산과 검증된 digest로 해소되었다. 나머지 CTA·후속 플랫폼 항목은 현재도 범위 밖이다. Blocker를 가짜 asset, 가짜 digest, 시스템 fallback 또는 임의 공식 규칙으로 숨겨서는 안 된다.

---

# 14. Phase C2a Text Baseline and Copy Limit

이 절은 Canonical 문서 `1.2.0`에 대한 Phase C2a amendment이며 현재 문서 버전 `1.3.0`의 구현 계약이다. 아래의 baseline, 한글 환산 unit, 실제 raster 폭은 카카오 공식 규칙으로 주장하지 않는다. baseline은 `[INFERRED][PROJECT]`, 카피 제한과 warning 정책은 `[PROJECT]`, 실제 ink 측정은 `[DERIVED][PROJECT]`로 분류한다.

## 14.1 버전과 변경 범위

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical document | `1.2.0` | `1.3.0` | 텍스트 기준선·카피 제한 clarification |
| Template Contract | `1.1.0` | `1.2.0` | CTA 없음 텍스트 baseline amendment |
| Input Schema | `1.2.0` | `1.2.0` | 구조 변경 없음 |
| Output Schema | `2.0.0` | `2.0.0` | 구조 변경 없음 |
| Render Manifest Schema | `1.0.0` | `1.0.0` | 구조 변경 없음 |
| Response Envelope Schema | `1.0.0` | `1.0.0` | 구조 변경 없음 |
| Desktop application | `0.2.0` | `0.2.1` | C2a implementation release |

변경하지 않는 값은 Headline/Subcopy X 좌표 `48`, 제품 위치·크기, object slot, font 파일·version·SHA-256, font size/weight/color, Alpha Trim, PNG encoder, CTA 정책이다. X 좌표 변경은 `0`이다.

## 14.2 TextContract

구현과 Desktop UI는 다음 단일 계약을 사용한다.

```text
TextContract {
  headlineBaselineY: 120
  subcopyBaselineY: 178
  textStartX: 48
  hardRightEdgeExclusive: 633
  maximumOccupiedWidthPx: 585
  headlineMaxKoreanUnits: 12
  subcopyMaxKoreanUnits: 15
  warningWidthThresholdPx: 527
}
```

기존 C0 CTA 없음 baseline `116/174`에 정확히 `+4px`을 적용한 결과가 `120/178`이다 `[PROJECT][INFERRED]`. Headline은 `48px Bold #4C4C4C`, Subcopy는 `39px Regular #777777`을 유지한다 `[PROJECT]`.

## 14.3 Grapheme와 한글 환산 unit

Core는 Unicode NFC 정규화 후 `Intl.Segmenter`의 `granularity: "grapheme"`로 grapheme cluster를 분할한다. UTF-16 `string.length`, 단순 공백 포함 문자 수, UI `maxlength`는 계약 판정에 사용하지 않는다.

| grapheme 분류 | unit |
|---|---:|
| 한글·한자·CJK·일본어 가나 | 1.0 |
| 전각 문자 | 1.0 |
| Emoji grapheme | 1.0 |
| ASCII 영문·숫자·문장부호·기호 및 반각 라틴 | 0.5 |
| 공백 `U+0020` | 0 |
| 그 밖의 분류 불명 grapheme | 1.0 |

Headline은 `koreanEquivalentUnits <= 12.0`, Subcopy는 `koreanEquivalentUnits <= 15.0`이어야 한다. 초과 시 각각 `KBR-TEXT-COUNT-HEADLINE-001`, `KBR-TEXT-COUNT-SUBCOPY-001` ERROR다. Emoji는 계산 규칙상 1.0이지만 기존 `KBR-TEXT-001` prohibited Unicode 계약도 함께 적용될 수 있다.

## 14.4 공백과 제어문자

- 앞뒤 공백은 Normalize에서 trim한다.
- 중간 단일 `U+0020`은 허용하고 unit에는 0, raster advance에는 포함한다.
- 중간 연속 공백은 자동 축약·삭제하지 않고 보존하며 `KBR-TEXT-SPACING-001` WARNING을 반환한다.
- 탭과 줄바꿈은 `KBR-TEXT-002` ERROR다.
- 문구 자동 축약, 문자 삭제, ellipsis, 자동 줄바꿈은 금지한다.

## 14.5 실제 raster ink 폭

각 문구는 pinned font로 임시 투명 canvas에 실제 rasterize한 뒤 alpha ink bbox를 계산한다. `occupiedWidthPx`는 다음과 같다.

```text
inkBounds.rightExclusive = inkBounds.x + inkBounds.width
occupiedWidthPx = inkBounds.rightExclusive - textStartX
```

PASS는 `occupiedWidthPx <= 585` 및 `inkBounds.rightExclusive <= 633`이다. 마지막 visible pixel은 `x <= 632`여야 한다. `633` 이상은 hard edge를 초과한다. 실제 ink 폭과 hard edge 초과는 기존 의미가 같은 `KBR-TEXT-004`(Headline), `KBR-TEXT-005`(Subcopy)를 재사용하고, payload에 `actualWidthPx`, `limitWidthPx`, `overflowPx`, `rightExclusive`, `hardRightEdgeExclusive`를 포함한다.

자동 축소, 자간 축소, 좌표 이동, crop, 문자 잘라내기는 금지한다. 공백은 ink가 아니어도 raster advance가 뒤 글자의 right edge에 반영된다.

## 14.6 Width warning과 통합 판정

| occupied width | 판정 |
|---:|---|
| `0..526px` | PASS |
| `527..585px` | WARNING |
| `586px 이상` 또는 `rightExclusive > 633` | ERROR |

Width warning은 Headline `KBR-TEXT-WIDTH-HEADLINE-W001`, Subcopy `KBR-TEXT-WIDTH-SUBCOPY-W001`이다. 한글 환산 unit 초과는 90% warning 없이 ERROR만 반환한다. Count와 width 모두 통과해야 ERROR 0 및 Export 허용 상태다. Warning만 있으면 Export를 허용한다.

Core의 `TextLimitMetrics`는 최소 다음을 반환한다.

```text
graphemeCountIncludingSpaces
koreanEquivalentUnits
maxKoreanEquivalentUnits
occupiedWidthPx
maxOccupiedWidthPx
widthRatio
inkBounds
rightExclusive
baselineY
textStartX
hardRightEdgeExclusive
limitStatus
```

Preview와 Export는 같은 Core pipeline과 같은 `TextContract`를 사용한다. Renderer Process는 unit 또는 width를 독자 계산하지 않으며, UI는 Core가 반환한 metrics를 표시만 한다. 입력 변경 시 기존 Preview·PASS·Export token은 즉시 무효화한다.

## 14.7 UI 표시

Headline과 Subcopy 입력 하단에 Core 검증 결과를 다음 형식으로 표시한다.

```text
한글 환산 10.5 / 12자 · 실제 폭 510 / 585px · 공백 포함 15자
```

Core 검증 전에는 확정 수치를 표시하지 않고 `Core 검증 후 실제 폭과 한글 환산값이 표시됩니다.`를 표시한다. Width warning은 경고색, count/width ERROR는 오류색으로 표시하며 ERROR이면 Export 버튼을 비활성화한다. 브라우저 `maxlength`는 계약 enforcement에 사용하지 않는다.

## 14.8 Fixture와 Acceptance 추가

필수 unit 경계는 다음을 포함한다.

1. Headline 12/13 Korean-equivalent units
2. Subcopy 15/16 Korean-equivalent units
3. U+0020 unit 0과 내부 공백 raster advance
4. ASCII·Emoji·결합문자 grapheme 분할
5. trim, tab/linebreak ERROR, 연속 공백 WARNING
6. 526 PASS, 527 WARNING, 585 WARNING, 586 ERROR
7. `rightExclusive=633` PASS, `634` ERROR
8. baseline `120/178`, X 좌표 `48` 유지

통합 Acceptance는 count/width 교차 조합, Warning-only Export, stale Preview 차단, Preview/Export byte equality, 제품 영역 불변, ERROR 상태 최종 파일 0, 동일 입력 3회 동일 SHA-256을 검증한다. 기존 OBJECT_RIGHT reference PNG는 수정하지 않으며, `x >= 633` 영역과 우측 48px 투명 계약은 유지한다.

---

# 15. Phase C3 Agent-ready Renderer Integration Contract

이 절은 Canonical 문서 `1.4.0`의 `[PROJECT]` 통합 경계 결정이다. Renderer는 Agent, Plume, OpenAI 또는 원격 서비스의 존재를 알지 못한다. Agent가 만든 Plan과 Lab에서 만든 Plan은 동일한 `Integration Contract v1.1.0` JSON Schema와 동일한 Core Adapter를 통과해야 한다. 이번 절은 특정 Agent의 내부 ID, Prompt, Queue, DB 또는 업로드 승인 규칙을 정의하지 않는다.

## 15.1 버전과 공존

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical document | `1.3.0` | `1.4.0` | Agent-independent Integration Contract boundary |
| Template Contract | `1.2.0` | `1.2.0` | 좌표·현재 OBJECT_RIGHT 픽셀 변경 없음 |
| Input Schema | `1.2.0` | `1.2.0` | 기존 공개 Renderer Input 유지 |
| Output Schema | `2.0.0` | `2.0.0` | 기존 Core response/manifest 유지 |
| Desktop application | `0.2.1` | `0.3.0` | Renderer Lab Placement Plan 기능 |
| Integration Contract | `1.0.0` | `1.1.0` | Capability MIME allowlist, alpha requirement, resolver metadata |

기존 Desktop/CLI Input을 제거하거나 대체하지 않는다. `packages/renderer-contract`는 직렬화 가능한 타입·Schema·검증·fingerprint·Resolver 인터페이스를 제공하고, Adapter는 이를 기존 OBJECT_RIGHT Core Input 모델로 변환한다. Core는 Integration Input에 없는 값(카피, asset, slot, crop)을 추측하거나 자동 보정하지 않는다.

## 15.2 Serializable Asset Descriptor와 Runtime Resolver

Integration JSON의 Asset Descriptor는 `assetId`, PNG/JPEG `mimeType`, 선택적 declared dimensions/checksum, 그리고 `assetRef`(`DESKTOP_ASSET_TOKEN`, `INTEGRATION_ASSET_TOKEN`, `FIXTURE_ASSET_ID`)만 포함한다. Blob, Uint8Array, OS 절대 경로는 JSON 계약에 포함하지 않는다. Runtime에서는 `RendererAssetResolver.resolve(assetRef)`가 실제 bytes, detected MIME, orientation 보정 후 dimensions, alpha metadata를 반환하고, Core가 bytes의 SHA-256·decode·dimensions·alpha를 직접 검증한다. WebP/GIF/AVIF/BMP/TIFF/SVG는 현재 Production Capability에서 허용하지 않는다. 선언값과 실제값이 다르면 ERROR이며 `analysis`는 검증 가능한 힌트일 뿐 신뢰 원본이 아니다. Canonical JSON, request/pixel fingerprint에는 절대 경로를 포함하지 않는다.

## 15.3 Placement Policy와 정규화 좌표

지원 정책과 fit 조합은 다음으로 고정한다 `[PROJECT]`.

| policy | fitMode | cropRect | cropCandidateId |
|---|---|---|---|
| `ALPHA_TRIM_CONTAIN` | `CONTAIN` | 금지 | 금지 |
| `CENTER_CONTAIN` | `CONTAIN` | 금지 | 금지 |
| `SEMANTIC_CROP_COVER` | `COVER` | 직접 Crop 또는 Candidate 중 정확히 하나 | 직접 Crop 또는 Candidate 중 정확히 하나 |
| `MANUAL_CROP` | `COVER` | 필수 | 금지 |

허용되지 않는 조합은 중앙 Crop 생성, clamp, 정책 변경 없이 BLOCKED다. Normalized point/rect의 모든 값은 finite이고 `NORMALIZED_EPSILON=1e-9` 경계로 검증한다. 범위 밖 값은 clamp하지 않는다. 픽셀 Rect는 `floor(x×sourceWidth)`, `floor(y×sourceHeight)`, `ceil((x+width)×sourceWidth)`, `ceil((y+height)×sourceHeight)`와 최소 `1×1`을 사용하며 source bounds를 넘으면 ERROR다.

`REQUIRED` protected subject가 적용 Crop 밖이면 `KBR-PROTECTED-SUBJECT-CLIPPED` ERROR, `PREFERRED`면 WARNING, `NONE`이면 이 검사를 생성하지 않는다. REQUIRED인데 데이터가 비어 있으면 자동 검출 없이 `KBR-PROTECTED-SUBJECT-DATA-MISSING` ERROR다. Crop Candidate는 입력 안에서 unique하고 Plan의 asset/slot과 일치해야 하며 Renderer가 후보를 생성·재점수화·자동 선택하지 않는다.

## 15.4 Integration Input/Output과 Capability

`RendererIntegrationInputV1`의 `schemaVersion`은 `1.1.0`이다. 입력 Asset은 PNG/JPEG만 허용하며 최종 `output.mimeType=image/png`만 지원한다. OBJECT_RIGHT는 PNG와 alpha를 요구하고, THUMBNAIL_BOX_RIGHT는 PNG/JPEG를 허용하며 alpha를 요구하지 않는다. `RendererIntegrationOutputV1`은 `PASS` 또는 `BLOCKED`이며 ERROR가 하나라도 있으면 artifact metadata와 다운로드를 제공하지 않는다. `AppliedImagePlacement`에는 requested/resolved crop, source pixel crop, destinationRect, scale, anchor, alphaTrimApplied, candidate ID를 기록하고 `changedFromRequestedPlan`은 v1에서 항상 `false`다.

Capability Registry에서 `KAKAO_BIZBOARD_OBJECT_RIGHT`와 `KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT`가 `IMPLEMENTED`다. OBJECT_RIGHT는 기본 정책 `ALPHA_TRIM_CONTAIN`, semantic placement `NOT_REQUIRED`, manual/agent placement `false`다. THUMBNAIL_BOX_RIGHT는 기본 정책 `SEMANTIC_CROP_COVER`, semantic placement `REQUIRED`, `SEMANTIC_CROP_COVER`와 `MANUAL_CROP`만 허용하고 manual/agent placement를 `true`로 둔다. Thumbnail Multi, mask, native, Naver 지면은 `NOT_IMPLEMENTED`이며 정책 표현 가능성과 실제 Renderer 지원을 혼동하지 않는다.

## 15.5 Fingerprint

`artifactChecksumSha256`은 실제 최종 PNG bytes의 SHA-256이다. `pixelFingerprint`는 pixel-affecting canonical input, 실제 asset digest, policy/fit/resolved crop, 실제 사용되는 anchor/encoding, Template Contract `1.3.0`을 포함하고 source/confidence/rationale/warnings/timestamp/absolute path/token 문자열 자체는 제외한다. 현재 Renderer가 focal point를 pixel 계산에 사용하지 않으므로 focal point는 pixel fingerprint에 포함하지 않는다. `requestFingerprint`는 전체 Integration Input의 Canonical JSON을 기반으로 하여 provenance 차이를 보존한다. 동일 Placement의 `MANUAL`과 `AGENT`는 동일 pixelFingerprint와 동일 artifact bytes를 만들고 requestFingerprint만 달라진다. 기존 `renderFingerprint`를 사용해야 하는 응답에서는 그 의미를 `pixelFingerprint`와 동일하게 고정한다.

## 15.6 Renderer Lab과 금지 범위

Desktop Lab은 Capability, policy/fit/anchor/protection, crop/focal/candidate 입력, 적용 destinationRect/validation, Plan JSON Import/Export를 표시한다. OBJECT_RIGHT에서 수동 Crop control은 disabled와 사유를 표시한다. JSON Import는 `additionalProperties:false` Schema와 안정적인 KBR 오류 매핑을 사용하며 누락값을 추측하거나 자동 보정하지 않는다. Agent fixture도 동일 Import 경로로 통과한다. OpenAI 호출, Plume 연결, Agent 구현, Object Detection, 자동 후보 생성, 미지원 지면 Renderer 구현, 원격 배포와 업로드는 이 계약 범위에 없다.

## 15.7 Acceptance

기존 C2a Golden `20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`은 동일해야 한다. Integration Contract는 Schema parse/ID/unknown-field, normalized geometry, policy matrix, Candidate/subject protection, asset checksum/dimension, manual-agent fingerprint equivalence, Adapter bridge, Lab round trip을 자동 검증한다. 공식 지원 플랫폼은 계속 Windows 10/11 x64이며, 다른 OS의 pixel tolerance는 추가 계약 버전에서 다룬다.

## 18. Phase C4 — THUMBNAIL_BOX_RIGHT 실행 계약 [PROJECT]

이 절은 Canonical 문서 `1.4.0`에서 `1.5.0`으로 증가한 C4 amendment다. 기존
`OBJECT_RIGHT` 좌표와 출력 바이트는 변경하지 않는다. 새 템플릿의 회색 가이드와
문구는 제작툴 출력 측정값인 `[TOOL_OUTPUT]`이며, 12px 모서리 반경과 실행 알고리즘은
`[DERIVED][PROJECT]`로 고정한다. 자동 Subject Detection 모델이나 자동 Candidate 생성은
이 버전에 포함하지 않는다.

### 18.1 Template Capability

`KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT` / `KAKAO_MOMENT_BIZBOARD_THUMBNAIL_BOX_RIGHT`는
현재 실제 렌더링 가능한 `IMPLEMENTED` 지면이다. `semanticPlacement`는 `REQUIRED`이고
허용 정책은 `SEMANTIC_CROP_COVER`, `MANUAL_CROP`뿐이다. `CENTER_CONTAIN`으로
자동 대체하지 않으며, 나머지 THUMBNAIL_MULTI_RIGHT, MASK_SEMICIRCLE_RIGHT,
KAKAO_NATIVE_1200는 계속 `NOT_IMPLEMENTED`다. 이전 `NAVER_GFA_IMAGE_BANNER`
문구는 N4 이전 snapshot이며, 현재 `NAVER_IMAGE_BANNER_1_1`은 §36의 source-confirmed
FREEFORM profile로 supersede되었다.

### 18.2 측정 기준과 고정 좌표 [TOOL_OUTPUT][DERIVED][PROJECT]

불변 Canvas는 1029×258이다. `IMAGE_PRIMARY` 슬롯은 `x=666, y=36, width=315,
height=186`, right-exclusive 981, bottom-exclusive 222, radius 12px이다. 우측
투명 여백은 48px, 상·하 여백은 각각 36px이며, 텍스트 hard right edge는 633,
최소 gap은 33px이다. Headline은 x=48/baseline=120, Subcopy는 x=48/baseline=178이고
기존 Spoqa Han Sans, 색상, 12/15 한글 환산 unit 및 585px 폭 계약을 그대로 사용한다.

기준 PNG `reference/kakao-tool/THUMBNAIL_BOX_RIGHT.png`는 수정하지 않고 SHA-256
`bde09ea925ede612c814868d90f9595fc29137b1183309123f02fd76dedff030`으로 검증한다.
회색 `#D9D9D9`와 `Image` placeholder는 가이드에만 존재하며 최종 PNG에는 포함하지
않는다. 슬롯 밖, 특히 x=981..1028은 완전 투명이어야 한다.

### 18.3 Crop 실행 [PROJECT]

- `SEMANTIC_CROP_COVER`는 `fitMode=COVER`이고 `cropRect` 또는
  `cropCandidateId` 중 하나를 정확히 요구한다. 둘 다 없거나 둘 다 있으면
  `KBR-CROP-RECT-REQUIRED` 또는 `KBR-CROP-RECT-FORBIDDEN`으로 `BLOCKED`다.
- `MANUAL_CROP`는 `fitMode=COVER`, 직접 `cropRect`, `source=MANUAL`을 요구하고
  Candidate를 받지 않는다. 입력된 정규화 Crop을 보정·재선택하지 않는다.
- Candidate가 참조되면 Registry의 `cropRect`를 그대로 해석한다. Candidate 자동 생성,
  중심 Crop 추정, clamp는 하지 않는다.
- 정규화 좌표는 `left=floor(x*sourceWidth)`, `top=floor(y*sourceHeight)`,
  `right=ceil((x+width)*sourceWidth)`, `bottom=ceil((y+height)*sourceHeight)`로
  exclusive 픽셀 Rect를 만든다. Cover scale은 슬롯을 채우고 비율을 유지하며, anchor에
  따른 초과 영역만 결정적으로 잘라낸다.
- `IMAGE_PRIMARY` 최종 배치는 radius 12px clip으로만 마스킹한다. 모든 적용 결과는
  `requestedCropRect`, `resolvedSourceCropRect`, `resolvedSourceCropPixels`,
  `destinationRect`, `appliedScale`, `appliedAnchor`, `changedFromRequestedPlan=false`를
  `appliedImagePlacements`에 기록한다.

### 18.4 Subject Protection [PROJECT]

`REQUIRED` 보호 주체가 Crop 밖으로 나가면 `KBR-PROTECTED-SUBJECT-CLIPPED` ERROR,
`PREFERRED`면 WARNING, `NONE`이면 이슈를 만들지 않는다. 검증 실패 시 Preview와
Export 모두 artifact를 만들지 않는다.

### 18.5 Renderer Lab 및 실행 경계 [PROJECT]

Desktop Lab은 OBJECT_RIGHT와 THUMBNAIL_BOX_RIGHT를 선택할 수 있다. 후자에서만
정책, anchor, subject protection, direct Crop Rect, Candidate 선택, Plan JSON Import/
Export를 활성화한다. Lab의 Preview와 Export는 동일 Integration Adapter와 Core
Thumbnail Renderer를 사용하며, ERROR 0일 때만 `downloadAllowed`와 publish를 허용한다.
Renderer Process는 절대 경로를 전달하지 않고 Main/Core가 token, trusted root, reparse
point, overwrite 및 atomic publish를 최종 판정한다.

### 18.6 버전 및 호환성 [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.4.0 | 1.5.0 | THUMBNAIL_BOX_RIGHT 실행 계약 및 Lab 연동 |
| Template Contract | 1.2.0 | 1.3.0 | 새 템플릿 슬롯·Crop 실행 계약 추가; 기존 좌표 불변 |
| Input Schema | 1.2.0 | 1.2.0 | 공개 입력 구조 유지; 기본 template contract 값만 1.3.0으로 물질화 |
| Output Schema | 2.0.0 | 2.0.0 | 구조 변경 없음 |
| Integration Contract | 1.0.0 | 1.0.0 | 스키마 구조 유지, Capability 실행 대상 확대 |
| Desktop | 0.3.0 | 0.4.0 | Template/Crop Lab 및 Preview/Export 지원 |

`OBJECT_RIGHT`의 기존 공개 Input과 `ALPHA_TRIM_CONTAIN` 경로는 호환성을 위해
그대로 유지한다. 이 문서는 구현 가능한 로컬 Renderer 계약이며, 카카오 공식 업로드
승인이나 광고 심사 결과를 보장하지 않는다.

## 19. Phase C4 Amendment — JPG/JPEG 입력 지원 [PROJECT]

이 절은 Canonical 문서 `1.5.0` 이후의 입력 Asset 확장 patch다. Template Contract와
좌표는 변경하지 않으며, 최종 산출물은 계속 RGBA PNG-32다. Integration Contract는
`1.0.0`에서 `1.1.0`으로 증가하고 Desktop은 `0.4.0`에서 `0.4.1`로 증가한다.

### 19.1 MIME 및 Template Capability

- `OBJECT_RIGHT`: `image/png`만 허용하고 alpha channel을 요구한다. JPG/JPEG와
  alpha 없는 PNG는 `KBR-ASSET-MIME-NOT-ALLOWED` 또는
  `KBR-ALPHA-CHANNEL-REQUIRED`로 BLOCKED다.
- `THUMBNAIL_BOX_RIGHT`: `image/png`, `image/jpeg`를 허용하고 alpha를 요구하지
  않는다. 투명 PNG, opaque PNG, JPG, JPEG 모두 `SEMANTIC_CROP_COVER` 또는
  `MANUAL_CROP`으로 처리할 수 있다.
- WebP, GIF, AVIF, BMP, TIFF, SVG는 현재 Production Capability에 포함하지 않는다.
  JPG와 JPEG는 byte MIME `image/jpeg`로 정규화한다.

파일 확장자와 사용자 입력 문자열은 신뢰하지 않는다. Main/Core 또는 Asset Resolver가
bytes의 signature와 decoder 성공 여부를 확인하고, `.png/.jpg/.jpeg` 확장자와 실제
MIME이 다르면 `KBR-ASSET-MIME-EXTENSION-MISMATCH` ERROR를 반환한다. 손상 파일은
`KBR-IMAGE-DECODE-FAILED`, 유효하지 않은 dimensions는 `KBR-IMAGE-DIMENSION-INVALID`다.

### 19.2 JPEG Orientation 및 Crop [PROJECT]

JPEG EXIF Orientation은 1..8만 허용한다. Decoder에서 orientation을 명시적으로
적용한 표시 방향으로 변환한 뒤 normalized cropRect를 보정 후 dimensions에 매핑한다.
Orientation 5..8은 width/height가 교환된다. malformed 또는 범위 밖 Orientation은
`KBR-EXIF-ORIENTATION-INVALID`로 BLOCKED다. 출력 Canvas에는 원본 EXIF metadata를
복사하지 않는다.

THUMBNAIL_BOX_RIGHT는 JPEG RGB를 내부 RGBA로 decode하고, Crop 전에 임의 리사이즈하지
않으며, 기존 `IMAGE_PRIMARY` rounded rectangle mask를 적용한다. 최종 파일은 항상
`image/png`, 1029×258, 8-bit RGBA다. OBJECT_RIGHT의 기존 PNG Golden과 alpha-trim
계약은 변경하지 않는다.

### 19.3 Desktop Session Asset 경계 [PROJECT]

파일 선택창은 PNG, JPG, JPEG를 표시하지만 filter는 보안 판정이 아니다. Session Main은
원본 bytes를 검증하고 실제 format을 유지한 `product.png`, `product.jpg`, 또는
`product.jpeg`로 private session workspace에 복사한다. Renderer Process에는 asset token,
displayName, detectedMimeType, normalized width/height, bytes, checksum, hasAlpha만
전달하며 원본 절대 경로는 전달하지 않는다.

Template 전환으로 현재 Asset이 Capability와 맞지 않으면 기존 Asset은 삭제하지 않고
Preview를 무효화하고 Export를 비활성화한다. 새 파일 선택이 필요하다는 안정적인
Validation 메시지를 표시한다.

### 19.4 Acceptance

Orientation 1, 3, 6, 8 fixture는 보정 후 dimensions, crop 좌표, metadata 제거,
3회 byte determinism을 검증한다. JPG/JPEG의 direct crop, candidate, manual crop,
Preview/Export byte equality를 검증하고, OBJECT_RIGHT Golden SHA-256
`20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`은 그대로 유지한다.

## 20. Phase C5 — THUMBNAIL_MULTI_RIGHT two-slot execution [PROJECT]

이 절은 Canonical 문서 `1.5.1` 이후의 additive template 계약이다. 기존
`OBJECT_RIGHT`와 `THUMBNAIL_BOX_RIGHT`의 좌표·픽셀 Golden은 변경하지 않는다. 새
기준 PNG `reference/kakao-tool/THUMBNAIL_MULTI_RIGHT.png`는 1029×258 RGBA PNG이며
검증 SHA-256은 `ea6a6ca53faba1215e45e7aa54ddcae33c5d75bbe6244e3aa6a3b2465656a57b`다.
기준 이미지의 회색 `#D9D9D9`와 `Image` 문자열은 최종 출력에 포함하지 않는다.

### 20.1 Canvas, copy, and slots [TOOL_OUTPUT][DERIVED][PROJECT]

Canvas는 `1029×258`이다. Headline은 `(48, baseline 120)`, Subcopy는
`(48, baseline 178)`에서 기존 Spoqa Han Sans 계약을 재사용한다. 두 텍스트의
`hardRightEdgeExclusive`는 `588`, 최대 점유 폭은 `540px`, 첫 Slot과의 최소
간격은 `33px`이다. Headline은 한글 환산 12 units, Subcopy는 15 units를 넘지
않으며 자동 축소·줄바꿈·자간 축소·좌표 이동은 하지 않는다. 폭 `486..540px`는
WARNING, `541px` 이상 또는 실제 ink rightExclusive `589` 이상은 ERROR다.

`KAKAO_MOMENT_BIZBOARD_THUMBNAIL_MULTI_RIGHT`는 다음 두 Slot을 고정 순서로
사용한다. `cornerRadiusPx: 12`는 antialiased footprint에서 도출한 프로젝트
`[DERIVED]` 값이며 카카오 공식 수치로 주장하지 않는다.

| Slot ID | order | x | y | width | height | rightExclusive | bottomExclusive | radius |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `IMAGE_PRIMARY` | 0 | 621 | 43 | 172 | 172 | 793 | 215 | 12 |
| `IMAGE_SECONDARY` | 1 | 809 | 43 | 172 | 172 | 981 | 215 | 12 |

Slot gap은 `16px`, 우측 투명 margin은 `48px`, top/bottom margin은 각각 `43px`다.
Slot은 겹치지 않으며 각 Slot의 12px rounded mask와 crop은 서로 독립적이다.

### 20.2 Asset, Plan, and Crop Candidate 연결 [PROJECT]

Production Capability는 `image/png`, `image/jpeg`와 `SEMANTIC_CROP_COVER`,
`MANUAL_CROP`을 허용한다. Alpha channel은 필수가 아니다. Asset은 최소 1개,
최대 2개이며 한 Asset을 두 Slot이 서로 다른 Crop으로 재사용할 수 있다. 반드시
`IMAGE_PRIMARY` Plan 정확히 1개와 `IMAGE_SECONDARY` Plan 정확히 1개가 있어야
한다. Plan 배열 순서는 연결 기준이 아니며 `imageSlotId`가 유일한 연결 키다.

`SEMANTIC_CROP_COVER`는 `fitMode:COVER`와 direct `cropRect` 또는
`cropCandidateId` 중 정확히 하나를 요구한다. `MANUAL_CROP`는 `fitMode:COVER`,
direct `cropRect`, `source:MANUAL`을 요구하고 Candidate를 금지한다. Renderer는
Crop을 생성·보정·clamp·중앙 대체하지 않는다. Candidate는 전체 Input에서 unique하고
해당 Plan의 `assetId`와 `imageSlotId`가 일치해야 한다. 다른 Slot Candidate,
누락 Crop, 누락 Plan, 알 수 없는 Slot은 ERROR이며 final artifact를 제공하지 않는다.

PNG/JPG/JPEG는 bytes signature와 decoder 성공을 확인하고 JPEG EXIF Orientation
1..8을 Crop 전에 적용한다. 내부에는 RGBA로 변환하지만 최종 출력은 계속 RGBA
PNG-32다. 두 Slot은 서로 다른 MIME을 사용할 수 있다.

### 20.3 Subject Protection and raster boundaries [PROJECT]

`REQUIRED` protected subject가 해당 Slot의 resolved Crop 밖이면
`KBR-PROTECTED-SUBJECT-CLIPPED` ERROR, `PREFERRED`면 WARNING, `NONE`이면 이슈를
생성하지 않는다. 다른 Slot의 subject 데이터로 대체하지 않는다. 두 Slot의 composite
순서는 `IMAGE_PRIMARY` 후 `IMAGE_SECONDARY`로 고정한다. 각 Slot 밖, Slot 사이
16px, 우측 48px, top/bottom 43px는 완전 투명이어야 하며 Guide overlay와
placeholder는 최종 PNG에 없다.

### 20.4 Determinism, output, and manifest [PROJECT]

입력 Plan 배열이 `[PRIMARY, SECONDARY]` 또는 `[SECONDARY, PRIMARY]`여도 Template
Slot 순서로 실행·composite·AppliedImagePlacements를 정렬한다. 같은 Asset bytes,
copy, placement 값이면 Manual/Agent source만 다른 요청은 동일 artifact bytes와
`pixelFingerprint`를 만들고 `requestFingerprint`만 provenance 차이를 반영한다.
`appliedImagePlacements`는 항상 두 항목이며 destinationRect는 위 표와 같다.

다중 Slot manifest에는 `templateId`, unique image `assetDigests`,
`appliedImagePlacements`, `pixelFingerprint`, `requestFingerprint`,
`outputPngDigest`를 기록한다. 기존 manifest의 self digest는 계속 금지한다. ERROR가
하나라도 있으면 manifest/output publish와 download를 모두 차단한다.

### 20.5 Desktop Renderer Lab [PROJECT]

Lab은 `OBJECT_RIGHT`, `THUMBNAIL_BOX_RIGHT`, `THUMBNAIL_MULTI_RIGHT`를 선택할 수
있다. Multi 선택 시 `IMAGE_PRIMARY`, `IMAGE_SECONDARY` 패널에서 Asset, policy,
source, Crop Rect, Candidate, anchor, Subject Protection, applied crop과
destinationRect를 독립적으로 표시·편집한다. 하나의 Asset을 두 Slot에 명시적으로
재사용할 수 있으며 자동 복사는 하지 않는다. Plan JSON은 두 Plan을 한 번에
Import/Export하고 Import 배열 순서는 자유지만 Slot ID로 매핑한다. unknown field,
누락·중복·미지원 Slot, invalid JSON은 기존 PASS를 무효화한다. 어느 Slot이든 ERROR면
전체 Export를 차단한다.

### 20.6 Version and compatibility [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.5.1 | 1.6.0 | THUMBNAIL_MULTI_RIGHT additive two-slot contract |
| Template Contract | 1.3.0 | 1.3.0 | 기존 Template 좌표 불변; 새 Slot registry entry는 additive |
| Integration Contract | 1.1.0 | 1.1.0 | 기존 arrays가 다중 placement를 표현하며 capability metadata만 additive |
| Desktop | 0.4.1 | 0.5.0 | Multi-slot Lab, 독립 Asset, Plan Import/Export |

### 20.7 Acceptance [PROJECT]

Windows 10/11 x64 고정 환경에서 동일 입력·Asset bytes·dependency·runtime으로
세 번 실행한 Multi Golden PNG는 byte-equal이어야 한다. C5는 기존 OBJECT_RIGHT
`20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`과 C4
THUMBNAIL_BOX_RIGHT Golden을 byte-equal로 유지하는 것을 필수로 한다.

## 21. Phase C5a — Crop Rect decimal precision [PROJECT]

이 절은 Canonical 문서 `1.6.0`의 입력 UI·검증 경로를 `1.6.1` patch로
명확히 한다. Template Contract `1.3.0`의 좌표, Core의 Crop 알고리즘, 기존
Golden PNG는 변경하지 않는다. 적용 대상은 `THUMBNAIL_BOX_RIGHT`의
`IMAGE_PRIMARY`와 `THUMBNAIL_MULTI_RIGHT`의 `IMAGE_PRIMARY`/
`IMAGE_SECONDARY`이며, `OBJECT_RIGHT`에는 Crop UI를 추가하지 않는다.

### 21.1 Normalized decimal contract [PROJECT]

`NormalizedRect`는 기존과 같이 `{ x:number, y:number, width:number, height:number }`다.
모든 값은 finite이고 `0 ≤ x,y ≤ 1`, `0 < width,height ≤ 1`,
`x+width ≤ 1`, `y+height ≤ 1`을 만족해야 한다. 비교 epsilon은
`NORMALIZED_EPSILON=1e-9`로 유지한다. 음수, 0 크기, 범위 초과, NaN,
Infinity는 `KBR-CROP-RECT-OUT-OF-BOUNDS`로 BLOCKED하며 clamp, 자동 이동,
width/height 보정, 중앙 Crop 대체를 하지 않는다.

Integration JSON Schema는 이미 `number`를 사용하므로 Integration Contract는
`1.1.0`을 유지한다. JSON number의 유한 소수 정밀도에는 임의의 6자리 제한을
추가하지 않는다. UI는 최소 6자리 decimal 입력을 손실 없이 보존하며, 더 긴
유한 JSON 값도 Core에서 받은 IEEE-754 number 그대로 검증한다. UI 직접 입력에서
scientific notation은 허용하지 않고, JSON Import에서는 JSON parser가 허용하는
number 표현을 사용한다. 이번 patch에는 임의 반올림이나 새 precision 오류 코드를
추가하지 않는다. **[PROJECT]**

### 21.2 Renderer Lab edit buffer [PROJECT]

각 Crop Rect 필드는 `x`, `y`, `width`, `height` 별도 문자열 edit buffer를
사용한다. `""`, `"0."`, `"0.0"` 같은 중간 입력은 문자열 그대로 유지하고 기존의
유효한 Plan을 덮어쓰지 않는다. 완성된 finite decimal 네 필드가 Contract를
통과할 때만 Plan draft를 갱신한다. 오류 입력은 표시하되 자동 복원·clamp하지
않으며, width/height의 0은 Core 검증에서 거부한다.

HTML 입력은 `type=number`, `min=0`, `max=1`, `step=any`,
`inputMode=decimal`을 사용한다. 브라우저의 stepMismatch는 계약 판정이 아니며
수동 `0.123456` 입력을 허용한다. 커스텀 +/- 버튼은 제공하지 않는다. 명시적인
keydown 처리로 Arrow Up/Down은 `±0.1`, Shift+Arrow는 `±0.01`, Alt+Arrow는
`±0.001`을 적용한다. 범위를 넘는 키보드 조절은 적용하지 않고 오류를 표시한다.

### 21.3 Pixel conversion and fingerprints [PROJECT]

유효한 normalized decimal은 픽셀 변환 직전까지 보존한다. 기존 변환을 그대로
사용한다: `left=floor(x×sourceWidth)`, `top=floor(y×sourceHeight)`,
`right=ceil((x+width)×sourceWidth)`, `bottom=ceil((y+height)×sourceHeight)`;
right/bottom은 exclusive이며 source dimensions와 EXIF orientation 보정 후
크기를 사용한다. 변환 전 정수 percent나 반올림을 사용하지 않는다.

Request fingerprint에는 normalized decimal 값이 반영된다. 기존 구현의
pixelFingerprint가 normalized `cropRect`를 직접 포함하는 의미는 C5a에서 바꾸지
않는다. 따라서 동일 pixel Rect로 resolve될 수 있는 서로 다른 decimal 값도
기존 pixel fingerprint 정책을 따른다. 동일 입력·Asset bytes·runtime은 동일
fingerprint와 byte-equal Preview/Export를 생성해야 한다.

### 21.4 Plan Import/Export and template scope [PROJECT]

Manual Plan과 Agent Plan은 동일 decimal parser/validator/serializer를 사용한다.
Import→Export→re-Import에서 `0.123456`, `0.078125`, `0.654321`, `0.8125` 같은
값을 손실 없이 보존하고 `additionalProperties:false`를 유지한다. Multi Plan은
Slot ID로 매핑하며 Primary edit가 Secondary draft를 변경하지 않고 그 반대도
동일하다. Candidate가 선택된 필드는 resolved candidate 값을 표시하지만 direct
Crop 편집은 비활성화한다.

### 21.5 Version and acceptance [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.6.0 | 1.6.1 | Decimal Crop Rect edit/validation clarification |
| Template Contract | 1.3.0 | 1.3.0 | 좌표·픽셀 계약 불변 |
| Integration Contract | 1.1.0 | 1.1.0 | Schema가 이미 number이며 구조 변경 없음 |
| Desktop | 0.5.0 | 0.5.1 | 문자열 buffer, decimal 필드, nudge UX |

C5 Golden은 다음 SHA-256으로 byte-equal을 유지한다: OBJECT_RIGHT
`20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`,
THUMBNAIL_BOX_RIGHT `f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996`,
THUMBNAIL_MULTI_RIGHT `ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55`.
Windows 10/11 x64 고정 환경에서 decimal fine crop, Plan round trip, 두 Slot 독립성,
Preview/Export byte equality, package smoke를 자동 검증한다.

## 22. Phase C5b — Crop keyboard adjustment UI simplification [PROJECT]

이 절은 Canonical 문서 `1.6.1`의 Renderer Lab 조절 UX를 `1.6.2` patch로
명확히 한다. `OBJECT_RIGHT`에는 Crop UI가 없으므로 변경하지 않는다. Core,
Template Contract `1.3.0`, Integration Contract `1.1.0`, 좌표, 픽셀 변환 및 기존
Golden PNG는 변경하지 않는다.

### 22.1 Controls

Box Right와 Multi의 각 Slot은 `x`, `y`, `width`, `height` 입력 필드만 표시한다.
필드 아래의 커스텀 `-`/`+` 버튼, fine/normal/coarse 버튼 묶음, 전용 wrapper와
관련 CSS/handler는 사용하지 않는다. Crop 그룹 하단에는 안내를 한 번만 표시한다:
`↑↓ 0.1 · Shift+↑↓ 0.01 · Alt+↑↓ 0.001`.

각 필드는 `type=number`, `min=0`, `max=1`, `inputMode=decimal`, `step=any`다.
브라우저의 native stepMismatch에 의존하지 않으며, keydown을 직접 처리한다.
Arrow Up/Down은 `±0.1`, Shift는 `±0.01`, Alt는 `±0.001`이다. 직접 입력한
`0.05`, `0.125`, `0.333333`과 C5a의 문자열 중간 입력은 그대로 보존한다.

### 22.2 Deterministic adjustment and bounds

키보드 조절에는 C5a의 decimal 정수 연산 helper를 사용한다. `0.2 + 0.1`은
`0.3`이며 `0.30000000000000004`를 표시하거나 Plan에 저장하지 않는다. 조절
결과가 normalized rect 계약을 벗어나면 변경을 적용하지 않고 기존 유효값을
유지한다. 자동 clamp, 정수 반올림, 빈 값의 0 대체는 금지한다.

Crop number input이 focus된 상태의 wheel 이벤트는 `preventDefault`하여 값이
우발적으로 변경되지 않게 한다. Focus되지 않은 페이지의 wheel/scroll은 그대로
동작한다.

### 22.3 Version and acceptance [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.6.1 | 1.6.2 | Crop keyboard adjustment UI simplification |
| Template Contract | 1.3.0 | 1.3.0 | 변경 없음 |
| Integration Contract | 1.1.0 | 1.1.0 | 변경 없음 |
| Desktop | 0.5.1 | 0.5.2 | 커스텀 버튼 제거, keyboard step 및 wheel 보호 |

기존 Golden SHA는 OBJECT_RIGHT `20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`,
THUMBNAIL_BOX_RIGHT `f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996`,
THUMBNAIL_MULTI_RIGHT `ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55`로
유지한다. E2E와 packaged smoke는 버튼 부재, keyboard decimal 조절, wheel 보호,
Preview/Export 및 Slot 독립성을 검증한다.

## 23. Phase C6 — MASK_SEMICIRCLE_RIGHT (historical v1 snapshot) [PROJECT]

> 이 절의 required white logo 조항은 C6 v1 historical snapshot이다. 현재 계약은 아래 24절의 C6 v2 optional black logo 조항이다.

Phase C6는 기존 세 Template의 좌표·Golden을 변경하지 않고,
`KAKAO_BIZBOARD_MASK_SEMICIRCLE_RIGHT`를 additive capability로 동결한다. 새 결정은
[PROJECT] 또는 기준 PNG에서 계산한 [DERIVED]/[TOOL_OUTPUT]로 표시하며 카카오 업로드
승인을 주장하지 않는다.

### 23.1 Reference and geometry [TOOL_OUTPUT] [DERIVED]

기준 파일은 `reference/kakao-tool/MASK_SEMICIRCLE_RIGHT.png`이며 SHA-256은
`90a2e948d979b204867c837485ca0d4b391de4ca44c22ca36e9f3f53862ac75e`, PNG는
1029×258 RGBA-32다. 기준 출력에서 확인한 형상은 다음과 같다.

- circle center `(801,225)`, radius `180`
- logo cutout `(839,16,142,60)`, right/bottom exclusive `(981,76)`
- `IMAGE_PRIMARY` destination `(621,45,360,213)`, right/bottom exclusive `(981,258)`
- text origin x=`48`, baselines headline=`120`, subcopy=`178`, hard right exclusive=`588`, maximum occupied width=`540`, minimum gap=`33`

Renderer는 이 좌표를 변경하거나 좌우·상하 crop하지 않는다. 내부 runtime mask는
`assets/masks/kakao-bizboard-mask-semicircle-right-v1.png`에 고정하고 registry의
SHA-256과 dimensions를 매 실행 검증한다. 기준 PNG는 수정·재저장·최적화하지 않는다.

### 23.2 Ordered slots and logo contract [PROJECT]

Capability는 반드시 두 slot을 `IMAGE_PRIMARY` → `LOGO_PRIMARY` 순서로 실행한다.
`IMAGE_PRIMARY`는 PNG/JPEG, `SEMANTIC_CROP_COVER` 또는 `MANUAL_CROP` + `COVER`를
사용한다. `LOGO_PRIMARY`는 PNG·alpha 필수, `ALPHA_TRIM_CONTAIN` + `CONTAIN`,
source `DETERMINISTIC`, anchor `CENTER`만 허용한다. 로고 safe box는
`(847,24,126,44)`이며 container의 8px inset은 [PROJECT]다. visible RGB는 모든
`alpha >= 8` 픽셀에서 각 채널 `>= 240`이어야 하고 자동 recolor·candidate·focal·crop은
금지한다. 최대 upscale은 기존 1.5×이며 1× 초과는 WARNING, 1.5× 초과는 ERROR다.

로고가 없거나 계획·alpha·투명 배경·백색·가시 픽셀·slot containment 조건을
만족하지 않으면 `KBR-LOGO-*` 오류로 전체 artifact를 차단한다. IMAGE와 LOGO가 같은
asset ID인 경우도 `KBR-LOGO-ASSET-DUPLICATE`로 차단한다.

### 23.3 Mask composition and alpha [DERIVED] [PROJECT]

Image crop를 contain scale의 부동소수점으로 계산하고 `round`/`floor` 규칙은 기존
계약을 그대로 사용한다. 내부 mask alpha와 source alpha를 곱하여 IMAGE 픽셀을
합성하고, logo와 copy는 그 위에 그린다. alpha를 이진화하지 않고 반투명 값을
보존하며 완전 투명 픽셀의 RGB는 시각 콘텐츠로 보지 않는다. visible layout 검사는
alpha `>= 8`, trim 보존은 alpha `>= 1`이다. 주 연결요소와 무관한 극소 고립 픽셀은
visible bbox 확장에 사용하지 않는다.

### 23.4 Versions and compatibility [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.6.2 | 1.7.0 | MASK_SEMICIRCLE_RIGHT additive template/slot contract |
| Template Contract | 1.3.0 | 1.4.0 | Mask geometry and required logo slot registry |
| Integration Contract | 1.1.0 | 1.2.0 | Ordered slot capabilities, mask digest, logo validation fields |
| Desktop | 0.5.2 | 0.6.0 | Image/logo picker, preview/export, mask diagnostics |

기존 Integration Input의 `1.1.0` plan은 읽기 호환으로 허용하지만 새 공개 계약과
출력 capability는 `1.2.0`이다. 기존 OBJECT/BOX/MULTI Golden은 각각
`20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`,
`f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996`,
`ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55`로 유지한다.

### 23.5 Desktop Lab and acceptance [PROJECT]

Lab은 MASK를 선택하면 IMAGE_PRIMARY와 LOGO_PRIMARY를 별도 표시하고, logo에는
편집 UI 대신 PNG/white/alpha/safe-box 정책과 Core `whiteValidation`을 표시한다.
preview에서만 black backdrop 토글을 제공하며 export PNG에는 포함하지 않는다. 오류가
하나라도 있으면 PNG·manifest publish와 download를 모두 차단한다. 동일 Windows
10/11 x64 환경에서 동일 입력·asset·dependency·runtime을 3회 실행한 MASK PNG는
byte-equal이어야 하며, C6 Golden은
`b9daf8cb11c386c06864e50494b14cc331a284919380fbc548c6a05420f486ac`다. macOS/Linux
pixel tolerance는 v1 범위가 아니다.

## 24. Phase C6 v2 — Optional Black LOGO_PRIMARY (historical snapshot) [PROJECT]

> C6b supersedes this section. It is retained to preserve the versioned decision history;
> the current contract is §25 and has no logo cutout or color restriction.

C6 v2는 동일한 analytic mask와 좌표를 유지하면서 `LOGO_PRIMARY`를 선택형으로
변경한다. `IMAGE_PRIMARY`만 있으면 로고 없는 결과물을 정상적으로 Preview·Export할 수
있다. 로고가 있으면 별도 Asset과 Plan이 모두 존재해야 하며, 하나만 존재하는 상태는
결정적 ERROR다. 로고가 없는 경우 cutout은 계속 투명하고 검정 backing rectangle은
생성하지 않는다.

### 24.1 Black logo contract [PROJECT]

`LOGO_PRIMARY`는 `required: false`, `image/png`, alpha channel, transparent background,
`ALPHA_TRIM_CONTAIN`, `CONTAIN`, `CENTER`, `DETERMINISTIC`만 허용한다. Crop Rect,
Crop Candidate, Focal Point, 수동 위치·회전·자동 recolor는 금지한다. visible
`alpha >= 8` 픽셀의 모든 RGB channel은 `<= 32`여야 하며 위반 시
`KBR-LOGO-COLOR-NOT-BLACK` ERROR다. 최대 upscale은 1.5×이고 1× 초과는 WARNING,
1.5× 초과는 ERROR다.

### 24.2 Optional slot and plan rules [PROJECT]

- 로고 없음: IMAGE_PRIMARY Asset·Plan 정확히 1개, 최종 applied placement 1개
- 로고 있음: IMAGE_PRIMARY와 LOGO_PRIMARY Asset·Plan 각 1개, Template 순서로 2개
- Asset만 있고 Logo Plan이 없으면 `KBR-LOGO-PLAN-MISSING`
- Logo Plan만 있고 Asset이 없으면 `KBR-LOGO-ASSET-MISSING`
- 로고 없는 결과물의 IMAGE cutout 영역은 alpha 0으로 유지

### 24.3 Desktop Lab and Preview [PROJECT]

Lab은 `로고 사용` 토글을 제공한다. 검정 투명 PNG를 선택하면 Black Logo 검증,
Alpha Trim bbox, contain destination, upscale 경고를 표시하고, 토글을 끄거나 로고를
선택하지 않으면 로고 없이 Preview·Export한다. Preview backdrop은 흰색 또는
체커보드로 표시할 수 있으며 backdrop과 guide는 Export PNG에 포함하지 않는다.

### 24.4 Version and compatibility [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.7.0 | 1.8.0 | Optional black LOGO_PRIMARY and no-logo mode |
| Template Contract | 1.4.0 | 1.5.0 | Logo required/color policy clarification without coordinate changes |
| Integration Contract | 1.2.0 | 1.3.0 | Optional slot capability and `blackValidation` metadata |
| Desktop | 0.6.0 | 0.7.0 | Optional logo toggle and black-logo Lab flow |

기존 Integration Input `1.1.0`과 C6 v1 `1.2.0` plan은 읽기 호환으로 허용하고,
현재 공개 capability와 output은 `1.3.0`이다. 기존 세 Template Golden은 변경하지 않는다.
검정 로고를 포함한 현재 MASK Golden은
`dca6aa2db0c6593fcedb23dfee5a4d625356c3e8d75083e604c9866f45f530d2`이며 동일한 Windows
10/11 x64 환경의 3회 실행에서 byte-equal이어야 한다.

## 25. Phase C6b — Restored semicircle and LOGO_PRIMARY overlay [PROJECT]

C6b는 기존 반원 위치와 좌표를 유지하면서 v2 구현의 잘못된 logo cutout만 제거한다.
기준 PNG의 `logo` 표시는 shape cutout이 아니라 overlay 위치 가이드로 해석한다. 최종
PNG에는 guide 또는 검정 backing block을 그리지 않으며, 투명 RGBA canvas에서 image와
선택형 logo를 합성한다.

### 25.1 Restored mask geometry [TOOL_OUTPUT] [DERIVED] [PROJECT]

복원 원호는 center `(801,225)`, radius `180`, bbox `(621,45,360,360)`을 사용한다.
`IMAGE_PRIMARY` destination은 `(621,45,360,213)`으로 유지하고 right margin
`x=981..1028`은 투명해야 한다. runtime mask는 circle-only analytic alpha이며 logo
cutout을 포함하지 않는다. 내부 asset `assets/masks/kakao-bizboard-mask-semicircle-right-v1.png`
의 SHA-256은 `eb9ea4859e2b75384ac814add59ce9636ce865ad5bae5a33f76d46210bfa6027`이다.
reference fixture `MASK_SEMICIRCLE_RIGHT.png`의 SHA-256
`90a2e948d979b204867c837485ca0d4b391de4ca44c22ca36e9f3f53862ac75e`는 불변으로
유지하며 수정·재저장·최적화하지 않는다.

### 25.2 IMAGE_PRIMARY and composition [PROJECT]

`IMAGE_PRIMARY`는 PNG/JPEG와 `SEMANTIC_CROP_COVER` 또는 `MANUAL_CROP`/`COVER`를
사용한다. 고정 순서는 투명 canvas → copy raster → crop resolve → circle-only mask
적용 → image composite → 선택된 logo overlay composite → Validator다. 기존 EXIF
orientation, cropRect, anchor, no-clamp 규칙과 `preview/export` byte equality를
유지한다. cutout 복원은 새 도형 재배치가 아니라 기존 shape의 사라진 영역을 동일
원호로 메우는 구현이다.

### 25.3 LOGO_PRIMARY overlay contract [PROJECT]

`LOGO_PRIMARY`는 `required: false`인 별도 overlay slot이다. PNG와 alpha channel,
transparent background가 필수이며 색상 제한은 **없음**이다. black/white/brand-color
원본을 그대로 허용하고 recolor 또는 grayscale 변환을 하지 않는다. plan은
`ALPHA_TRIM_CONTAIN`, `CONTAIN`, `CENTER`, `DETERMINISTIC`으로 고정하고 cropRect,
cropCandidate, focalPoint, 임의 위치·회전은 금지한다. container는
`(839,16,142,60)`, safe content box는 `(847,24,126,44)`이며 alpha trim threshold는
`1`, visible threshold는 `8`, 최대 upscale은 `1.5×`다. 1× 초과 1.5× 이하는 WARNING,
초과는 `KBR-LOGO-UPSCALE-LIMIT` ERROR다. `KBR-LOGO-COLOR-NOT-BLACK`과
`blackMonochromeRequired`/`whiteMonochromeRequired`는 현재 계약에 존재하지 않는다.

로고 없이 `IMAGE_PRIMARY`만 제출하면 applied placement 1개로 PASS한다. 두 Asset을
제출하면 LOGO plan도 반드시 있어야 하며, Asset만 있으면 `KBR-LOGO-PLAN-MISSING`,
Plan만 있으면 `KBR-LOGO-ASSET-MISSING`으로 artifact/publish/download를 차단한다.
opaque background와 empty transparent PNG는 각각 `KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED`
와 `KBR-LOGO-EMPTY` ERROR다.

### 25.4 Renderer Lab [PROJECT]

MASK Lab은 IMAGE_PRIMARY PNG/JPG/JPEG panel과 LOGO_PRIMARY PNG panel을 제공한다.
logo panel은 `로고 사용` toggle, alpha 여부, transparent background 결과, alpha trim
bbox, applied destinationRect, upscale ratio, validation message를 표시한다. 안내는
“투명 배경 PNG 로고를 업로드하세요. 로고는 반원 위에 오버레이로 배치됩니다. 로고
색상은 자동으로 변경되지 않습니다. 로고 없이도 저장할 수 있습니다.”로 고정한다.
white backdrop/checkerboard와 reference guide는 Preview DOM에서만 허용하고 export에
포함하지 않는다.

### 25.5 Version, Golden, and acceptance [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.8.0 | 1.9.0 | 반원 cutout 제거·원호 복원 및 logo overlay 계약 |
| Template Contract | 1.5.0 | 1.6.0 | 좌표 불변, circle-only mask와 optional overlay 명확화 |
| Integration Contract | 1.3.0 | 1.4.0 | black validation 필드 제거, colorRestriction NONE 및 mask digest 갱신 |
| Desktop | 0.7.0 | 0.7.1 | Lab logo 안내·진단을 투명 색상 무제한 overlay로 갱신 |

기존 OBJECT_RIGHT, THUMBNAIL_BOX_RIGHT, THUMBNAIL_MULTI_RIGHT Golden은 각각
`20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`,
`f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996`,
`ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55`로 유지한다.
C6b MASK Golden은 `ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145`이며
동일 Windows 10/11 x64 환경에서 동일 입력·asset·dependency·runtime을 3회 실행해
byte-equal이어야 한다. 다른 OS의 pixel tolerance는 v1 Acceptance에 포함하지 않는다.

## 26. Phase F0 — FREEFORM Renderer Contract Freeze [PROJECT]

F0는 아직 Template에 고정되지 않은 지면을 위한 실행 경계만 동결한다. 이 절은
카카오의 공식 FREEFORM 광고 규격을 주장하지 않으며, Agent/User가 생성한 Plan을
독립적으로 검증할 수 있게 하는 본 프로젝트의 `[PROJECT]` 계약이다. F0의 계약
상태는 `CONTRACT_FROZEN`이며, F1은 그 의미를 변경하지 않고 내부
테스트 Profile에 한해 Core Raster를 추가한다. **[PROJECT]**

### 26.1 LayoutMode와 Integration alignment [PROJECT]

`LayoutMode`는 `TEMPLATE_LOCKED | FREEFORM`이다. `layoutMode`가 생략된 기존 JSON은
`TEMPLATE_LOCKED`로 처리한다. Template mode는 `templateId`, 기존 Template Input,
Template Registry Slot 좌표를 유지한다. FREEFORM은 `CreativeLayoutPlan v1.0.0`을
필수로 하며 Plan에 없는 Layout을 생성하지 않는다. FREEFORM branch에서는
`templateId`, `imagePlacementPlans`, `cropCandidates`를 사용하지 않고, 가짜
`imageSlotId`를 만들지 않는다. 공개 Integration Contract는 기존 fields를 제거하지
않고 `layoutMode`와 `creativeLayoutPlan`을 optional additive로 추가하여 v1.5.0으로
minor bump한다. **[PROJECT]**

### 26.2 CreativeLayoutPlan과 Element [PROJECT]

```typescript
type CreativePlanSource = "MANUAL" | "AGENT" | "SAVED_CREATIVE";

interface CreativeLayoutPlan {
  schemaVersion: "1.0.0";
  formatProfileId: string;
  source: CreativePlanSource;
  background: CanvasBackground;
  elements: readonly CreativeElement[];
}
```

Plan은 Canvas width/height를 중복 저장하지 않는다. Element는 `IMAGE`, `TEXT`,
`LOGO`, `SHAPE` 중 하나이며 `id`는 Plan 안에서 unique, bounds는 normalized 0..1,
opacity는 0..1(생략 시 1), zIndex는 integer다. composite 순서는 zIndex ascending 후
원래 elements 배열 순서다. rotation, skew, arbitrary transform, blur, shadow,
blend mode, gradient, arbitrary mask, vector path와 auto-layout은 거부 대상이며
무시하지 않는다. **[PROJECT]**

`SHAPE`의 RECTANGLE/ELLIPSE와 fillColor는 계약만 정의하며 F0에서 Raster하지 않는다.
**[PROJECT]**

### 26.3 ImagePlacementSpec [PROJECT]

FREEFORM IMAGE와 LOGO는 `assetId`, bounds, zIndex와 다음 공통 placement를 사용한다.

```typescript
interface ImagePlacementSpec {
  policy: ImagePlacementPolicy;
  source: PlacementPlanSource;
  fitMode: "CONTAIN" | "COVER";
  cropRect?: NormalizedRect;
  focalPoint?: NormalizedPoint;
  anchor: ImageAnchor;
  subjectProtection: SubjectProtection;
  cropCandidateId?: string;
  confidence?: number;
  protectedSubjects?: readonly ProtectedSubject[];
  rationale?: string;
}
```

`imageSlotId`는 FREEFORM Element와 PlacementSpec에 존재하지 않는다. 기존 public
`ImagePlacementPlan`은 Template adapter를 위해 유지한다. **[PROJECT]**

### 26.4 Text, Font, Wrap/Overflow [PROJECT]

Text color는 `#RRGGBB` 또는 `#RRGGBBAA`만 허용하며 canonical 비교 시 대문자로
정규화한다. Text는 `fontId`만 사용하고 `fontFamily` 문자열, OS fallback, CSS generic
fallback, remote font loading은 금지한다. 현재 Registry에는 SHA-256이 검증된
`SPOQA_HAN_SANS_REGULAR`와 `SPOQA_HAN_SANS_BOLD`만 있다. 미등록, missing, digest
mismatch는 각각 `KBR-FONT-NOT-REGISTERED`, `KBR-FONT-ASSET-MISSING`,
`KBR-FONT-ASSET-DIGEST-MISMATCH`다. **[PROJECT]**

`wrapMode`는 `NO_WRAP`, `EXPLICIT_NEWLINES`, `WORD_WRAP`, `overflowMode`는 `ERROR`,
`CLIP`으로 정의한다. F0의 실행 가능 wrap은 `NO_WRAP`과 `EXPLICIT_NEWLINES`뿐이며
WORD_WRAP은 Unicode segmentation 버전이 고정될 때까지 `KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED`
ERROR다. NO_WRAP은 newline을 금지하고 EXPLICIT_NEWLINES는 입력 `\n`만 사용한다.
자동 font shrink, letter-spacing 축소, bounds 확대, ellipsis는 금지한다. 단위는 px,
fontSizePx와 lineHeightPx는 양수, letterSpacingPx는 finite, opacity 기본값은 1,
letterSpacingPx 기본값은 0이다. 실제 ERROR overflow pixel 판정은 Raster Phase에서
구현한다. **[PROJECT]**

### 26.5 Canvas / FormatProfile identity [PROJECT]

```typescript
interface FormatProfile {
  formatProfileId: string;
  canvas: { width: number; height: number };
  layoutMode: LayoutMode;
  allowedOutputFormats: readonly ("PNG" | "JPG" | "JPEG")[];
  implementationStatus: "NOT_IMPLEMENTED" | "PARTIAL" | "IMPLEMENTED";
}
```

실행 시 `RendererInput.formatProfileId === CreativeLayoutPlan.formatProfileId ===
Loaded FormatProfile.formatProfileId`를 exact equality로 검증한다. 불일치는
`KBR-FREEFORM-FORMAT-PROFILE-MISMATCH`, loaded canvas가 없으면
`KBR-FREEFORM-CANVAS-PROFILE-MISSING`이다. 현재 내부 contract test profile만 기존
1029×258을 사용하며 `PROJECT_TEST_ONLY`다. Native 1200은 공식 dimensions/file size가
확정되지 않았으므로 `CATALOG_NOT_READY`이고 숫자를 추측하지 않는다. PNG는 기존
encoder를 재사용할 수 있는 계약 상태였다. F0/F1의 JPG `NOT_IMPLEMENTED` 상태는
historical baseline이며, F3A fixed Profile은 canonical `JPEG`와 호환 `JPG` alias를
추가한다. **[PROJECT]**

### 26.6 Fingerprint policy [PROJECT] [DERIVED]

`artifactChecksumSha256`은 최종 bytes, `pixelFingerprint`는 pixel-affecting
material, `requestFingerprint`는 전체 Canonical Request와 provenance다. Pixel material은
FormatProfile ID와 Canvas, background, stable element order, bounds/zIndex, text
content/font asset digest/metrics/color, image asset digest/placement/crop, opacity와
encoding을 포함한다. source, rationale, confidence, timestamp, absolute path, UI state와
Agent metadata는 pixel material에서 제외한다. 동일 Layout의 MANUAL과 AGENT는 같은
pixelFingerprint/artifact를 만들 수 있고 requestFingerprint만 달라질 수 있다.
기존 `renderFingerprint` alias 의미는 pixelFingerprint로 유지한다. Canonical JSON은
UTF-8, BOM 없음, NFC, JCS key/number canonicalization, array order 보존과 project-relative
asset reference를 사용한다. **[PROJECT] [DERIVED]**

### 26.7 Version, files, and acceptance [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.9.0 | 1.10.0 | FREEFORM 실행 모델과 7개 핵심 경계 추가 |
| Integration Contract | 1.4.0 | 1.5.0 | optional layoutMode/CreativeLayoutPlan additive extension |
| CreativeLayoutPlan | — | 1.0.0 | 신규 FREEFORM plan 계약 |
| Template Contract | 1.6.0 | 1.6.0 | 기존 좌표·Template 동작 불변 |
| Desktop | 0.7.1 | 0.7.1 | UI/raster 구현 제외 |

Machine-readable Schema는 `packages/renderer-contract/schema/creative-*`와
`image-placement-spec-v1.schema.json`, `format-profile-v1.schema.json`에 있다.
Font/FormatProfile Registry는 `contracts/freeform-font-registry.json`과
`contracts/freeform-format-profiles.json`이다. Contract 검증은
`pnpm verify:freeform-contract`와 `pnpm test:freeform-contract`로 수행하고, 기존
Template Golden SHA는 변경되지 않아야 한다. **[PROJECT]**

## 27. Phase F1 — FREEFORM Core Raster v1 [PROJECT]

F1은 `KBR_FREEFORM_CONTRACT_TEST_1029X258` FormatProfile(1029×258, PNG)에서만
FREEFORM Core 실행을 활성화한다. Renderer entry는 `layoutMode`를 먼저 해석한다.
생략된 `layoutMode`는 기존 `TEMPLATE_LOCKED` 경로를 그대로 사용하고, `FREEFORM`은
Plan 존재·Profile exact equality·Schema·asset/font digest를 검증한 뒤 별도 Raster
경로를 실행한다. Template 좌표와 기존 Golden은 변경하지 않는다. **[PROJECT]**

실행 가능한 Element는 `IMAGE`, `TEXT`, `LOGO`다. Image/Logo는
`ALPHA_TRIM_CONTAIN`, `CENTER_CONTAIN`, `SEMANTIC_CROP_COVER`, `MANUAL_CROP`을
사용하며, normalized bounds는 `floor(left/top)`, `ceil(right/bottom)`의 exclusive
pixel rect로 변환한다. `zIndex` ascending과 원래 배열 순서를 안정적으로 보존한다.
배경은 deterministic RGBA transparent/solid다. Text는 등록된 Spoqa font만 사용하고
`NO_WRAP`, `EXPLICIT_NEWLINES`, `ERROR`/`CLIP`만 실행한다. `WORD_WRAP`은
`KBR-FREEFORM-TEXT-WRAP-NOT-SUPPORTED`, `SHAPE`는
`KBR-FREEFORM-ELEMENT-TYPE-NOT-SUPPORTED`로 fail closed한다. F1/F2 당시 JPG도
`KBR-FREEFORM-OUTPUT-FORMAT-NOT-SUPPORTED`였지만 F3A fixed catalog에서는 명시적
PNG/JPEG Profile output으로 대체한다. 자동 Layout,
font shrink, crop candidate 생성, rotation/skew/effect, Native 1200은 F1 범위가 아니다.
**[PROJECT]**

출력은 기존 RGBA PNG encoder와 atomic staging publisher를 재사용한다. ERROR가 있으면
최종 manifest/PNG를 만들지 않으며, ERROR 0일 때만 manifest와 PNG를 publish한다.
Persisted manifest에는 `formatProfileId`, `appliedElements`, `pixelFingerprint`,
`requestFingerprint`를 기록할 수 있지만 자신의 digest는 기록하지 않는다.
`artifactChecksumSha256`은 최종 PNG bytes digest다. `pixelFingerprint`는 source,
rationale, confidence를 제외하고 `requestFingerprint`만 provenance를 포함한다.
**[PROJECT] [DERIVED]**

F1의 상세 실행 계약과 Acceptance mapping은
`docs/implementation/freeform-core-raster-v1.md` 및
`tests/freeform-core/freeform-core.test.ts`에 고정한다. 이 구현은 카카오의 공식
FREEFORM 업로드 승인이나 Native 1200 규격을 보장하지 않는다. **[PROJECT]**

## 28. Phase F2 — FREEFORM Validator & Compliance Hardening [PROJECT]

F2는 F0/F1의 FREEFORM 의미와 버전을 변경하지 않고 검증 경계를 명시한다. Validator는
매체·FormatProfile·Input/Plan·Asset·Raster artifact의 계약 준수만 검사하며 디자인 평가기,
자동 Layout 생성기, 미적 QA가 아니다. 제품이 충분히 커 보이는지, 카피가 예쁜지, 로고가
눈에 띄는지, 구도가 좋은지와 같은 판단은 검증하지 않는다. **[PROJECT]**

### 28.1 Staged validation and fail-closed gate [PROJECT]

공개 FREEFORM 실행 순서는 다음으로 고정한다.

```text
Input shape/schema → FormatProfile/LayoutMode → Plan/elements → assets/fonts
→ PRE_RENDER gate → raster → PNG/JPEG/appliedElements/checksum POST_RENDER
→ atomic publish
```

모든 FREEFORM Issue에는 실행 결과에서 `stage: PRE_RENDER` 또는
`stage: POST_RENDER`가 부여된다. PRE_RENDER `ERROR`가 하나라도 있으면 raster 호출,
PNG encode, staging artifact, publish, download를 실행하지 않는다. POST_RENDER `ERROR`도
동일하게 publish/download를 차단한다. Issue는 severity, stage, input path, code,
message key와 식별자 기준으로 deterministic sort/dedupe하며 AJV 원문 메시지를 외부
계약으로 노출하지 않는다. **[PROJECT]**

### 28.2 Plan, profile, asset, and unsupported features [PROJECT]

FormatProfile ID는 request, CreativeLayoutPlan, loaded registry에서 exact equality여야
하고 `layoutMode`는 FREEFORM, canvas와 해당 Profile의 PNG/JPEG capability가 구현 상태여야 한다. Plan의
schemaVersion, unknown property, unique element ID, normalized bounds, integer zIndex,
background(`TRANSPARENT`/`SOLID`와 `#RRGGBB`/`#RRGGBBAA`)를 검증한다. MIME signature,
decode, dimensions, declared checksum/dimensions, trusted asset resolution을 검증하며
absolute path는 Issue payload에 넣지 않는다. IMAGE placement는 정책과 fit/crop 관계를
그대로 검사하고 crop/focal/candidate를 자동 생성·보정하지 않는다. ALPHA_TRIM_CONTAIN은
alpha channel이 없는 자산을 거부한다. **[PROJECT]**

LOGO는 alpha PNG, layout-visible pixel, 투명 배경 조건을 요구하지만 색상은 제한하지
않는다. 등록된 Font ID와 SHA-256이 일치하는 asset만 사용하며 system/remote fallback은
금지한다. `NO_WRAP`과 `EXPLICIT_NEWLINES`만 실행하고 `WORD_WRAP`, `SHAPE` raster는
PRE_RENDER에서 명시적 ERROR로 fail closed한다. F3A는 explicit JPEG output을 추가하며,
transparent background JPEG는 별도 ERROR다. Text `ERROR` overflow는
raster ink 기준 POST_RENDER ERROR, `CLIP` overflow는 deterministic clip과
`overflowDetected`/`clipped` evidence로 기록한다. **[PROJECT]**

### 28.3 Applied evidence and artifact integrity [PROJECT] [DERIVED]

`appliedElements`는 raster path가 실제 적용한 단일 값의 source of truth다. Element ID/type,
normalized bounds, zIndex/order, opacity, destination pixel rect, asset/font digest,
placement/crop, text metrics/color/wrap/overflow evidence를 검증한다. Pixel rect는
canvas 안의 양의 정수 rect이고 normalized 변환 및 실제 crop 결과와 일치해야 한다.
PNG signature/decode 또는 JPEG metadata/decode, FormatProfile canvas dimensions,
PNG의 경우 RGBA 8-bit IHDR, non-zero bytes와 artifact checksum을 POST_RENDER에서
재검증한다. 기존 `validateRenderedPng`와 atomic
staging publisher는 Template 경로의 의미와 Golden bytes를 변경하지 않는다. **[PROJECT]
[DERIVED]**

### 28.4 Version and boundary record [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.10.0 | 1.10.0 | F2는 frozen contract의 검증 구현만 추가 |
| Integration Contract | 1.5.0 | 1.5.0 | stage/applied evidence는 additive runtime metadata |
| CreativeLayoutPlan | 1.0.0 | 1.0.0 | Plan 의미 불변 |
| Template Contract | 1.6.0 | 1.6.0 | Template 좌표·Golden 불변 |
| Desktop | 0.7.1 | 0.7.1 | UI와 FREEFORM Lab 제외 |

F2의 구현 상세와 acceptance는
`docs/implementation/freeform-validator-v1.md`,
`tests/freeform-validator/freeform-validator.test.ts`,
`contracts/contract-versions.json`의 `canonicalPhaseF2`에 기록한다. 이 단계는 공식
카카오 FREEFORM 업로드 승인, Native 1200 dimensions, 또는 디자인 적합성을 보장하지
않는다. **[PROJECT]**

## 29. Phase F3A — Kakao Moment FREEFORM Fixed Format Catalog [PROJECT] [OFFICIAL]

F3A는 카카오모먼트 공식 가이드에서 확인된 정적 이미지 계열을 기존 FREEFORM
Core가 실행할 수 있도록 `FormatProfile + ChannelCompliance` registry로 추가한다.
Renderer는 Layout을 생성하지 않고 제출된 `CreativeLayoutPlan 1.0.0`을 exact
실행한다. 메시지 광고, 개인화 메시지, 보장형/PSD Layer 소재, 상품 Feed, Video
Raster는 이 단계의 범위가 아니다. **[PROJECT]**

### 29.1 Fixed profile catalog [OFFICIAL] [PROJECT]

`MINIMUM_WITH_RATIO`는 공식 최소 크기와 비율을 보존하며, v1의 결정적 Canvas는
공식 최소 크기로 물질화한다(`[PROJECT] OFFICIAL_MINIMUM_SIZE`). `EXACT`는 공식
Canvas를 그대로 사용한다. 같은 Canvas라도 Channel Compliance가 다르면 Profile
ID를 합치지 않는다.

| Profile | Canonical Canvas | Ratio / rule | Output byte rule | Status |
|---|---:|---|---:|---|
| `KAKAO_DISPLAY_NATIVE_2_1` | 1200×600 | 2:1 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_DISPLAY_NATIVE_1_1` | 500×500 | 1:1 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_DISPLAY_NATIVE_9_16` | 720×1280 | 9:16 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_DISPLAY_NATIVE_4_5` | 800×1000 | 4:5 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_DISPLAY_CATALOG_SLIDE_1_1` | 500×500 | 1:1 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_VIDEO_NATIVE_THUMBNAIL_16_9` | 1280×720 | 16:9 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_VIDEO_NATIVE_THUMBNAIL_9_16` | 720×1280 | 9:16 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_VIDEO_NATIVE_SLIDE_1_1` | 500×500 | 1:1 / minimum | ≤500000 | IMPLEMENTED |
| `KAKAO_BIZBOARD_EXPANDABLE_IMAGE_2_1` | 1200×600 | 2:1 / minimum | <500000 | IMPLEMENTED |
| `KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1` | 1080×1080 | 1:1 / minimum | <1000000 | IMPLEMENTED |
| `KAKAO_ADVIEW_FULL_IMAGE` | 720×1560 | exact | ≤400000 | IMPLEMENTED |
| `KAKAO_ADVIEW_COMPACT_IMAGE` | 1280×720 | exact | ≤400000 | IMPLEMENTED |
| `KAKAO_ADVIEW_CAROUSEL_IMAGE` | 1280×720 | exact | ≤400000 | IMPLEMENTED |
| `KAKAO_ADVIEW_SHARE_BUBBLE_IMAGE` | 1280×720 | exact | no additional catalog limit | IMPLEMENTED |
| `KAKAO_ADVIEW_SCROLL_IMAGE` | width 720, height 360–7800 | variable height | ≤400000 | CATALOG_ONLY |

`500KB`, `1MB`, `400KB`는 현재 저장소에서 확인된 exact API byte semantics가
없으므로 `[PROJECT_CONSERVATIVE]` decimal byte `500000`, `1000000`, `400000`으로
고정한다. `미만`은 `LT`, `이하`는 `LTE`다. **[PROJECT]**

### 29.2 Output format and JPEG contract [PROJECT] [DERIVED]

F3A Profile의 명시적 renderer output은 `PNG`와 canonical `JPEG`다. F1 호환을
위해 `JPG` request alias를 parse할 수 있지만 자동 format switching은 금지한다.
JPEG는 현재 lockfile의 Sharp/libvips로 sRGB, alpha 미지원, metadata stripped,
progressive=false, chroma `4:2:0`을 고정한다. `AUTO_FIT`은 quality
`92,88,84,80,76,72,68,64,60,56,52,48` 순서에서 Profile comparator를 처음
만족하는 값이고, 모두 초과하면 `KBR-FREEFORM-JPEG-TARGET-SIZE-NOT-ACHIEVABLE`
ERROR다. JPEG quality/options는 manifest `outputEncoding`과 pixel fingerprint에,
`AUTO_FIT` request는 request fingerprint에 포함한다.

`TRANSPARENT` background + JPEG는 `KBR-FREEFORM-JPEG-TRANSPARENT-BACKGROUND-NOT-SUPPORTED`
ERROR다. 자동 흰색 flatten 또는 alpha 이진화는 하지 않는다. `requiresOpaqueOutput`
가 `true`인 Profile은 최종 artifact pixels가 모두 alpha 255인지 검사하고,
`UNSPECIFIED`는 false로 추론하지 않는다. **[PROJECT]**

### 29.3 Channel Compliance and review boundary [OFFICIAL] [PROJECT] [MANUAL]

- Display Native 2:1 recommended avoid margin `top40,left40,right40,bottom90`는
  renderer-managed TEXT/LOGO 침범 시 WARNING이다.
- Display Native 9:16 required margin `top89,bottom89,left47,right47`는 ERROR,
  low-resolution recommended `top279,bottom438`는 WARNING이다.
- Display Native 4:5 required `top100,bottom100,left40`는 ERROR다. right-bottom
  UI occlusion rectangle은 확정하지 않고 MANUAL REVIEW다.
- Bizboard Expandable Image는 edge 50px와 top-right close-button 84×78을
  renderer-managed TEXT/LOGO가 침범하면 ERROR다. CTA geometry는
  `CTA_SAFE_ZONE_GEOMETRY_NOT_CATALOGED`로 기록한다.
- Bizboard Expandable Multi는 `IMAGE`만 허용하며 TEXT/LOGO/SHAPE는 ERROR다.
  법정 disclaimer PSD 예외는 구현하지 않고
  `PROFILE_NOT_SUITABLE_FOR_REQUIRED_DISCLAIMER_V1`로 문서화한다.
- AdView Fullview의 720×1000 image safe zone과 720×900 text safe zone은
  dimension만 catalog하고 y 위치는 MANUAL REVIEW다. Compactview에는 근거 없는
  safe zone을 추가하지 않는다.
- IMAGE asset 내부 baked text/logo/button/제품 의미는 OCR/CV/LLM으로 분석하지
  않는다. 필요한 경우 `KBR-FREEFORM-MANUAL-REVIEW-REQUIRED` WARNING만 기록한다.

### 29.4 Collection and variable canvas boundary [PROJECT]

Catalog의 `collectionRule`은 min/max metadata다. F3A 공개 request는 단일
`CreativeLayoutPlan`과 단일 artifact만 실행하며 multi-artifact orchestration은
F3B로 연기한다. AdView Scroll은 fixed `FormatProfile.canvas`를 범위형으로
변경하지 않고 `CONTRACT_BLOCKED_VARIABLE_CANVAS` catalog-only로 두며 실행 시
`KBR-FREEFORM-FORMAT-NOT-IMPLEMENTED`를 반환한다.

### 29.5 F3A version and acceptance boundary [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.10.0 | 1.11.0 | fixed FREEFORM catalog, compliance, JPEG contract |
| Integration Contract | 1.5.0 | 1.6.0 | additive output format/profile metadata |
| CreativeLayoutPlan | 1.0.0 | 1.0.0 | Layout shape unchanged |
| Template Contract | 1.6.0 | 1.6.0 | coordinates and Goldens unchanged |
| Desktop | 0.7.1 | 0.7.1 | UI deferred to F4 |

F3A의 상세 registry는 `contracts/freeform-format-profiles.json`, 구현은
`docs/implementation/kakao-freeform-format-profiles-v1.md`, catalog 근거는
`docs/catalog/kakao-moment-freeform-format-catalog-v1.md`, ADR은
`docs/adr/ADR-0032`–`ADR-0036`에 둔다. 이 계약은 카카오 공식 업로드 승인이나
이미지 내부 의미 적합성을 보장하지 않는다.

## 30. Phase F4 — Multi-profile FREEFORM Renderer Lab UI [PROJECT]

F4는 동결된 `CreativeLayoutPlan 1.0.0`, F2 Validator, F3A FormatProfile 및 Core
Raster를 Desktop Renderer Lab에 연결한다. `TEMPLATE_LOCKED`와 `FREEFORM`은 상단
Layout Mode로 분리되고, 기존 네 가지 Template workflow는 동일한 IPC payload와
Golden 경로를 계속 사용한다. **[PROJECT]**

### 30.1 Thin-client boundary [PROJECT]

- Format selector와 human display name은 `contracts/freeform-format-profiles.json`
  metadata에서 생성한다. 14개 `IMPLEMENTED` profile만 선택 가능하며
  `KAKAO_ADVIEW_SCROLL_IMAGE`는 `CATALOG_ONLY` disabled option이다.
- UI는 `CreativeLayoutPlan`을 편집하고 asset token과 output encoding만 IPC로
  전달한다. absolute path, local path, UI zoom, Safe Zone toggle은 public plan에
  들어가지 않는다.
- Preview와 Export는 동일한 Core `renderFreeform` → F2 Validator → artifact
  경로를 사용한다. UI에 별도 raster, auto-crop, auto-layout, font fallback,
  clamp 또는 auto-shrink를 두지 않는다.
- Registry `elementConstraints`는 add controls의 capability hint일 뿐이며,
  JSON Import를 포함한 최종 판정은 Core Validator가 수행한다. Shape와 WORD_WRAP은
  disabled/unsupported 상태를 유지한다.

### 30.2 Editor and compliance surface [PROJECT]

모든 element bounds는 `0..1` normalized JSON number다. X/Y/Width/Height는 직접
소수 입력을 받고 C5B keyboard steps (`0.1`, `0.01`, `0.001`)을 사용한다. ID는
`type prefix + smallest available positive integer`로 시작하며 사용자가 바꿀 수
있고 duplicate는 Core ERROR다. zIndex와 array order는 Core의 stable render order를
그대로 따른다.

Safe Zone overlay는 Profile metadata에 숫자 geometry가 있을 때만 그린다. `REQUIRED`,
`RECOMMENDED`, geometry unknown을 UI에서 구분하며 UNKNOWN 영역을 추측하지 않는다.
Guide는 artifact에 포함되지 않는다. F3A baked-image/manual-review warning은
Core issue와 별도 Manual Review panel에 표시한다. **[PROJECT] [MANUAL]**

### 30.3 Output and stale gate [PROJECT]

Profile이 허용하는 PNG/JPEG만 선택할 수 있다. Transparent + opaque-required
profile 또는 Transparent + JPEG는 UI에서 보정하지 않고 Core Validator ERROR로
표시한다. Preview가 fresh이고 Core ERROR가 0일 때만 download/export가 활성화되며,
profile/background/element/asset/text/font/crop/zIndex/opacity/output 변경은 stale로
만든다. Safe Zone toggle과 UI zoom은 stale 원인이 아니다.

Plan JSON Import/Export/Copy는 `CreativeLayoutPlan`과 token 참조만 포함한다. Export는
Core의 기존 atomic staging publisher를 통해 `output.png` 또는 `output.jpg`와
`render-manifest.json`을 함께 publish한다. 다중 item Profile도 F4에서는 단일
image artifact 하나만 생성하고 collection orchestration은 후속 단계다.

### 30.4 Version and acceptance boundary [PROJECT]

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical 문서 | 1.11.0 | 1.11.0 | UI-only integration; frozen Core contract meaning unchanged |
| Integration Contract | 1.6.0 | 1.6.0 | Existing CreativeLayoutPlan/output fields reused |
| CreativeLayoutPlan | 1.0.0 | 1.0.0 | Plan shape and fingerprint semantics unchanged |
| Template Contract | 1.6.0 | 1.6.0 | Coordinates and existing Goldens unchanged |
| Desktop | 0.7.1 | 0.8.0 | Registry-driven FREEFORM Lab editor and Core bridge |

F4 구현 상세는 `docs/implementation/freeform-renderer-lab-v1.md`, mode/IPC 결정은
`docs/adr/ADR-0037-freeform-lab-mode-separation.md`와
`docs/adr/ADR-0038-freeform-lab-registry-driven-format-selector.md`에 기록한다.
이 단계는 카카오 공식 업로드 승인이나 디자인 의미 적합성을 보장하지 않는다.

## 31. Phase N1A — NAVER Channel Namespace / Composition Contract Freeze [PROJECT]

N1A는 네이버 픽셀 렌더링 단계가 아니라, 기존 Kakao Renderer가 다채널 capability를
안전하게 표현하기 위한 additive contract 단계다. 기존 `KAKAO_MOMENT`,
`TEMPLATE_LOCKED`, `FREEFORM`, Template 좌표, JPEG/PNG encoder, Validator,
fingerprint, Desktop IPC와 Golden bytes는 변경하지 않는다. Plume/원격 서비스/실행 중
네트워크 의존성도 추가하지 않는다. **[PROJECT]**

### 31.1 Channel–Placement–Format/Profile hierarchy [PROJECT]

Capability의 계층은 다음과 같다.

```text
Channel
  └─ Placement (channel-scoped identifier)
      └─ Format/Profile (pixel contract가 확정된 경우에만)
```

Canonical channel namespace는 `KAKAO_MOMENT | NAVER_GFA`다. 기존 FormatProfile의
legacy `channel` catalog-family 문자열은 재해석하지 않으며, additive
`channelNamespace`가 top-level namespace를 표현한다. 따라서 `NAVER_GFA` placement를
global enum으로 평탄화하지 않는다. Naver namespace에 등록된 placement는
`SMARTCHANNEL`, `MOBILE_DA`, `IMAGE_BANNER_1_1`, `MOBILE_NATIVE`, `PC_NATIVE`,
`SHOPPING_NEWS`, `COMMUNICATION_AD`, `MOBILE_DA_FEED`다. 이 목록은 namespace
representability만 보장하며 공식 픽셀 규격을 주장하지 않는다. **[PROJECT]**

### 31.2 Orthogonal axes [PROJECT]

세 축은 서로 다른 질문에 답하므로 하나의 enum으로 합치지 않는다.

```text
CompositionMode
├─ RENDERER_COMPOSED   # Renderer가 최종 raster artifact를 생성
└─ PLATFORM_COMPOSED   # 플랫폼이 source components를 최종 UI로 조합

LayoutMode
├─ TEMPLATE_LOCKED
└─ FREEFORM

ArtifactCardinality
├─ SINGLE
└─ COLLECTION
```

`RENDERER_COMPOSED` capability는 `layoutMode`를 요구하며 기존 두 값만 사용할 수
있다. `PLATFORM_COMPOSED` capability는 final raster layout을 가정하지 않으며
`layoutMode`를 두지 않는다. `COLLECTION`은 future semantic reservation일 뿐 N1A에서
multi-artifact runtime을 구현하지 않는다. 의미는 각각 “누가 최종 UI를 조합하는가?”,
“Renderer가 raster element를 어떻게 배치하는가?”, “몇 개의 artifact/source가
포함되는가?”다. **[PROJECT]**

### 31.3 Existing profile mapping [PROJECT]

기존 Kakao Template/FREEFORM profile은 registry hydration 시 다음 additive metadata를
materialize한다.

| 기존 경로 | channelNamespace | compositionMode | layoutMode | artifactCardinality |
|---|---|---|---|---|
| Kakao Template Locked | `KAKAO_MOMENT` | `RENDERER_COMPOSED` | `TEMPLATE_LOCKED` | `SINGLE` |
| Kakao FREEFORM | `KAKAO_MOMENT` | `RENDERER_COMPOSED` | `FREEFORM` | `SINGLE` |

이 metadata는 canvas, coordinates, asset placement, output bytes 또는 fingerprint
material을 변경하지 않는다. Legacy JSON은 새 field 없이도 decode할 수 있으며, legacy
profile의 deterministic default는 위 Kakao mapping이다. **[PROJECT]**

### 31.4 Naver capability boundary [PROJECT]

N1A의 machine-readable `contracts/channel-capabilities.json`에는 Naver placement
semantic만 등록한다.

| Placement | Composition | Layout | Cardinality | N1A runtime |
|---|---|---|---|---|
| `SMARTCHANNEL` | `RENDERER_COMPOSED` | `TEMPLATE_LOCKED` | `SINGLE` | `CONTRACT_ONLY` |
| `MOBILE_DA` | `RENDERER_COMPOSED` | `FREEFORM` | `SINGLE` | `CONTRACT_ONLY` |
| `IMAGE_BANNER_1_1` | `RENDERER_COMPOSED` | `FREEFORM` | `SINGLE` | `CONTRACT_ONLY` |
| `MOBILE_NATIVE` | `PLATFORM_COMPOSED` | 없음 | `SINGLE` | `DEFERRED` |
| `PC_NATIVE` | `PLATFORM_COMPOSED` | 없음 | `SINGLE` | `DEFERRED` |
| `SHOPPING_NEWS` | `PLATFORM_COMPOSED` | 없음 | `SINGLE` | `DEFERRED` |
| `COMMUNICATION_AD` | `PLATFORM_COMPOSED` | 없음 | `SINGLE` | `DEFERRED` |
| `MOBILE_DA_FEED` | mixed/profile-dependent | profile-dependent | `SINGLE`/`COLLECTION` | `DEFERRED` |

N1A는 SmartChannel 160/200/280 geometry, typography baseline, landing icon/CTA,
disclosure, Template ID, PSD parsing, Naver font, raster output, Golden image, Feed
wrapper, Collection rendering 또는 Desktop Naver UI를 등록하지 않는다. 특히
`NAVER_SMARTCHANNEL_*`와 같은 가짜 pixel profile을 만들지 않는다. **[PROJECT]**

### 31.5 Dispatch, serialization, and version boundary [PROJECT]

`RENDERER_COMPOSED`는 기존 raster dispatch를 사용할 수 있다. `PLATFORM_COMPOSED`가
raster entry point로 전달되면 `KBR-COMPOSITION-MODE-NOT-SUPPORTED` ERROR로
fail-closed하며 output artifact를 만들거나 publish하지 않는다. N1A에서는 실제
Naver platform input을 공개하지 않는다.

N1A는 Canonical 문서를 `1.11.0 → 1.12.0`, Integration Contract를
`1.6.0 → 1.7.0`으로 minor bump한다. `templateContractVersion 1.6.0`,
`CreativeLayoutPlan 1.0.0`, Desktop `0.8.2`는 유지한다. 새 channel capability
schema와 optional FormatProfile/capability fields는 Integration minor에 포함되는
additive metadata로서 기존 FREEFORM registryVersion `1.1.0`의 의미를 바꾸지 않는다.
기존 saved input,
CreativeLayoutPlan, manifest decode와 기존 public enum 값은 유지한다. **[PROJECT]**

N1A acceptance는 기존 Kakao Template/FREEFORM PNG/JPEG, Validator, legacy
serialization, fingerprint와 Golden SHA가 byte-equal인지를 포함한다. 지원 플랫폼은
계속 Windows 10/11 x64이며 다른 OS의 pixel tolerance는 이 계약에 추가하지 않는다.
Naver raster runtime과 Collection runtime은 후속 N1B/N6 계약으로 이관한다. **[PROJECT]**

## 32. Phase N1B — NAVER SmartChannel Template Contract Freeze [PROJECT]

N1B는 N1A에서 표현만 동결한 `NAVER_GFA/SMARTCHANNEL`을 **source-whitelist-only**
Template Contract로 구체화한다. 이 절은 PSD 원본의 조합·파일 provenance·canvas header·guide
geometry를 Registry로 고정하지만, SmartChannel 최종 raster Renderer, PSD text-layer parser,
CTA/landing-icon asset 제작, Desktop UI, Preview/Download를 구현하지 않는다. 실행 중 네트워크와
plume/원격 서비스 의존성도 없다. **[PROJECT]**

### 32.1 Canonical source inventory [TOOL_OUTPUT] [DERIVED]

공식 제공 원본은 외부 source root `SMARTCHANNEL_GUIDE 12/`에서 읽는다. 저장소에는 PSD
바이너리를 임의로 복사하지 않으며, `contracts/naver-smartchannel-template-contract.json`에
파일명·정규화 상대 경로·SHA-256·PSD header canvas를 기록한다.

| Canvas | BASIC | EMPHASIS | BOTTOM_DISCLOSURE | Total |
|---:|---:|---:|---:|---:|
| 750×160 | 8 | 15 | 9 | 32 |
| 750×200 | 8 | 15 | 9 | 32 |
| 750×280 | 16 | 25 | 15 | 56 |
| **Total** | **32** | **55** | **33** | **120** |

실제 검증 결과는 PSD 120/120, catalog SHA-256 120/120, PSD signature `8BPS`/version 1,
width 750 및 높이 160/200/280 일치다. 현재 source root와 기존 catalog의 basename이
20건에서 `(1)` suffix 또는 trailing space 때문에 달라졌지만 SHA-256은 일치한다. Registry는
현재 root의 실제 filename을 canonical filename으로 사용하고 catalog filename을 교차참조로
보존한다. source inventory digest는
`6c9d7da1373e7f03f25fb27b1cc6da46fac21b3b8e2e8a04d54a006302c78e4a`다. **[TOOL_OUTPUT]**

### 32.2 SmartChannel identity and bijection [PROJECT]

공개 capability identity는 다음 축의 곱으로 표현하되, Registry에 실제 PSD가 존재하는 행만
등록한다.

```text
channel= NAVER_GFA
placement= SMARTCHANNEL
layoutMode= TEMPLATE_LOCKED
compositionMode= RENDERER_COMPOSED
artifactCardinality= SINGLE
templateId = NAVER_SMARTCHANNEL_<HEIGHT>_<FAMILY>_<OBJECT_KIND>_<SIDE>_<TEXT_VARIANT>_<AFFORDANCE>
```

`BASIC`, `EMPHASIS`, `BOTTOM_DISCLOSURE` 가족, `STANDARD`, `THUMBNAIL`,
`PERSON_MOVIE(MOVIE_ONLY)` object kind, `LEFT`/`RIGHT` side 및 `NONE`, `LANDING_ICON`,
`APP_CTA` affordance를 보존한다. 120개 Template ID는 unique하며 각 ID는 정확히 한 PSD,
각 PSD는 정확히 한 ID에 대응한다. 좌우 반전, 높이 scale, 누락 affordance/variant의
Cartesian product 파생은 금지한다. **[PROJECT]**

### 32.3 Source text variant naming clarification [PROJECT] [INFERRED]

원본 filename과 N2 representative 후보에는 `3줄`/`THREE_LINE`이 사용되지만, 입력된
초기 whitelist 예시에는 `THREE_LINE`이 누락되어 `MAIN2_SUB`와 명칭 충돌이 있었다. 이
계약은 새 조합을 만들지 않고 PSD filename에 실제 존재하는 `3줄` label을 `THREE_LINE`로
등록한다. `(메인2줄)`이 명시되거나 catalog grammar가 Main×2+Sub를 직접 확인하는 경우만
`MAIN2_SUB`로 분류한다. 이 명칭 결정은 프로젝트 clarification이며 카카오/네이버 공식
문구 규칙이라고 주장하지 않는다. **[PROJECT]**

### 32.4 Geometry and fixed components [DERIVED] [TOOL_OUTPUT]

- 각 높이는 독립 geometry다. 160/200/280을 단일 scale factor로 만들지 않는다.
- `geometry.placementPrimitives`는 source catalog/guide에서 도출된 object/text region과
  gap이다. observed raster bounds와 canonical placement box를 혼동하지 않는다.
- 280 text exposure는 `y=40,height=200`; 280 main/sub guide size는 각각 32px/26px로
  관찰되지만 PSD text-layer metadata가 없는 값은 typography token으로 승격하지 않는다.
- `LANDING_ICON_160_200`, `LANDING_ICON_280`, `APP_CTA_160_200`, `APP_CTA_280`은
  source PSD에 표시되지만 승인 asset digest, canonical optical bounds, label 및 landing
  호환성이 없다. 따라서 registry에만 존재하고 runtime affordance는 disabled다.
- `OBJECT_MAX_GUIDE_260`은 최대 guide와 실제 placement region을 분리해 기록하며 의미를
  추정하지 않는다. `BG off + PNG`는 PSD export instruction이지 Renderer output contract가
  아니다.

### 32.5 Typography and font boundary [PROJECT] [TOOL_OUTPUT]

필요한 Spoqa Han Sans Bold/Regular binary는 기존 `contracts/font-asset-registry.json`의
합법적 OFL asset과 SHA-256으로 확인한다. 다만 120 PSD에서 Photoshop text-layer의
family/PostScript name/weight/style/size/leading/tracking/kerning/alignment/text box/
baseline/fill/opacity/anti-alias metadata를 현재 도구로 추출하지 못했으므로
`contracts/naver-smartchannel-typography.json`의 token은 `UNRESOLVED`다. 문자열 길이,
font fallback, line-height, baseline을 filename 또는 raster bounds로 역추론하지 않는다.
이 상태는 N2의 runtime text readiness blocker이며 Spoqa asset을 Naver PSD와 동일하다고
주장하지 않는다. **[PROJECT]**

160 disclosure two-line의 exact baseline과 200 landing icon y=85/86 편차도 intentional
authoring/raster effect인지 확정하지 않고 unresolved로 남긴다. **[TOOL_OUTPUT]**

### 32.6 Version and runtime boundary [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.12.0 | 1.13.0 | additive SmartChannel source catalog/provenance contract |
| Integration Contract | 1.7.0 | 1.8.0 | additive template registry references; legacy decode preserved |
| Template Contract | 1.6.0 | 1.7.0 | additive Naver Template identity/registry; existing Kakao coordinates unchanged |
| CreativeLayoutPlan | 1.0.0 | 1.0.0 | unchanged |
| Desktop | 0.8.2 | 0.8.2 | no SmartChannel UI/runtime in N1B |

N1B 공개 runtime은 `CONTRACT_ONLY`다. SmartChannel PNG/Sharp/Canvas/Golden/Preview/
Download/직접 Naver upload는 후속 N2 범위이며, runtime network access는 계속
`PROHIBITED`다. **[PROJECT]**

### 32.7 Acceptance and next gate [PROJECT]

N1B acceptance는 source count/canvas/hash, family count, Template↔PSD bijection, unique
identity, unsupported combination fail-closed registry, typography unresolved honesty,
fixed-component unresolved honesty, version bump 및 기존 Kakao regression을 검사한다.
N2 representative candidates는 registry-only로 6개를 보관한다. source inventory gate는
통과하지만 PSD text metadata와 fixed assets가 unresolved이므로 `nextPhase.ready=false`다.
N1B는 공식 Naver 업로드 승인이나 광고 심의 적합성을 보장하지 않는다. **[PROJECT]**

## 33. Phase N1C — NAVER SmartChannel Source Asset & Typography Resolution [PROJECT]

N1C는 N1B의 SmartChannel Renderer가 아니라 외부 공식 source revision, PSD layer metadata,
고정 UI source layer, typography identity 및 N2 readiness를 검증한다. PSD binary는 계속 외부
source root에만 두며, 추출기는 local-only development tooling이다. Runtime raster, Desktop UI,
Preview, Download, Naver upload 및 실행 중 네트워크는 구현하지 않는다. **[PROJECT]**

### 33.1 Current official guide and source revision [OFFICIAL] [TOOL_OUTPUT]

현재 공식 [SmartChannel 광고가이드](https://ads.naver.com/adguide/1475)는 2026-05-22에
갱신된 `SMARTCHANNEL_GUIDE.zip` 다운로드를 제공한다. 750×280 도입 배경은
[2025-06-03 공지](https://ads.naver.com/notice/22349)로 교차 확인하고, 2026-06-01 [제작 가이드 및 노출
지면 일부 조정 공지](https://ads.naver.com/notice/31978)의 source-backed 규칙은 다음과 같다.

- 750×280 썸네일형 오브젝트는 2026-06-25부터 200×200 비율로 통일한다.
- 750×280 오브젝트 영역 안 광고주 로고는 2026-06-08부터 상단 24px 및 하단 24px 필수 여백을 갖는다.
- 750×160 및 750×200 제작 가이드에는 해당 공지의 geometry 변경이 없다.
- 750×200 모바일 메인 홈 노출은 2026-06-25부터 종료되며 소재 자체 삭제/등록 불가로
  해석하지 않는다. 이는 placement availability metadata이며 Renderer geometry가 아니다.

현재 공식 다운로드의 outer ZIP SHA-256은
`620ee9c4e6ff421e5d57a05e8de65f7da04294043dc9e9f21581fa6209fbbc1a`다. ZIP 내부의
비-Mac PSD 120개와 외부 `SMARTCHANNEL_GUIDE 12/`의 PSD 120개는 SHA-256 집합이
120/120 일치한다. 280 source PSD에는
`썸네일 오브젝트 영역 : 200px X 200px (위치, 가로폭 & 높이값 고정)` layer가 실제로
존재하므로 현재 공지와 `sourcePsdMatches=true`로 동결한다. **[TOOL_OUTPUT]**

### 33.2 PSD metadata extraction [TOOL_OUTPUT] [DERIVED]

`scripts/extract-naver-smartchannel-source.py`는 `psd-tools==1.18.0`,
`Pillow==12.3.0`, `numpy==2.5.1`을 사용하는 local-only extractor다. 추출 결과는
`contracts/naver-smartchannel-psd-metadata.json`에 source SHA와 연결해 저장한다.

| 항목 | 결과 |
|---|---:|
| PSD | 120 |
| 전체 Text Layer | 1,397 |
| visible Text Layer | 1,031 |
| exact typography token | 25 |
| source layer fixed UI asset | 공식 PSD layer만 사용 |
| inferred font identity | 0 |

각 text layer에는 layer path/name/kind/visibility/pixel bounds/transform/text engine
style/paragraph/anti-alias/fill/opacity/font identity 및 point-text origin을 보존한다.
추출기에서 PNG fixed asset을 만들 때도 원본 PSD layer의 RGBA pixel만 사용하며 색상 변환,
최적화 또는 임의 제작을 하지 않는다. **[PROJECT]**

### 33.3 Typography identity and runtime font gate [DERIVED] [PROJECT]

PSD resource와 text run metadata에서 다음 PostScript name을 직접 확인했다.

```text
AppleSDGothicNeo-Bold       957 occurrences / visible 808
AppleSDGothicNeo-Regular    195 occurrences / visible 127
AppleSDGothicNeo-Medium       8 occurrences / visible 8
AppleSDGothicNeo-SemiBold    88 occurrences / visible 88
SFProDisplay-Bold            85 occurrences / visible 0
SFUIDisplay-Bold             64 occurrences / visible 0
```

각 layer의 `transform[4]`, `transform[5]`를 각각 exact origin X/Y 및
`PSD_POINT_TEXT_TRANSFORM_TRANSLATION` baseline model로 보존한다. 동일한 모든 source
metadata가 있을 때만 25개 typography token으로 deduplicate한다. **[DERIVED]**

기존 Spoqa Han Sans Bold/Regular OFL asset은 유지하지만 PSD source font와 동일하다고
주장하지 않는다. 따라서 `exactSourceFontIdentity=PASS`인 반면
`runtimeResolution=LICENSED_BUT_NOT_SOURCE_MATCH`이며 N2 pixel Golden의 runtime font
gate는 아직 BLOCKED다. **[PROJECT]**

### 33.4 Fixed component source resolution [DERIVED]

공식 PSD layer에서 다음 fixed component를 동결했다.

| Component | Source result | Asset/reference |
|---|---|---|
| `LANDING_ICON_COMPACT` | 160/200 same raw+trimmed digest, placement 694×65/85 | `assets/naver-smartchannel/landing-icon-compact.png` |
| `LANDING_ICON_280` | separate 56×59 source digest, placement 660×112 | `assets/naver-smartchannel/landing-icon-280.png` |
| `APP_CTA_160_200` | 11 source label layers + shared chevron, source custom-input guide preserved | `contracts/naver-smartchannel-cta-options.json` |
| `APP_CTA_280` | 11 source options, 48px visible button bounds, source rounded-rectangle metadata and shared chevron | `contracts/naver-smartchannel-cta-options.json` |

CTA option combinations are not generated. Each option keeps source template occurrences,
label text, button layer, chevron layer, source digest and exact metadata. `앱특가 보기` and
`앱 특가 보기` remain distinct source labels because the PSDs distinguish them. **[PROJECT]**

### 33.5 Special geometry [DERIVED_FROM_EXACT_SOURCE_METADATA]

- The three 160 `심의필만2줄` PSDs have exact headline baseline `64.45703125`, disclosure
  baselines `98.45703125` and `122.45703125`, and line gap `24px` for both left/right and
  landing-icon variants.
- The 200 compact landing icon has the same raw and trimmed pixel digest at both observed
  y=85 and y=86. There is no transform/effect-bound difference; the one-pixel discrepancy is
  classified as `PSD_AUTHORING_INCONSISTENCY`, not silently normalized.
- The current 280 thumbnail rule is frozen as 200×200 and does not use height scaling.

### 33.6 Deferred non-pixel blockers [PROJECT]

`260(최대)` is present as a guide-note family across source PSDs. Since it does not alter the
frozen placement coordinates, it is classified `GUIDE_NOTE_NOT_MACHINE_ENFORCEABLE`,
`n2Blocking=false`, and deferred to N3 Validator. The official 280 logo top/bottom 24px rule,
export `BG off + PNG` instruction, final registration byte/metadata semantics, and 750×200
placement availability are recorded as validation/placement metadata, not renderer behavior.

### 33.7 Version and runtime boundary [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.13.0 | 1.14.0 | source revision and source-backed resolution facts |
| Template Contract | 1.7.0 | 1.8.0 | metadata/fixed-component references and resolved source semantics |
| Integration Contract | 1.8.0 | 1.8.0 | no public integration meaning change |
| CreativeLayoutPlan | 1.0.0 | 1.0.0 | unchanged |
| Desktop | 0.8.2 | 0.8.2 | no SmartChannel UI/runtime |

N1C runtime remains `CONTRACT_ONLY`, with no SmartChannel `render()`, raster Golden, Desktop
selector, Preview, Download, upload, or network access. N2 readiness remains `false` solely
because the licensed Spoqa runtime assets are not an exact match to the source PSD fonts. **[PROJECT]**

### 33.8 N1C acceptance [PROJECT]

N1C acceptance requires official/local source hash-set equality, 120 template provenance,
metadata extraction, zero inferred font identity, fixed component source digests, exact 160
disclosure geometry, explicit 200 one-pixel classification, current 280 200×200 match,
non-blocking 260/export/placement deferrals, and unchanged Kakao/FREEFORM PNG/JPEG/fingerprint
regression. It does not claim Naver upload approval or advertising review compliance.

## 34. Phase N1D — SmartChannel runtime font policy [PROJECT]

### 34.1 Exact source font inventory [TOOL_OUTPUT] [DERIVED]

N1C PSD metadata의 distinct PostScript identity를 SmartChannel strict Template Locked의
완전한 required set으로 동결한다. `contracts/naver-smartchannel-runtime-font-policy.json`과
`contracts/naver-smartchannel-typography.json`이 machine-readable 기준이다.

| PostScript name | Style / weight | Source PSD count | Typography tokens | Korean | Latin | Numeric |
|---|---|---:|---:|:---:|:---:|:---:|
| `AppleSDGothicNeo-Bold` | Bold / 700 | 120 | 14 | true | true | true |
| `AppleSDGothicNeo-Medium` | Medium / 500 | 8 | 1 | true | false | false |
| `AppleSDGothicNeo-Regular` | Regular / 400 | 88 | 6 | true | true | true |
| `AppleSDGothicNeo-SemiBold` | SemiBold / 600 | 8 | 1 | true | false | false |
| `SFProDisplay-Bold` | Bold / 700 | 56 | 2 | false | true | false |
| `SFUIDisplay-Bold` | Bold / 700 | 64 | 1 | false | true | false |

이 표는 PSD layer metadata에서 추출한 값이며 aggregate `AppleSDGothicNeo-* / SF*`만으로
요구사항을 충족한 것으로 보지 않는다. **[TOOL_OUTPUT] [DERIVED]**

### 34.2 Runtime resolution matrix [DERIVED] [PROJECT]

허용 resolution class는 `EXACT_BUNDLED_LICENSED`, `EXACT_SYSTEM`,
`EXACT_EXTERNAL_LICENSED`, `LICENSED_BUT_NOT_SOURCE_MATCH`, `MISSING`이다.
현재 pinned Spoqa Bold/Regular은 각각 내부 PostScript `SpoqaHanSans-Bold`/
`SpoqaHanSans-Regular`, SHA-256 `5a6b9b...4eaef`/`1f56c8...b4b1`이므로 합법적인
Kakao/FREEFORM 자산이지만 source PSD identity와 다르다. 결과는 exact bundled 0,
exact system 0, exact external 0(계약상 지원), licensed-but-not-source-match 2,
missing 4이다. SmartChannel에 Spoqa alias, tracking/size 보정, glyph width 보정을
적용하지 않는다.

Windows 10/11 x64에서 관찰된 `%LOCALAPPDATA%/Microsoft/Windows/Fonts` 후보는 내부
PostScript가 `AppleSDGothicNeoB00` 등 source exact name과 다르고 provenance가
`UNRESOLVED`이므로 승인 자산이 아니다. 파일을 복제하거나 bundle하지 않는다. **[TOOL_OUTPUT]
[PROJECT]**

### 34.3 Apple distribution guard [OFFICIAL] [PROJECT]

Apple 공식 자료만으로 다음을 확인했다.

- [Apple Developer Fonts](https://developer.apple.com/fonts/index.html)는 Apple OS용
  소프트웨어 mockup 범위를 설명하고 비-Apple OS 사용·embed·재배포를 허용하는 근거로
  사용할 수 없다.
- [Apple macOS included fonts](https://support.apple.com/en-us/120414)와
  [Apple System Fonts](https://developer.apple.com/fonts/system-fonts/)는 Apple SD Gothic
  Neo를 Apple 플랫폼/macOS system font로 열거하지만 Windows redistributable 경로를
  제공하지 않는다.
- SF 자료는 [Apple Design Resources license](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf)
  및 Apple Developer Fonts 조건을 따르며, 이 프로젝트의 Windows bundle 권한을 확인하지
  못했다.

따라서 `apple_sd_gothic_neo`와 `sf` 모두 `officialWindowsRedistributablePath=NOT_FOUND`,
`bundlingAllowed=NOT_CONFIRMED`로 fail-closed한다. 이는 법률 자문이 아니며, 명시적
권한이 확인되지 않는 한 project bundle을 허용하지 않는 제품 정책이다. **[OFFICIAL] [PROJECT]**

### 34.4 Runtime Font Resolution Contract [PROJECT]

SmartChannel strict Template Locked는 `BUNDLED_EXACT`, `SYSTEM_EXACT`,
`EXTERNAL_EXACT`만 허용한다. `FALLBACK`은 계약상 금지하며 exact PostScript identity를
필수로 한다. 선택적 external resource는 trusted root 상대 경로, expected PostScript name,
approved SHA-256, source version(알려진 경우)을 받아 검증한다. network URL, remote fetch,
path traversal, symlink/reparse point 경유, arbitrary fallback, UI file picker는 금지한다.

Preflight 순서는 trusted path → file exists → font decode → PostScript exact → SHA-256 exact
→ declared version exact이며, 하나라도 실패하면 `renderStartAllowed=false`이고 다음 오류 중
하나를 결정적으로 반환한다.

| Code | 의미 |
|---|---|
| `NAVER_SMARTCHANNEL_FONT_UNAVAILABLE` | 파일 없음, 읽기/디코드 실패, trusted path 위반 |
| `NAVER_SMARTCHANNEL_FONT_IDENTITY_MISMATCH` | PostScript name 또는 SHA-256 불일치 |
| `NAVER_SMARTCHANNEL_FONT_VERSION_MISMATCH` | 선언된 font version 불일치 |

`contracts/naver-smartchannel-font-preflight.schema.json`은 이 report envelope를 검증한다.
N1D에서는 resolver/preflight만 추가하며 SmartChannel raster, Desktop UI, Golden PNG,
font download/install은 구현하지 않는다. **[PROJECT]**

### 34.5 N2 strategy and readiness [PROJECT] [INFERRED]

N2 Golden determinism과 source typography compliance를 분리한다. 동일 Windows x64
runtime/dependency/asset/input에서 3회 SHA-256 byte equality를 목표로 하되, Photoshop PNG
byte identity를 가정하지 않는다. representative render에서는 text origin, line break,
occupied bounds, baseline, fixed component alignment, canvas geometry를 source metadata와
비교한다. Exact runtime font가 해결되기 전에는 N2를 시작하지 않으며 `next_phase.ready=false`,
blocker=`runtime_font_exact_match_to_psd`를 유지한다. 해결 후보(권리자로부터 Windows exact
font 사용권 확보, exact font 설치 환경 한정 활성화, 공식 대체 font 확인)는 별도 제품 결정으로
남기며 임의 선택하지 않는다. 이 문단의 blocker 판정은 N1D.1 당시 상태이며 N1D.2의
project-compatible 판정으로 대체된다. **[PROJECT]**

### 34.6 N1D.1 Version and acceptance (historical) [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.14.0 | 1.15.0 | N1D runtime font policy and fail-closed preflight |
| Template Contract | 1.8.0 | 1.9.0 | additive SmartChannel font resolution semantics; coordinates unchanged |
| SmartChannel template registry/schema | 1.1.0 | 1.2.0 | runtime policy references and exact modes |
| SmartChannel typography registry | 1.1.0 | 1.2.0 | required source font inventory and runtime policy reference |
| Error Registry | 1.3.0 | 1.4.0 | three SmartChannel font preflight codes |
| Integration Contract | 1.8.0 | 1.8.0 | unchanged public Kakao/FREEFORM semantics |
| Desktop | 0.8.2 | 0.8.2 | no SmartChannel UI/runtime |

N1D acceptance는 six-font inventory completeness, 25-token identity mapping, Spoqa mismatch
검출, fallback 금지, wrong PostScript/digest/version/missing/path rejection, Kakao/FREEFORM
registry and fingerprint regression을 포함한다. N1D phase는 policy/tests가 PASS이면
완료되지만 N2는 exact runtime font blocker가 해소될 때까지 준비되지 않는다. **[PROJECT]**

### 34.7 N1D.1 local external font adoption and SF audit [TOOL_OUTPUT] [PROJECT]

사용자 지정 [fonts-archive/AppleSDGothicNeo 저장소](https://github.com/fonts-archive/AppleSDGothicNeo)의
main branch TTF 네 개를 `.local-fonts/naver-smartchannel/`에만 내려받았다. 이 디렉터리는
`.gitignore` 대상이며 binary는 commit/bundle하지 않는다. 저장소가 재배포 라이선스를
제공한다고 주장하지 않고, runtime에서는 `NAVER_SMARTCHANNEL_FONT_DIR`로 지정되는
사용자 제공 local external resource로만 취급한다. runtime network fetch는 계속 금지한다.

파일명과 실제 font table을 분리해 검증한 결과는 다음과 같다.

| File | Bytes | Actual PostScript | Actual version | Weight class | Result |
|---|---:|---|---|---:|---|
| `AppleSDGothicNeo-Bold.ttf` | 3,817,104 | `AppleSDGothicNeoB00` | `Version 1.0` | 400 | `IDENTITY_MISMATCH` |
| `AppleSDGothicNeo-Medium.ttf` | 3,791,636 | `AppleSDGothicNeoM00` | `Version 1.0` | 400 | `IDENTITY_MISMATCH` |
| `AppleSDGothicNeo-Regular.ttf` | 3,853,124 | `AppleSDGothicNeoR00` | `Version 1.0` | 400 | `IDENTITY_MISMATCH` |
| `AppleSDGothicNeo-SemiBold.ttf` | 3,705,352 | `AppleSDGothicNeoSB00` | `Version 1.0` | 400 | `IDENTITY_MISMATCH` |

따라서 이 파일들은 exact source font로 승인하지 않고, `approvedForSmartChannel=false`로
기록한다. `contracts/naver-smartchannel-runtime-font-policy.json`에는 실제 SHA-256과
identity 결과를 기록하되 binary 자체는 저장하지 않는다. **[TOOL_OUTPUT] [PROJECT]**

SF layer 전수 감사 결과 `SFProDisplay-Bold` 85개와 `SFUIDisplay-Bold` 64개는 모두
`TEXT` 계열 parent group의 `HEADLINE` role이며, guide/instruction group이 아니고
기본 보기에서는 hidden인 source-selectable English text variants다. 그러므로 둘 다
`EXPORT_RENDERED_TEXT`로 분류하고 runtime required source inventory에서 제거하지 않는다.
`sourceOnlyNonRuntime=[]`, `SF_EXACT_RUNTIME_REQUIRED`, N2 blocker 유지가 확정값이다.
감사 원본은 `contracts/naver-smartchannel-sf-font-audit.json`이다. **[TOOL_OUTPUT] [DERIVED]**

N1D.1은 문서/Template geometry/Integration/Desktop version을 변경하지 않고 runtime font
policy registry만 1.0.0에서 1.1.0으로 확장했던 historical freeze다. 당시의
`next_phase.ready=false`와 `SF_EXACT_RUNTIME_REQUIRED` 판정은 N1D.2 effective audit 및
project-compatible registry로 supersede되며, SmartChannel renderer, Golden PNG, Desktop UI,
font installer는 계속 구현하지 않는다. **[PROJECT]**

### 34.8 N1D.2 project-compatible font resolution and effective SF audit [PROJECT] [DERIVED] [TOOL_OUTPUT]

N1D.1의 `PSD PostScript == runtime PostScript` 단일 조건을 폐기한다. source identity와
runtime compatibility를 별도 상태로 기록한다.

```yaml
SourceIdentityStatus:
  - SOURCE_EXACT
  - SOURCE_DIFFERENT_BUILD
RuntimeCompatibilityStatus:
  - PROJECT_COMPATIBLE_VERIFIED
  - PROJECT_COMPATIBLE_UNVERIFIED
  - INCOMPATIBLE
N2Allow:
  - SOURCE_EXACT
  - SOURCE_DIFFERENT_BUILD + PROJECT_COMPATIBLE_VERIFIED
```

archive TTF 네 개는 source exact라고 주장하지 않는다. 각각의 controlled alias는
`contracts/naver-smartchannel-font-compatibility.json`에 `fontToken`, source expected
PostScript, runtime local PostScript, SHA-256, 실제 name/OS/2/head/hhea/hmtx/cmap/glyf
관찰값을 함께 기록한다. runtime lookup key는 source PostScript가 아니라 `fontToken`이다.
파일은 `.local-fonts/naver-smartchannel/`에만 존재하며 commit/bundle/network fetch는 금지한다.

필수 glyph coverage는 120 PSD metadata 전체 text layer에서 수집한 135개 renderable
Unicode code point를 대상으로 한다. 네 파일 모두 glyph mapping과 non-invalid outline을
제공한다. 네 파일의 file/glyf/hmtx digest는 서로 다르며 style role separation을 통과한다.
`contracts/naver-smartchannel-font-metric-fixtures.json`은 160 headline/subcopy/disclosure,
200 headline/subcopy/CTA fixed component, 280 headline/subcopy/CTA, 280 disclosure
대표 fixture를 고정하고 advance width, ink occupied width, ascent/descent, line box,
overflow를 기록한다. 네 fixture 모두 overflow 0이다. 이 검증은 Photoshop byte/pixel
parity를 주장하지 않으며 source layout metadata 보존과 deterministic overflow-free
typography만 의미한다. **[TOOL_OUTPUT] [DERIVED] [PROJECT]**

SF audit는 layer visibility, ancestor visibility, layer-comp visibility, clipping-base
visibility를 결합한 effective visibility와 실제 composite contribution을 계산한다.
`SFProDisplay-Bold` 85개와 `SFUIDisplay-Bold` 64개는 모두 hidden source text이며
composite contribution은 0이다. 분류는 둘 다 `HIDDEN_SOURCE_TEXT`,
`runtimeDecision=SF_SOURCE_ONLY_NON_RUNTIME`, `exportContributingFonts=[]`로 고정한다.
PSD provenance는 유지하지만 runtime required font set에서는 제외한다. **[TOOL_OUTPUT]
[DERIVED] [PROJECT]**

따라서 N1D.2의 runtime mode는 `PROJECT_COMPATIBLE_VERIFIED`, N2 readiness는 `true`다.
이는 SmartChannel renderer/UI/Golden PNG 구현이나 네이버 업로드 승인 주장이 아니다. **[PROJECT]**

### 34.9 N1D.2 version and acceptance [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.15.0 | 1.16.0 | source/runtime font compatibility split and effective SF composite audit |
| Template Contract | 1.9.0 | 1.9.0 | global geometry/template version unchanged |
| SmartChannel template registry/schema | 1.2.0 | 1.3.0 | controlled alias lookup, compatibility registry, N2 readiness |
| SmartChannel typography registry | 1.2.0 | 1.3.0 | project-compatible runtime tokens and source-only SF inventory |
| Runtime font policy | 1.1.0 | 1.2.0 | local digest allowlist and compatibility preflight semantics |
| SF audit registry | 1.0.0 | 1.1.0 | effective visibility and composite contribution classification |
| Font preflight schema | 1.0.0 | 1.1.0 | additive source/runtime identity fields |
| Integration Contract | 1.8.0 | 1.8.0 | unchanged public Kakao/FREEFORM semantics |
| Desktop | 0.8.2 | 0.8.2 | no SmartChannel UI/runtime |

N1D.2 acceptance는 controlled alias 4종, local SHA allowlist, glyph coverage, distinct style
data, representative metric fixture overflow 0, wrong alias/digest/fallback rejection,
effective SF visibility/contribution audit, N2 readiness, Kakao/FREEFORM fingerprints와
120-template mapping 불변을 포함한다. **[PROJECT]**

## 35. Phase N2A — NAVER SmartChannel Object Placement Contract [PROJECT]

### 35.1 범위와 근거

N2A는 SmartChannel 공식 PSD 120종의 object layer/group 구조를 object placement
machine-readable contract로 옮긴다. Renderer, raster output, Golden PNG, Desktop UI,
preview, download은 이 Phase에서 구현하지 않는다. Kakao 또는 FREEFORM placement 의미를
상속하지 않으며, PSD sample raster의 alpha bounds를 runtime 자동 crop/trim 규칙으로
사용하지 않는다. **[PROJECT]**

공식 SmartChannel 제작 가이드는 DA 이미지 배너의 오브젝트/카피 구성과 PSD 제작 자료를
제공한다. [NAVER SmartChannel 제작 가이드](https://ads.naver.com/adguide/1475)는 2026-05-22
업데이트 자료이며, 최신 공지에서 750×280 thumbnail UI가 200×200으로 변경되고
160/200 가이드는 유지됨을 확인했다. [2026-06-01 SmartChannel 공지](https://ads.naver.com/notice/31978),
[750×280 추가 공지](https://ads.naver.com/notice/22349)는 공식 출처의 현재 규칙 확인에만
사용한다. 공식 가이드가 upload 승인 또는 본 Renderer의 runtime 동작을 보장한다는
의미는 아니다. **[OFFICIAL] [PROJECT]**

외부 source root `SMARTCHANNEL_GUIDE 12/`의 120 PSD는 `psd-tools==1.18.0`으로 전수
검사했다. source SHA와 canvas header는 N1 source revision registry가 보존하며, 이번
registry에는 OS 절대 경로를 저장하지 않는다. **[TOOL_OUTPUT] [DERIVED]**

### 35.2 Coordinate model 및 공통 금지 규칙

허용 coordinate model은 `FULL_CANVAS_SOURCE`, `SLOT_LOCAL_SOURCE`,
`TRIMMED_OBJECT_SOURCE`, `SMART_OBJECT_FRAME_SOURCE`, `UNRESOLVED`다. 실제 source가
증명한 경우만 fit mode를 고정한다. `anchor`는 source transform 또는 guide frame에
의존하므로 `SOURCE_DEFINED`로 고정하며, 임의의 `CENTER_CONTAIN`, `COVER`, alpha-trim
anchor를 추가하지 않는다. **[PROJECT] [DERIVED]**

| Source 계열 | PSD 증거 | Frozen model | fit | clip/mask |
|---|---|---|---|---|
| `STANDARD` (BASIC/BOTTOM_DISCLOSURE) | absolute-canvas PixelLayer, vector mask/clipping 없음 | `FULL_CANVAS_SOURCE` pre-composed input | `NONE` | `NO_CLIP` |
| `THUMBNAIL` | ShapeLayer vector mask + clipping sample PixelLayer | `SLOT_LOCAL_SOURCE` fixed frame | `FIXED_FRAME` | `SOURCE_MASK` |
| `PERSON_MOVIE` 160 | positioned PixelLayer, Smart Object/clip 없음 | `FULL_CANVAS_SOURCE` pre-composed input | `NONE` | `NO_CLIP` |
| `PERSON_MOVIE` 200/280 | SmartObjectLayer `PLACED_LAYER2` transform 및 source frame | `SMART_OBJECT_FRAME_SOURCE` | `SOURCE_TRANSFORM` | `NO_CLIP` |

모든 계열에서 preprocessing, auto trim, auto crop, semantic focal crop, background
removal, auto padding, auto resize, 좌/우 mirror generation은 금지한다. source가
불명확한 값은 `UNRESOLVED`로 남기고 runtime 시작을 허용하지 않는다. **[PROJECT]**

### 35.3 THUMBNAIL source mask

PSD vector path의 normalized canvas bbox와 path digest를
`contracts/naver-smartchannel-object-placement.json`의 `maskGeometry`에 보존한다.
Nominal frame은 source guide와 vector mask에서 읽은 값이며, height를 배율로 일반화하지
않는다.

| Height | LEFT frame | RIGHT frame | source mask |
|---:|---|---|---|
| 160 | `(40,15,195,130)` | `(515,15,195,130)` | rounded vector path |
| 200 | `(40,30,210,140)` | `(500,30,210,140)` | rounded vector path |
| 280 | `(40,40,200,200)` | `(510,40,200,200)` | rounded vector path |

280 thumbnail의 200×200은 현재 공식 source/guide 규칙과 일치한다. 200B 우측 source는
2줄 PSD에서만 sub-pixel path coordinate가 달라지므로 두 digest를 모두 registry에
기록하고 하나를 다른 하나로 mirror하거나 임의 tolerance로 합치지 않는다. **[TOOL_OUTPUT]
[DERIVED] [OFFICIAL]**

### 35.4 PERSON_MOVIE source transform

200 PSD의 Smart Object frame은 source size `272×234`이며 LEFT/RIGHT canvas transform은
각각 `(44,13)-(316,247)` 및 `(434,13)-(706,247)`이다. 280 PSD의 Smart Object frame은
source size `425×370`이며 `PLACED_LAYER2` transform은 좌/우 각각 다음과 같다.

```yaml
PERSON_MOVIE_280_LEFT:
  transform: [40.8123423758, 22.7944022616, 337.8848487648, 22.7944022616,
              337.8848487648, 281.4222313532, 40.8123423758, 281.4222313532]
PERSON_MOVIE_280_RIGHT:
  transform: [410.8123423758, 22.7944022616, 707.8848487648, 22.7944022616,
              707.8848487648, 281.4222313532, 410.8123423758, 281.4222313532]
```

이 값은 source Smart Object frame/transform을 보존한 것이며, runtime에서 입력 이미지를
재설계하는 fit 규칙이 아니다. 160 PERSON_MOVIE는 Smart Object가 아니므로 같은
transform을 추정하지 않고 별도 pre-composed canvas token을 사용한다. **[TOOL_OUTPUT]
[DERIVED] [PROJECT]**

### 35.5 Placement token 및 template mapping

`contracts/naver-smartchannel-object-placement.json`은 39개의 deterministic token과
120개의 `templateId → objectPlacementToken` mapping을 제공한다. SmartChannel template
registry/schema는 additive `objectPlacementToken`, placement registry/schema reference,
`SOURCE_RESOLVED_PROJECT_CONTRACT` 상태를 요구한다. 대표 N2 후보 6종은 모두 resolved
token을 가진다.

| Candidate | token |
|---|---|
| 160 BASIC STANDARD LEFT MAIN_SUB NONE | `NAVER_SC_160_BASIC_STANDARD_LEFT_NONE` |
| 200 EMPHASIS THUMBNAIL RIGHT THREE_LINE NONE | `NAVER_SC_200_EMPHASIS_THUMBNAIL_RIGHT_NONE` |
| 280 BASIC STANDARD LEFT ONE_LINE LANDING_ICON | `NAVER_SC_280_BASIC_STANDARD_LEFT_LANDING_ICON` |
| 280 EMPHASIS THUMBNAIL LEFT THREE_LINE APP_CTA | `NAVER_SC_280_EMPHASIS_THUMBNAIL_LEFT_APP_CTA` |
| 280 EMPHASIS PERSON_MOVIE RIGHT FOUR_LINE NONE | `NAVER_SC_280_EMPHASIS_PERSON_MOVIE_RIGHT_NONE` |
| 280 BOTTOM_DISCLOSURE STANDARD LEFT MAIN2_DISCLOSURE_2LINE NONE | `NAVER_SC_280_BOTTOM_DISCLOSURE_STANDARD_LEFT_NONE` |

좌/우 token은 별도로 등록한다. source가 동일한 object layer structure를 보이는
affordance variant는 object placement token을 공유하지만, CTA/landing icon asset 자체의
승인 여부나 runtime 구현을 이 계약에서 추가하지 않는다. **[DERIVED] [PROJECT]**

### 35.6 Source asset input boundary

`STANDARD` 및 160 `PERSON_MOVIE`는 exact template canvas PNG를 1:1로 받는 pre-composed
project input contract다. `THUMBNAIL`은 exact source mask frame의 PNG/JPEG를 받고,
`PERSON_MOVIE` 200/280은 exact PSD Smart Object frame source를 받는다. 모두 trim/crop/
resize는 금지되며 file-size 판정은 기존 channel validator에 위임한다. 이 입력 경계는
네이버 upload API 규칙의 주장이 아니라 source layer 구조에서 도출한 본 프로젝트의
deterministic runtime boundary다. **[DERIVED] [PROJECT]**

### 35.7 N2A version and acceptance

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.16.0 | 1.17.0 | source-backed object coordinate/mask/transform contract |
| Global Kakao/FREEFORM template contract | 1.9.0 | 1.9.0 | public core renderer semantics unchanged |
| SmartChannel-scoped template contract | 1.9.0 | 1.10.0 | additive `objectPlacementToken` and placement references |
| SmartChannel template registry/schema | 1.3.0 | 1.4.0 | placement reference and per-template token |
| Object placement registry | NEW | 1.0.0 | initial source-backed placement contract |
| Integration Contract | 1.8.0 | 1.8.0 | unchanged |
| Desktop | 0.8.2 | 0.8.2 | no SmartChannel UI/runtime |

`templateContractVersion` 좌표는 변경하지 않는다. Kakao/FREEFORM core의 1.9.0과
SmartChannel-scoped 1.10.0은 namespace가 다르므로 혼용하지 않는다. OBJECT region/text
region/CTA/font fingerprints는 source coordinates를 변경하지 않고 보존한다.
N2A acceptance는 39 token, 120 mapping, candidate unresolved 0, source mask/transform
provenance, no inherited placement semantics, no auto-design rule, no renderer/UI/Golden
artifact를 포함한다. **[PROJECT]**

### 35.8 N2 runtime implementation boundary (historical)

N2는 `NAVER_GFA + SMARTCHANNEL`의 registry-driven Core renderer를 추가했고, 당시에는
`contracts/naver-smartchannel-n2-candidates.json`의 정확한 6개 조합만 runtime-enable했다.
이 제한은 N3에서 source whitelist 전체를 활성화하면서 역사적 상태가 되었다. 알 수 없는
template은 현재도 별도 `UNKNOWN` 오류로 차단한다. **[PROJECT]**

runtime은 N2A placement token, source asset rule, PSD text metadata, typography registry,
fixed component/CTA registry를 조회한다. STANDARD/PERSON_MOVIE full-canvas source와
THUMBNAIL slot-local source는 contract의 exact dimensions/MIME만 허용하고 trim/crop/resize,
mirror, auto-fit, fallback을 수행하지 않는다. 출력은 750×160/200/280 transparent RGBA
PNG이며, N2 acceptance용 synthetic fixture와 3회 반복 byte-equal golden을 저장한다.
이는 NAVER 업로드 승인 또는 Photoshop byte parity 주장이 아니다. **[PROJECT]**

CTA registry는 280px 공유 chevron의 검증된 asset 경로와 digest를 추가하기 위해
1.0.0에서 1.1.0으로 minor bump한다. 기존 CTA geometry와 허용 조합은 변경하지 않는다. **[PROJECT]**

N2 runtime font mode는 `PROJECT_COMPATIBLE_VERIFIED`이며 local exact preflight가 통과하지
않으면 fail-closed한다. SFPro/SFUI source-only layer는 runtime font가 아니며, local font
binary는 Git/release에 포함하지 않는다. Runtime network access는 계속 금지된다.
Desktop NAVER UI와 120-template full expansion은 당시 N2 이후 범위였다. **[PROJECT]**

### 35.9 Phase N3 — SmartChannel 120-variant runtime expansion

N3는 새 좌표나 새 추론 규칙을 추가하지 않고, 이미 source-confirmed 상태인
`contracts/naver-smartchannel-template-contract.json`의 120개 `templateId`를 모두 Core
runtime whitelist로 활성화한다. 템플릿 수와 family별 분포는 다음과 같이 고정한다.

| Height | BASIC | EMPHASIS | BOTTOM_DISCLOSURE | Total |
|---:|---:|---:|---:|---:|
| 160 | 8 | 15 | 9 | 32 |
| 200 | 8 | 15 | 9 | 32 |
| 280 | 16 | 25 | 15 | 56 |
| **Total** | **32** | **55** | **33** | **120** |

39개 object placement token과 120개 `templateId → objectPlacementToken` mapping은 변경하지
않는다. 각 template은 source registry, PSD visible text-layer metadata, typography token,
fixed-component/CTA registry의 참조가 모두 해석될 때만 실행된다. registry에 없는 조합,
알 수 없는 `templateId`, 또는 선택한 template의 source metadata가 요구하지 않는 content
field는 deterministic `ERROR`로 거부한다. Renderer는 family·side·textVariant를 보고
좌표를 추론하거나 후보 전용 예외를 만들지 않는다. **[PROJECT] [DERIVED]**

160/200 `LANDING_ICON`은 승인된 compact icon asset을 height별 placement로 합성한다.
280 `LANDING_ICON`은 승인된 280 icon asset을 사용한다. 160/200 `APP_CTA`는 CTA registry의
11개 전체 RGBA raster label asset 중 입력된 label 하나를 그대로 합성하며, 280 `APP_CTA`는
정확한 source occurrence의 button, chevron, CTA label typography layer를 함께 사용한다.
허용 label 목록, asset path, asset SHA-256, source occurrence가 없는 값은 거부한다.
**[PROJECT] [TOOL_OUTPUT]**

`headline`, `headlineLine2`, `subcopy`, `subcopyLine4`, `disclosureLine1`,
`disclosureLine2`는 PSD visible role의 실제 multiplicity에 따라 요구한다. 280 CTA label은
source PSD에 있는 선택 label layer를 사용하고, compact CTA는 이미 rasterized된 승인 asset을
사용하므로 CTA text를 두 번 그리지 않는다. `ctaOption`은 `APP_CTA`에서만 허용한다.
**[PROJECT] [DERIVED]**

N3 exhaustive acceptance는 다음을 요구한다.

1. 120개 템플릿을 동일 Windows 10/11 x64 runtime에서 deterministic synthetic input으로
   각각 렌더링하고, 각 입력을 3회 실행해 PNG SHA-256이 byte-equal이어야 한다.
2. 160/200 compact 및 280 CTA 각각에 대해 registry의 11개 label을 모두 실행한다.
3. 120개 모두 `PASS`, text overflow 0, missing fixed component 0, font fallback 0이어야
   하며 output은 750×160/200/280의 RGBA PNG-32여야 한다.
4. N2의 영구 Golden 6개는 PNG byte, pixel fingerprint, request fingerprint가 변경되지
   않아야 한다.

N3는 Desktop UI, Naver Freeform, Platform-composed/Collection, upload API, network access,
remote font, 새 CTA/icon 제작을 포함하지 않는다. 공식 [SmartChannel 광고가이드](https://ads.naver.com/adguide/1475)와
[2026-06-01 공지](https://ads.naver.com/notice/31978)는 현재 source guide 및 750×280/200×200
규칙을 확인하는 근거일 뿐이며, Renderer의 upload 승인이나 Photoshop byte parity를
보장하지 않는다. **[OFFICIAL] [PROJECT]**

### 35.10 N3 version and acceptance

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.17.0 | 1.18.0 | source whitelist 120개 전체 runtime capability 상태 반영 |
| Global Kakao/FREEFORM template contract | 1.9.0 | 1.9.0 | coordinates and legacy renderer semantics unchanged |
| SmartChannel-scoped template contract | 1.10.0 | 1.10.0 | geometry and placement tokens unchanged |
| Renderer Core | 0.5.0 | 0.6.0 | full 120-template registry execution, CTA/fixed component expansion, exhaustive deterministic gate |
| CTA registry | 1.1.0 | 1.1.0 | existing 11-label source registry reused |
| Integration Contract | 1.8.0 | 1.8.0 | no public integration shape change |
| Desktop | 0.8.2 | 0.8.2 | no Desktop SmartChannel UI |

N3 acceptance는 source inventory 120, placement token 39, template mapping 120, affordance
분포 `NONE=75`, `LANDING_ICON=29`, `APP_CTA=16`, compact/280 CTA label 11개, local
project-compatible font preflight, runtime network prohibition, N2 golden immutability를
기계적으로 검사한다. 다음 단계는 Naver Freeform constrained format expansion이다.
**[PROJECT]**

## 36. Phase N4 — NAVER FREEFORM constrained format expansion [PROJECT] [OFFICIAL]

N4는 새 `LayoutMode`를 만들지 않는다. 기존 `LayoutMode = TEMPLATE_LOCKED | FREEFORM`을
유지하고, `NAVER_GFA`의 정적 이미지 배너는 `layoutMode: FREEFORM`,
`compositionMode: RENDERER_COMPOSED`, `artifactCardinality: SINGLE`인 additive
`FormatProfile`로 표현한다. Canvas의 소유자는 계속 FormatProfile이며
`CreativeLayoutPlan`은 Canvas 필드를 갖지 않는다. **[PROJECT]**

### 36.1 Official source revision [OFFICIAL] [TOOL_OUTPUT]

공식 페이지와 다운로드 상세 가이드는 다음 registry에 기록한다.
`contracts/naver-freeform-source-revision.json`. Runtime은 이 파일의 URL을 호출하지
않고, 연구/build 단계에서만 확인한 source evidence를 사용한다. **[PROJECT]**

| Profile | Official page | Page update | Download attachment | Attachment status |
|---|---|---:|---|---|
| `NAVER_MOBILE_DA` | [모바일 DA](https://ads.naver.com/adguide/1474) | 2025-04-08 | `Image_M_DA_total_PF.pdf` | INSPECTED |
| `NAVER_IMAGE_BANNER_1_1` | [이미지 배너형 1:1](https://ads.naver.com/adguide/1473) | 2023-12-20 | `Webtoon_BigBanner_Guide_231220.pdf` | INSPECTED |
| `MOBILE_DA_FEED` boundary | [모바일 DA 피드](https://ads.naver.com/adguide/1480) | 2026-04-15 | `FEED_AD_GUIDE.pdf` | INSPECTED |

SAFE AREA와 최소/최대 용량의 현재 플랫폼 적용 공지는 [모바일DA 여백 및 최소 용량
공지](https://ads.naver.com/notice/18556)다. 다운로드 URL, SHA-256, 페이지 수 및
source classification은 source revision registry를 따른다. **[OFFICIAL] [TOOL_OUTPUT]**

### 36.2 Mobile DA profile [OFFICIAL] [PROJECT]

`NAVER_MOBILE_DA`는 `1250×560`, `PNG/JPEG`, decimal byte `50000 ≤ bytes ≤ 250000`,
완전 불투명 output을 요구한다. 공식 첨부에서 확인된 text/logo/button safe area는
`x=240..1010`, `y=50..525`이며 main object safe area는 `x=225..1025`다.
Validator는 `alpha >= 8` 실제 raster bounds를 검사하고, Renderer는 입력 Plan의
위치·크기·crop을 자동 변경하지 않는다. **[OFFICIAL] [DERIVED]**

첨부에서 확인된 machine-enforceable text 값은 최대 52px, 최소 실제 raster 높이 22px,
최대 4줄, declared text style 색상 최대 3개다. anti-aliasing 픽셀 색상은 색상 수에
포함하지 않는다. 흰색 배경 면적 50% 미만 규칙은 정확한 계산 알고리즘이 동결되지
않았으므로 `NON_MACHINE_ENFORCEABLE` WARNING metadata로만 보존한다. **[OFFICIAL] [PROJECT]**

투명 픽셀 금지는 실제 최종 artifact alpha로 검사한다. PNG 자체는 허용 MIME이므로
opaque PNG는 PASS이고, transparent PNG는 ERROR다. **[OFFICIAL] [PROJECT]**

### 36.3 Image Banner 1:1 profile [OFFICIAL] [PROJECT]

`NAVER_IMAGE_BANNER_1_1`은 `1200×1200`, `PNG/JPEG`, decimal byte
`80000 ≤ bytes ≤ 800000`, PC/Mobile 공용 단일 artifact다. 상세 가이드의 title/subcopy/
disclaimer 최소값 `32pt/16pt/14pt`는 pt 단위 그대로 registry에 기록하며 px로 환산하지
않는다. transparency와 gradient/white-area의 exact machine algorithm은 source에서
확정되지 않았으므로 `UNRESOLVED` 또는 `NON_MACHINE_ENFORCEABLE` metadata로 둔다.
**[OFFICIAL] [PROJECT]**

### 36.4 Validator and deterministic encoding [PROJECT] [DERIVED]

PRE_RENDER는 profile 존재, FREEFORM mode, profile Canvas, allowed element type, font,
requested MIME, source-backed text bounds를 검사한다. POST_RENDER는 decode, exact
dimensions, actual alpha, actual bytes, actual text raster bounds, safe area, checksum 및
fingerprint를 검사한다. Safe area 오류가 있어도 Renderer는 auto reposition/scale/shrink/
crop하지 않는다. **[PROJECT]**

기존 deterministic PNG/JPEG encoder와 JPEG quality ladder를 재사용한다. 최소 용량을
맞추기 위해 padding/noise/hidden data를 추가하지 않는다. `pixelFingerprint`에는 profile
ID/version, Canvas, pixel-affecting plan, asset/font digest, encoding parameters만 포함하고
compliance-only metadata는 제외한다. 기존 artifact checksum/pixel/request fingerprint
triad와 Kakao/SmartChannel fingerprint는 변경하지 않는다. **[PROJECT] [DERIVED]**

### 36.5 Feed boundary [OFFICIAL] [PROJECT]

현재 Feed source는 IMAGE/VIDEO/COLLECTION을 설명하지만 outer wrapper는
`PLATFORM_COMPOSED`다. N4는 wrapper를 rasterize하지 않는다. Feed single-image source
profile은 `CATALOG_ONLY`, collection은 N6까지 runtime 제외, video는 static renderer
범위 밖으로 기록한다. 다음 대상은 N5 `NAVER_PLATFORM_COMPOSED_SOURCE_CONTRACT`다.
**[OFFICIAL] [PROJECT]**

### 36.6 Version and acceptance boundary [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.18.0 | 1.19.0 | source-confirmed Naver FREEFORM profiles and compliance boundary |
| Global template contract | 1.9.0 | 1.9.0 | coordinates and legacy semantics unchanged |
| FREEFORM FormatProfile registry | 1.1.0 | 1.2.0 | additive Naver profiles and source-backed constraints |
| Renderer Core | 0.6.0 | 0.7.0 | existing FREEFORM Core dispatch/validation for two Naver profiles |
| Integration Contract | 1.8.0 | 1.8.0 | generic FREEFORM plan remains sufficient |
| CreativeLayoutPlan | 1.0.0 | 1.0.0 | schema unchanged |
| Desktop | 0.8.2 | 0.8.2 | Naver selector/UI remains unimplemented |

Representative goldens are one Mobile DA JPEG and one 1:1 PNG. Each is rendered three
times on Windows 10/11 x64 and must be byte-equal. Existing Kakao goldens, six N2 goldens,
N3 120-template exhaustive checks, PNG/JPEG tests, legacy serialization and fingerprints
remain regression gates. **[PROJECT]**

## 37. Phase N5 — NAVER PLATFORM_COMPOSED source contract [PROJECT] [OFFICIAL]

N5는 NAVER GFA의 플랫폼 조합형 입력(SourceSpec)을 동결한다. 이 단계의 산출물은
최종 native/feed UI 또는 최종 PNG가 아니다. SourceSpec은 광고주가 제공하는 원문 카피,
플랫폼 필드, 원본 자산 메타데이터와 출처를 검증하고, 최종 프레젠테이션과 픽셀 좌표의
소유자를 NAVER 플랫폼으로 남긴다. `PLATFORM_COMPOSED`는 기존
`LayoutMode = TEMPLATE_LOCKED | FREEFORM` 축과 직교하며 새 LayoutMode를 추가하지
않는다. **[PROJECT]**

### 37.1 Official source revision and attachment provenance [OFFICIAL] [TOOL_OUTPUT]

공식 페이지와 페이지에서 연결된 PDF를 실제로 다운로드·검사했다. Runtime은 아래 URL을
호출하지 않으며, 저장된 PDF와 registry가 build/review 시점의 provenance다.
`contracts/naver-platform-composed-source-revision.json`에 페이지 갱신일, 첨부 파일명,
SHA-256, 바이트 수, 페이지 수, PDF 인쇄 갱신일을 함께 기록한다. **[PROJECT]**

| Placement | Official page | Page update | Attachment | SHA-256 | Pages | Printed PDF update |
|---|---|---:|---|---|---:|---:|
| `MOBILE_NATIVE` | https://ads.naver.com/adguide/1479 | 2026-02-24 | `Native_M_DA_total_PF.pdf` | `e4c944b2153d56692d57a2951715dd108136dbf8aaaea204254f2466cb45f738` | 13 | 2026-02-24 |
| `PC_NATIVE` | https://ads.naver.com/adguide/1478 | 2026-01-07 | `Native_P_DA_total_PF.pdf` | `f9453631e223cf00a3e99f8b28b5aa68b0c6d55e4315e060aac30c94f504dd75` | 28 | 2026-04-06 |
| `SHOPPING_NEWS` | https://ads.naver.com/adguide/1477 | 2025-09-09 | `shoppinginformAD.pdf` | `29aedba675ad2dbec3e3fc40ff5937016bae58faecbb91f2d6d65fcc7bc75d6c` | 12 | 2025-09-08 |
| `COMMUNICATION_AD` | https://ads.naver.com/adguide/1476 | 2023-04-25 | `naver_communication_ad.pdf` | `8e58032444e1cfd6ddd1cfa1b32f5ee901133f30ff9ecacc3883ae32bfe6b616` | 3 | 2023-08-01 |
| `MOBILE_DA_FEED` | https://ads.naver.com/adguide/1480 | 2026-04-15 | `FEED_AD_GUIDE.pdf` | `0e45fdf9dda180551dde06bdef91e726f86823a405e62e00232db7ba407170ef` | 20 | 2026-04-15 |

페이지 갱신일과 PDF 내부 인쇄 갱신일이 다른 세 출처(PC Native, Shopping News,
Communication Ad)는 둘 다 보존한다. 어느 날짜가 더 최신이라는 추론으로 값을 덮어쓰지
않는다. **[TOOL_OUTPUT] [INFERRED]**

### 37.2 SourceSpec boundary and deterministic validation [PROJECT]

공개 SourceSpec은 `schemaVersion: "1.0.0"`, `channel: "NAVER_GFA"`,
`compositionMode: "PLATFORM_COMPOSED"`, 배치, `artifactCardinality`,
`sourceProfileId`, `fields`, `assets`를 가진다. JSON Schema는 unknown top-level field를
거부하며 `finalCanvas`, `finalCoordinates`, `finalUi`, `pixelFingerprint`를 거부한다.
검증기는 다음만 수행한다.

1. Schema/identity/profile/cardinality 검증
2. 출처가 제공한 필드 타입·문자 수·허용 enum 검증
3. MIME, source pixel dimensions, aspect ratio, decimal byte 범위, 명시된 alpha 규칙 검증
4. collection item count(4–10) 검증
5. NFC normalization과 결정적 오류 정렬

검증기는 텍스트를 trim·축약·줄바꿈하지 않고 CTA를 선택하지 않는다. 결과에는
`finalUiRendered: false`, `pixelFingerprint: null`을 항상 반환한다. Runtime이 아직
구현되지 않은 profile은 source validation이 성공해도
`KBR-NAVER-SOURCE-RUNTIME-DEFERRED` WARNING을 낸다. **[PROJECT]**

### 37.3 Placement source profiles [OFFICIAL] [PROJECT]

`contracts/naver-platform-composed-source-profiles.json`의 9개 profile이 아래 다섯
placement를 표현한다. 최종 UI의 카드·목록·버튼·신고/뮤트·프로필 배치는 모두
`finalPresentationOwner: NAVER_PLATFORM`이다.

| Placement/profile | Frozen source fields and assets | Final UI / runtime |
|---|---|---|
| `MOBILE_NATIVE` | Native thumbnail `342×228`, profile `300×300`, JPEG/PNG; advertiser name 14, headline 20, description up to 3×12 (36 total), profile name 14, disclosure 45, source landing-label registry | Platform-owned; source contract only |
| `PC_NATIVE` | Native thumbnail/profile dimensions and MIME; headline 20, short description 12, PC long description 28, advertiser/profile/disclosure boundaries | Platform-owned; side/placement UI varies by platform |
| `SHOPPING_NEWS` | Ad image `750×500`, JPEG/PNG, 20,000–500,000 bytes; profile name 19, ad description ≤57 and ≤3 lines; notification state, benefit icon, promotion icon, landing labels | Subscription state controls platform variant; source contract only |
| `COMMUNICATION_AD` LIST | Ad image `112×112`, copy ≤40 (recommended 33, ≤2 lines), profile name 14, disclosure 45 | Platform LIST shape; source contract only |
| `COMMUNICATION_AD` COMMENT | Profile image `300×300`, copy ≤50 (recommended 43, ≤2 lines), profile name 14, disclosure 45 | Platform COMMENT shape; source contract only |
| `MOBILE_DA_FEED` IMAGE | Profile `300×300`; image 1:1 `1200×1200`, 16:9 `1200×628`, 2:3 `1200×1800`; profile name 19, ad copy 65 | Platform feed wrapper; source contract only |
| `MOBILE_DA_FEED` VIDEO | Video ≥600px wide, 5s–10m, ≤1GB, MP4/AVI/MOV/WMV, 1:1 or 16:9; optional still-image rule | Static Renderer runtime NOT_IMPLEMENTED |
| `MOBILE_DA_FEED` COLLECTION | 4–10 ordered items; item image `600×600`, item description ≤28, landing URL; video/still alternatives recorded | Multi-artifact runtime DEFERRED_TO_N6 |

PDF 단위가 KB/MB로 표현된 값은 registry에서 decimal byte 상수로 물질화했다. 이는 단위
변환의 [DERIVED] 값이며, 최종 UI 좌표로 해석하지 않는다. **[DERIVED]**

### 37.4 Feed safe areas and platform crop [OFFICIAL] [PROJECT]

Feed에서 source PDF가 제공한 safe area는 source pixel 좌표로만 보존한다.
프로필 safe area는 `x=27,y=27,w=246,h=246`, 1:1 이미지는 `60,60,1080,1080`,
16:9 이미지는 `60,60,1080,508`, 2:3 이미지는 `60,300,1080,1200`이다.
Collection item source는 `600×600`과 source crop guidance를 보존한다. 이 값들은
플랫폼이 입력을 자르는 경우의 참고 경계이지, Renderer가 최종 canvas에 배치할 좌표가
아니다. Renderer는 좌우/상하 crop, auto reposition, resize 또는 final UI geometry를
추론하지 않는다. **[OFFICIAL] [PROJECT]**

### 37.5 CTA and platform-generated controls [OFFICIAL] [PROJECT] [INFERRED]

Native와 Shopping News에서 첨부가 명시한 landing-label 목록은 registry에 보존한다.
Communication Ad와 Feed의 CTA는 가이드가 완전한 label 목록을 공개하지 않아
`PLATFORM_DEFINED`/`UNRESOLVED_ALLOWED_VALUE_LIST`로 기록한다. Promotion icon은
14개라는 개수만 확인되어 전체 label enum을 만들지 않는다. 승인되지 않은 카카오/NAVER
아이콘을 제작·다운로드·대체하지 않는다. 알림 수신 상태, AD mute, notification 문구와
카드 affordance는 platform-generated 필드로만 기록하며 source asset으로 렌더링하지
않는다. **[OFFICIAL] [PROJECT] [INFERRED]**

### 37.6 Version policy and compatibility [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.19.0 | 1.20.0 | Additive N5 PLATFORM_COMPOSED source provenance, fields, assets, and feed boundary |
| Template contract | 1.9.0 | 1.9.0 | No Kakao coordinates changed |
| Input Schema | 1.2.0 | 1.2.0 | N5 uses a separate SourceSpec schema; existing Kakao input remains compatible |
| Output Schema | 2.0.0 | 2.0.0 | No final raster response change |
| Integration Contract | 1.8.0 | 1.8.0 | Existing raster Input/Output shape and fingerprints remain unchanged |
| Integration error registry | 1.8.0 | 1.9.0 | Additive deterministic N5 source error codes |
| Platform-Composed SourceSpec | — | 1.0.0 | New standalone public source payload |
| Platform-Composed source registry | — | 1.0.0 | Five frozen official source revisions and nine profiles |
| Renderer Core | 0.7.0 | 0.7.0 | Source validation only; no native/feed raster |
| Desktop | 0.8.2 | 0.8.2 | No Desktop UI in N5 |

The separate SourceSpec avoids changing the legacy raster Integration Contract. Existing
Kakao Template-locked, Kakao FREEFORM, SmartChannel 120-template, and N4 FREEFORM
fingerprints remain regression gates. **[PROJECT]**

### 37.7 Runtime, fonts, and acceptance boundary [PROJECT]

Runtime network access is prohibited: no Naver API, CDN, remote font, telemetry, update
check, or upload. Build dependency resolution remains lockfile-based; offline install is
guaranteed only when the pnpm store is already prepared. Spoqa and SmartChannel font policies
remain those of earlier phases; N5 does not add a font fallback or download. **[PROJECT]**

Official N5 acceptance is Windows 10/11 x64. It checks source PDF SHA-256/page provenance,
JSON/schema/error-code uniqueness, SourceSpec final-geometry rejection, deterministic NFC
normalization/error ordering, feed safe areas, no new LayoutMode, and no final PNG/pixel
fingerprint. Three-run byte equality applies to implemented raster profiles only; N5 native
and feed profiles are source-contract checks, not pixel goldens. **[PROJECT]**

The N5 fixture minimum is one valid Mobile Native SourceSpec, one OBJECT/source reference
fixture, one final-geometry invalid fixture, CTA/platform-defined boundary coverage, feed
safe-area boundary cases, and one invalid fixture per registered N5 error code. Large fixture
datasets are implementation work, not Contract Freeze prerequisites. **[PROJECT]**

N5's next phase is `N6_NAVER_COLLECTION_MULTI_ARTIFACT_CONTRACT`. Collection and video remain
explicitly deferred; final NAVER UI geometry and upload approval are not claimed. **[PROJECT]**

---

## 38. Phase N6 — NAVER Collection / Multi-Artifact Contract

N6는 NAVER Feed Collection을 시작으로 여러 source artifact를 하나의 ordered payload로
관리하는 공통 cardinality contract와 실행 경계를 동결한다. 이 절은 N5의 source contract를
확장하지만 기존 `ArtifactCardinality = SINGLE | COLLECTION` enum을 재사용한다. 새로운
NAVER 전용 배열 schema나 새로운 `LayoutMode`는 추가하지 않는다. **[PROJECT]**

### 38.1 Official source revalidation [OFFICIAL] [TOOL_OUTPUT]

공식 Feed 가이드 페이지와 연결된 `FEED_AD_GUIDE.pdf`를 다시 확인했다. 페이지는 Mobile DA
Feed의 이미지·동영상·컬렉션 유형을 안내하고, 저장된 첨부의 SHA-256은
`0e45fdf9dda180551dde06bdef91e726f86823a405e62e00232db7ba407170ef`이다. 페이지와 첨부의
최종 UI 카드 좌표는 source contract가 아니라 NAVER 플랫폼 소유로 남긴다. **[OFFICIAL]
[TOOL_OUTPUT]**

### 38.2 Scope and platform boundary [PROJECT]

구현 대상은 `NAVER_GFA / MOBILE_DA_FEED / PLATFORM_COMPOSED / COLLECTION` 하나다.
Feed VIDEO, still alternative, SmartChannel, Mobile DA IMAGE, Native/Communication/
Shopping News 최종 UI, Meta/Google, Desktop UI는 N6 범위가 아니다. Renderer는 source
image bytes와 metadata/manifest만 만들며 carousel/card wrapper, label, interaction,
arrows/swipe, platform typography, spacing 또는 final Feed screenshot을 만들지 않는다.
`finalUiRendered`는 항상 `false`, `finalUiChecksum`은 항상 `null`이다. **[PROJECT]**

### 38.3 Collection SourceSpec [PROJECT]

공개 SourceSpec은 다음 shape을 사용한다.

```yaml
schemaVersion: "1.1.0"
channel: NAVER_GFA
placement: MOBILE_DA_FEED
compositionMode: PLATFORM_COMPOSED
artifactCardinality: COLLECTION
sourceProfileId: NAVER_FEED_COLLECTION_SOURCE_V1
fields: { ...collection-level fields... }
assets: [ ...source asset descriptors... ]
collection:
  items:
    - id: item-001
      sourceProfileId: NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600
      assetId: item-001-image
      fields:
        landingUrl: https://example.test/item-001
        itemDescription: 상품 설명
```

`collection.items` 배열 순서가 플랫폼에 전달할 순서이며 runtime은 자동 정렬하지 않는다.
각 item은 stable `id`를 가져야 하고 duplicate id, nested collection, 허용 목록 밖의
`sourceProfileId`를 거부한다. SINGLE SourceSpec은 `collection`을 가질 수 없으며 기존
SINGLE 입력은 그대로 허용한다. **[PROJECT]**

### 38.4 Frozen fields and item limits [OFFICIAL] [PROJECT]

검사한 공식 첨부에서 확인된 collection-level 필드는 Feed profile name(최대 19자), ad
copy(최대 65자), platform-defined CTA다. Item-level 필드는 landing URL과 item description
(최대 28자)이며, 완전한 CTA label 목록과 최종 UI label/spacing은 공개 계약으로 추론하지
않는다. Collection item count는 최소 4개, 최대 10개로 고정한다. **[OFFICIAL] [PROJECT]**

Item image source profile `NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600`은 다음과 같다.

| Rule | Frozen value | Evidence tag |
|---|---:|---|
| Canvas | `600×600` source pixels | [OFFICIAL] |
| MIME | `image/jpeg`, `image/png` | [OFFICIAL] |
| File size | `20,000–500,000` decimal bytes | [OFFICIAL] [DERIVED] |
| Alpha | RGB / alpha not allowed | [OFFICIAL] |
| Safe area | `x=30,y=30,width=540,height=540` | [OFFICIAL] |
| Runtime | source artifacts only | [PROJECT] |

Safe area는 source crop guidance를 metadata로 검증할 뿐이며 Renderer가 crop, resize,
reposition 또는 final UI geometry를 계산하지 않는다. Video/still item profiles는 registry에
정의하지만 `NOT_IMPLEMENTED`로 비활성화한다. **[OFFICIAL] [PROJECT]**

### 38.5 Validation and deterministic issues [PROJECT]

Collection-level 검증은 4–10 count, stable unique IDs, required collection fields, input
ordering, allowed item source profile, no nested collection을 검사한다. Per-item 검증은
required fields, asset existence, source profile, 600×600 dimensions, MIME, decimal byte
range, alpha, safe-area declaration, item field type/length와 landing URL presence를
검사한다. 하나라도 `ERROR`이면 collection 전체 export/publish를 차단한다. N6 Error Registry는
`KBR-NAVER-SOURCE-COLLECTION-ITEMS-REQUIRED`, `...TOO-FEW-ITEMS`, `...TOO-MANY-ITEMS`,
`...DUPLICATE-ITEM-ID`, `...ITEM-INVALID`, `...SOURCE-PROFILE-NOT-ALLOWED`,
`...NESTED-NOT-SUPPORTED`, `...ASSET-SAFE-AREA`, `...ASSET-CHECKSUM`을 등록한다.
오류는 severity, JSON pointer, code, message key 순으로 정렬한다. **[PROJECT]**

### 38.6 Multi-Artifact manifest and fingerprints [PROJECT]

N6 산출물은 `N source artifacts + 1 collection-manifest.json`이다. Manifest는
`collectionFingerprint`, `requestFingerprint`, `itemCount`, ordered `items`를 가지며 item
마다 `itemId`, `index`, `artifactChecksum`, `pixelFingerprint`, `requestFingerprint`,
`sourceProfileId`, `assetId`, MIME, dimensions, byte count와 normalized relative
`artifactPath`를 기록한다. Final NAVER Feed UI checksum이나 pixel fingerprint는 기록하지
않는다.

- `artifactChecksum`: source image byte의 SHA-256
- `pixelFingerprint`: decoded RGB/RGBA source pixels와 dimensions의 SHA-256
- item `requestFingerprint`: item fields, ID, source/asset profile와 resolved asset material
- `collectionFingerprint`: collection-level fields, ordered item IDs, ordered item request
  fingerprints, placement/profile/schema version
- `requestFingerprint`: normalized SourceSpec와 ordered item request fingerprints

따라서 `[A,B,C,D]`와 `[B,A,C,D]`는 서로 다른 collection fingerprint를 갖는다. 같은
normalized payload, 같은 bytes, 같은 dependency/runtime에서는 3회 실행의 item checksum,
item/payload fingerprint와 canonical manifest bytes가 byte-equal이어야 한다. **[PROJECT]**

### 38.7 Atomic publish and network boundary [PROJECT]

Publish는 동일 output root 아래 `.out-staging/<jobId>/`에 모든 item artifact와 manifest를
flush/close한 뒤 수행한다. 모든 item artifact를 먼저 rename하고 manifest를 마지막에 rename한다.
실패하면 staging과 부분 publish 파일을 정리하며 `partialPublish`는 항상 `false`다. 최종
manifest가 존재하는 상태는 모든 item artifact의 publish가 완료된 상태다. `downloadAllowed`
는 전체 validation과 atomic publish가 성공한 경우에만 `true`다. Runtime network access는
0이며 Naver API, CDN, remote font, telemetry, update check, analytics, upload와 plume/
Railway를 호출하지 않는다. Build dependency resolution만 lockfile 기반으로 허용한다.
**[PROJECT]**

### 38.8 Version, fixtures, and acceptance [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.20.0 | 1.21.0 | Additive N6 collection/multi-artifact contract |
| Template contract | 1.9.0 | 1.9.0 | No Kakao coordinates changed |
| Integration Contract | 1.8.0 | 1.8.0 | Existing raster response unchanged |
| Platform-Composed SourceSpec | 1.0.0 | 1.1.0 | Additive collection shape and schema compatibility |
| Platform-Composed source registry | 1.0.0 | 1.1.0 | Collection runtime and image-only allowlist |
| Multi-Artifact manifest | — | 1.0.0 | New generic ordered manifest |
| Renderer Core | 0.7.0 | 0.8.0 | Source collection validation/fingerprint/publish runtime |
| Desktop | 0.8.2 | 0.8.2 | No Desktop UI in N6 |

Representative fixtures are `valid-4`, `valid-10`, invalid 3/11, duplicate ID, invalid item,
unsupported source profile, nested collection, safe-area/checksum violations, and order-change
payloads. They are metadata/source artifacts only; no official sample creative is copied and no
final UI golden is created. Windows 10/11 x64 is the first supported deterministic golden
environment. N6 does not add cross-platform pixel tolerance. **[PROJECT]**

Desktop collection editor, reorder UI and multi-preview remain `NOT_IMPLEMENTED`. The next
phase is `N7_NAVER_DESKTOP_INTEGRATION_FULL_REGRESSION`; it may connect the already frozen source
contract to Desktop channel/placement selection without fabricating platform-owned final UI.
**[PROJECT]**

---

## 39. Phase N7 — NAVER Desktop Integration and Full Regression

N7는 N1–N6에서 동결한 NAVER 계약을 독립 실행형 Desktop의 실제 Channel → Placement →
Editor 흐름에 연결한다. Canonical 문서 버전 `1.21.0`, Template Contract `1.9.0`,
Platform-Composed SourceSpec/registry `1.1.0`, Multi-Artifact manifest `1.0.0`, Renderer
Core `0.8.0`과 좌표 계약은 변경하지 않는다. Desktop 공개 버전만 `0.8.2`에서 `0.9.0`으로
minor bump한다. **[PROJECT]**

### 39.1 Official source recheck [OFFICIAL] [TOOL_OUTPUT]

N7 시작 전에 공식 NAVER placement pages 1473–1480을 재확인했다. SmartChannel, Mobile
DA/Image Banner, Communication Ad, Shopping News, Native 및 Feed의 placement 명칭,
Feed IMAGE/VIDEO/COLLECTION 유형과 플랫폼 소유 presentation 경계는 frozen registry와
충돌하지 않았다. 최종 NAVER UI 좌표나 업로드 승인은 여전히 이 Renderer 계약의 대상이
아니다. **[OFFICIAL] [TOOL_OUTPUT]**

### 39.2 Capability-driven Desktop entry [PROJECT]

`contracts/desktop-capability-registry.json`을 Desktop capability source of truth로
사용한다. 첫 사용자 결정은 `KAKAO | NAVER` Channel이며 mode를 먼저 노출하지 않는다.
NAVER capability는 placement별 `compositionMode`, `layoutMode`, `artifactCardinality`,
editor type, source/freeform profile, template registry, font preflight, platform-owned
fields를 명시한다. KAKAO 상태와 NAVER 상태는 별도 UI state로 유지한다.

### 39.3 Placement editor mapping [PROJECT]

| Placement | Editor | Runtime output | Boundary |
|---|---|---|---|
| SmartChannel | template-locked | Core RGBA PNG + manifest | 120 whitelist; exact local font preflight |
| Mobile DA / Image Banner 1:1 | existing FREEFORM editor | Core raster artifact | shared editor; no duplicate implementation |
| Mobile Native / PC Native | source editor | SourceSpec + source manifest | final UI is NAVER-owned |
| Shopping News | source editor | SourceSpec + source manifest | notification/presentation/mute are platform-owned |
| Communication Ad | LIST/COMMENT source editor | SourceSpec + source manifest | variant selects frozen field profile |
| Mobile DA Feed IMAGE | source editor | SourceSpec + source manifest | no final feed UI |
| Mobile DA Feed COLLECTION | ordered collection editor | N6 item artifacts + collection manifest | 4–10; atomic; input order preserved |
| Mobile DA Feed VIDEO | disabled | none | out of static renderer scope |

Platform-Composed Preview and normalized payload always expose `finalUiRendered=false` and do
not contain final canvas/coordinates. Renderer-composed SmartChannel Preview/Export uses the
existing Core validator, fingerprint and atomic publish path. **[PROJECT]**

### 39.4 Validation, security, and network [PROJECT]

Naver IPC payloads are strict Zod schemas. Electron Main owns session asset/output tokens and
Core revalidates source profiles, MIME/canvas/bytes/alpha/safe-area, field rules, fingerprint
and Download gate. Existing path-security and same-volume atomic publish rules apply. Runtime
network access remains `0`: no Naver API, CDN, remote font, telemetry, update check, upload or
server dependency. **[PROJECT]**

### 39.5 Acceptance and regression [PROJECT]

N7 acceptance includes the existing contract/Core/CLI/GOLDEN gates, Windows x64 Desktop build,
the three-run deterministic SmartChannel target, and `tests/e2e/naver-desktop.spec.ts` covering
120-template discovery and PNG export, source-only export with `finalUiRendered=false`,
Communication source fields, Collection 4–10 controls, and disabled VIDEO. The handoff copy is
`C:\Users\Lenovo\Desktop\Renderer Module`; it records the N7 commit, capability matrix,
canonical SHA-256 and machine-readable manifest. **[PROJECT]**

N7's unresolved items are external exact SmartChannel font preflight on machines without the
approved local files, final NAVER native/feed UI, VIDEO runtime, upload approval and
cross-platform pixel tolerance. The next phase is `M0_NAVER_DESKTOP_HARDENING`. **[PROJECT]**

---

## 40. Phase N7.1 — NAVER Desktop White-Screen Runtime Hotfix

N7.1은 N7에서 보고된 Windows NAVER option 선택 후 white-screen 증상을 대상으로 하는
Desktop resilience hotfix다. 시작 시 HEAD의 `0.9.0` source, production-equivalent build,
Windows portable package에서 8개 placement와 Feed IMAGE/COLLECTION/VIDEO를 실제로
재실행했지만 현재 checkout에서는 uncaught exception이나 blank DOM을 재현하지 못했다.
따라서 원인을 추측해 Core 계약을 바꾸지 않고, 재현 가능한 증거를 보존할 수 있는 local-only
diagnostic path와 controlled editor fallback을 추가한다. **[PROJECT]**

### 40.1 Runtime diagnostics and Error Boundary [PROJECT]

Renderer는 `window.error`, `unhandledrejection`, React Error Boundary를 수집하고 Electron
Main IPC를 통해 `<userData>/logs/renderer.log`에 JSON Lines로 기록한다. Main은 renderer
console error, `render-process-gone`, unresponsive 상태도 같은 파일에 기록한다. 기록 필드는
timestamp, Desktop version, platform, channel, placement, subtype/template, error name,
message, stack, component stack이며 creative binary/content와 원격 telemetry는 기록하지
않는다. 로그 기록 실패는 두 번째 renderer 오류로 전파하지 않는다. **[PROJECT]**

Renderer editor subtree가 throw하더라도 `DESKTOP-EDITOR-001` Error Boundary가 fallback을
표시한다. Channel navigation은 Boundary 바깥에 남아 있으며 `다시 시도`와 `기본 화면으로`
동작을 제공한다. Capability, source profile, NAVER FREEFORM profile이 없을 때는 다른
profile로 조용히 fallback하지 않고 각각 `DESKTOP-CAPABILITY-001`부터 `004`의 명시적
오류 상태로 전환한다. **[PROJECT]**

### 40.2 Packaged resolution and click-matrix acceptance [PROJECT]

`contracts/desktop-capability-registry.json`의 8개 NAVER placement ID는 UI value와
정확히 일치해야 한다. `scripts/smoke-naver-desktop.mjs`는 production package의
unpacked 실행본과 portable EXE를 모두 검사하고 각 placement 전환 후 app root, Channel
navigation, Placement selector, editor/fallback shell이 살아 있는지와 console/page error가
없는지를 확인한다. Feed IMAGE와 COLLECTION은 활성 상태로, VIDEO는 disabled 상태와
`Out of static renderer scope` 메시지로 확인한다. KAKAO → NAVER → KAKAO 전환도 같은
검사에 포함한다. **[PROJECT]**

기존 N7 E2E는 dev Electron만 실행하고 packaged UI를 열지 않았으며 selection 직후 DOM
invariant와 page/console error를 수집하지 않았다. N7.1은 해당 공백을 dev/production
renderer build 및 packaged click matrix로 보완한다. **[PROJECT]**

### 40.3 Version and regression policy [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.0 | 1.21.0 | Desktop-only hotfix; canonical contract unchanged |
| Template contract | 1.9.0 | 1.9.0 | Coordinates unchanged |
| Renderer Core | 0.8.0 | 0.8.0 | Pixel/golden/fingerprint behavior unchanged |
| Desktop | 0.9.0 | 0.9.1 | Local diagnostics, Error Boundary, deterministic capability error states, packaged click regression |
| Desktop Error Registry | — | 1.0.0 | New Desktop-only runtime error namespace |

Core PNG pixels, Kakao goldens, SmartChannel 120 outputs, N4 goldens, N6 collection
fingerprints/manifest semantics, and runtime network prohibition remain unchanged. The original
user-reported exception remains an unresolved reproduction blocker until an affected machine
supplies its captured stack or environment-specific failure evidence. **[PROJECT]**

---

## 41. Phase N7.2 — SmartChannel Null Value Selection Hotfix

N7.2는 N7.1 local diagnostic log에서 실제로 확보된 SmartChannel 예외
`TypeError: Cannot read properties of null (reading 'value')`를 대상으로 한다. 0.9.1 stack은
`NaverDesktopEditor`의 SmartChannel filter render와 React `useState` updater 경로를 가리켰고,
source handler가 functional updater 안에서 `event.currentTarget.value`를 지연 참조하는
event-lifetime 결함으로 분류되었다. **[PROJECT]**

### 41.1 Selection and event invariants [PROJECT]

SmartChannel filter 순서는 `height → family → objectKind → side → textVariant → affordance`로
고정한다. 모든 option과 최종 selection은 source-backed 120-template registry에서 derive한다.
상위 dimension이 변경되면 하위 값은 유효할 때 유지하고, 유효하지 않으면 canonical registry
order의 첫 candidate로 deterministic reset한다. candidate가 없으면 editor shell을 유지하는
controlled unresolved state로 전환하며 Preview/Download를 차단한다. unsupported Cartesian
product나 다른 template로의 silent fallback은 금지한다. **[PROJECT]**

React event 값은 state updater에 전달하기 전에 동기적으로 snapshot한다. `event.currentTarget`
또는 `event.target`을 functional updater나 `await` 이후에 읽지 않는다. Font preflight 결과는
selection state를 null로 만들지 않으며, local diagnostics에는 선택된 height, family,
objectKind, side, textVariant, affordance를 기록할 수 있다. **[PROJECT]**

### 41.2 Acceptance and regression [PROJECT]

N7.2 acceptance는 다음을 포함한다.

- 최초 NAVER → SmartChannel mount 및 Error Boundary fallback 0회
- 대표 4개 source-backed transition과 `160 → 280 → 200 → 160`, `LEFT → RIGHT → LEFT`,
  `BASIC → EMPHASIS → BOTTOM_DISCLOSURE → BASIC` 왕복
- registry 120개와 UI reachable template 120개, unsupported exposed 0개
- unpacked production build와 Windows portable EXE에서 SmartChannel transition matrix
- 기존 8개 NAVER placement, Feed IMAGE/COLLECTION/VIDEO, KAKAO 회귀
- Core pixels, goldens, fingerprints, source contracts 및 runtime network prohibition 불변

### 41.3 Version and regression policy [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.0 | 1.21.0 | Desktop-only state hotfix |
| Template contract | 1.9.0 | 1.9.0 | 120-template source contract unchanged |
| Renderer Core | 0.8.0 | 0.8.0 | Pixel/golden/fingerprint behavior unchanged |
| Desktop | 0.9.1 | 0.9.2 | Event value snapshot, selection reconciliation, packaged SmartChannel matrix |

N7.2 root-cause evidence and implementation are recorded in the N7.2 clarification and
implementation documents. The next phase remains `M0_NAVER_DESKTOP_HARDENING`. **[PROJECT]**

---

## 42. Phase N7.3 — SmartChannel Editor Content Ownership and Input Reset Hotfix

N7.3은 SmartChannel `headline` 입력값이 사용자의 입력 후 기본 문구로 되돌아가는 Desktop
상태 결함을 대상으로 한다. 수정 전 E2E에서 사용자 문구는 2.5초 대기 후 유지되었지만,
명시적으로 비운 `headline`이 즉시 `브랜드의 새로운 시작`으로 복귀했다. 실제 경로는
`smartContent[field] || DEFAULT_TEXT[field] || ""` controlled input fallback과 같은
preview request fallback이었다. Preview 결과가 content state를 비동기적으로 덮어쓴 경로는
확인되지 않았으며, 원인은 `VALUE_FALLBACK`으로 분류한다. **[PROJECT]**

### 42.1 Content-state invariants [PROJECT]

`smartContent`는 SmartChannel 텍스트의 유일한 Desktop editor-owned state다. `DEFAULT_TEXT`는
editor mount 시 한 번만 lazy initializer로 물질화한다. Render, filter reconciliation,
template selection, preview, export 단계에서 기본값을 재주입하지 않는다. **[PROJECT]**

`undefined`는 아직 값이 없는 상태이고 `""`는 유효한 사용자 입력이다. Controlled input과
SmartChannel preview/export request builder는 nullish semantics를 사용해 빈 문자열을
보존한다. Preview 결과나 validation 상태는 content state에 write-back하지 않는다.
Selection state, content state, preview state는 분리하며, 호환 가능한 template 전환에서
저장된 content key를 삭제하지 않는다. **[PROJECT]**

이 정책은 `headline`, `subcopy`, `headlineLine2`, `subcopyLine4`, `disclosureLine1`,
`disclosureLine2`, `ctaOption`에 동일하게 적용한다. 필터와 템플릿은 계속 source-backed
120-template registry에서만 선택하며, N7.2의 순서와 reconciliation 규칙은 변경하지
않는다. **[PROJECT]**

### 42.2 Input lifecycle and acceptance [PROJECT]

공개 SmartChannel 흐름은 기존과 같이 입력 → 필터/템플릿 선택 → Preview/Validate → Export다.
입력 이벤트 값은 동기적으로 state에 저장하고, Preview 요청은 현재 state를 읽기만 한다.
빈 문자열도 필터 전환, 2.5초 이상 대기하는 render/debounce 경계, Preview 요청 이후에
그대로 남아야 한다. Korean Unicode rapid-input 경로와 호환 template 전환도 동일 invariant를
검사한다. **[PROJECT]**

N7.3 acceptance는 다음을 포함한다.

- 수정 전 테스트에서 `headline` 빈 값 assertion이 기본값 수신으로 실패하고, 수정 후 통과
- 사용자 정의 문구와 명시적 빈 문자열의 2.5초 대기/Preview 후 보존
- Korean Unicode 입력 및 rapid input 보존
- `headline`, `subcopy`, `headlineLine2`, `subcopyLine4`, `disclosureLine1`,
  `disclosureLine2`, `ctaOption`의 공통 state 경로 점검
- unpacked production build와 Windows portable EXE의 120-template reachability 및 copy
  persistence smoke
- 기존 8개 NAVER placement, Feed IMAGE/COLLECTION/VIDEO, KAKAO 전환과 N7.2 option selection
  회귀
- Core pixels, goldens, fingerprints, source contracts, canonical geometry, font policy, CTA
  assets/semantics, and runtime network prohibition 불변

### 42.3 Version and regression policy [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.0 | 1.21.0 | Desktop-only state hotfix; canonical contract unchanged |
| Template contract | 1.9.0 | 1.9.0 | 120-template source contract and geometry unchanged |
| Renderer Core | 0.8.0 | 0.8.0 | Pixel, golden, and fingerprint behavior unchanged |
| Desktop | 0.9.2 | 0.9.3 | Editor-owned SmartChannel copy, one-time defaults, empty-string preservation, and packaged regression |

N7.3 root-cause evidence, clarification, and implementation are recorded in the N7.3 documents
and ADR-0055. The next phase remains `M0_NAVER_DESKTOP_HARDENING`. **[PROJECT]**

---

## 43. Phase N7.4 — SmartChannel Asset Normalization and Official Font Contract Hotfix

N7.4는 SmartChannel 실사용에서 raw transparent source canvas가 750×160 또는 source-frame
크기와 다르다는 이유로 거부되던 자산 검증과, Apple SD Gothic Neo를 runtime approved font처럼
취급하던 이전 호환성 계약을 교정한다. 이 절은 N7.4 hotfix의 현재 계약이며 source PSD에
남은 Apple 이름은 provenance metadata로만 보존한다. **[PROJECT]**

### 43.1 Object validation pipeline [OFFICIAL] [PROJECT]

SmartChannel object의 검증 순서는 `decode → alpha bounds → alpha trim → placement policy →
contain scale → final rendered bounds → region validation → rendered alpha pixel count`로
고정한다. raw source canvas, 투명 padding, pre-scale coordinate, source-space placement를
최종 object limit 또는 region 판정에 사용하지 않는다. 기존 precomposed full-canvas input은
source canvas가 template canvas와 일치할 때만 legacy compatibility로 인식하며, 이 경우에도
최종 alpha bounds만 검사한다. **[PROJECT]**

DA 160 object limit은 width 260px, height 160px, area 41,600px, non-transparent pixel
최대 70%(29,120px)다. alpha trim 보존 임계치는 `alpha >= 1`, layout-visible/연결요소 임계치는
`alpha >= 8`로 고정한다. 8-connected layout-visible 요소를 component로 분리한 뒤 `count >= 16`인
의미 있는 모든 component를 기준 콘텐츠로 선택하고, `count < 16`인 무관한 극소 고립 픽셀은
bbox를 확장하지 않는다. resize 후 alpha를
이진화하지 않으며 완전 투명 픽셀의 RGB는 무시한다. **[OFFICIAL] [PROJECT]**

Contain scale은 최대 1.5×를 유지한다. `round(trimmed×scale)`로 최소 1px을 보장하고,
slot 중앙 배치는 `floor((slot−resized)/2)`를 사용한다. 좌우/상하 crop은 수행하지 않는다.
진단에는 `sourceCanvas`, `alphaBounds`, `normalizedSize`, `finalBounds`, `targetRegion`,
`opaquePixelCount`, `maxOpaquePixelCount`를 포함한다. **[PROJECT]**

### 43.2 Official font roles and provenance [OFFICIAL] [PROJECT]

허용 family는 Sandoll Neo Gothic, NanumBarunGothic, San Francisco다. 기본 deterministic
profile은 Main Bold와 Sub/Disclaimer Regular이며 San Francisco Bold는 영문 전용 Main
1행 선택 사항이다. Medium/SemiBold는 unconditional dependency가 아니다. Apple SD Gothic
Neo canonical IDs 네 개는 runtime registry에서 제거하고, source metadata에서만 historical
identity로 남긴다. **[OFFICIAL] [PROJECT]**

사용자가 제공한 `nanum-barun-gothic` 폴더에서 원본 수정 없이 확보한 TTF를 bundled exact
runtime asset으로 등록했다. Bold는 `assets/fonts/naver-smartchannel/NanumBarunGothicBold.ttf`
(SHA-256 `39bba4cd9bd2986143825c8654abbb62443914ab33b346c0c929a916f5d98bf2`, PostScript
`NanumBarunGothicBold`, OS/2 weightClass 600, declared role 700), Regular는
`assets/fonts/naver-smartchannel/NanumBarunGothic.ttf` (SHA-256
`9b872773134e2e4d8c0b17021266786576db06c843ede0d0b523b214a450756c`, PostScript
`NanumBarunGothic`, OS/2 weightClass 400)이다. 합법성은 사용자 공식/적법 확보 assertion과
내장 copyright metadata(NHN Corporation/FONTRIX)에 근거하며 별도 license 파일은 없다고
명시한다. SF는 optional source-only unresolved다. 시스템 fallback, Spoqa/Noto 대체,
fake filename/SHA, 네트워크 다운로드는 계속 금지한다. **[PROJECT]**

### 43.3 Actual user binary acceptance [PROJECT]

실제 사용자 binary acceptance는 특정 source canvas 크기를 요구하지 않는다. `2048×1366`은
historical/equivalent fixture characteristic일 뿐 Canonical input dimension requirement가 아니다.
실제 사용자 PNG는 high-resolution transparent source여야 하며, raw source canvas를 limit으로
사용하지 않고 `decode → alpha trim → contain fit → final rendered bounds → region validation →
visible alpha pixel validation → preview → export → packaged runtime` 전체 경로를 통과해야 한다.
기계 판정 기준과 source/output digest는
`contracts/naver-smartchannel-actual-asset-acceptance.json`에 기록한다. **[PROJECT]**

현재 실제 사용자 sofa binary는 `C:/Users/Lenovo/Desktop/kakao/TEST_SOURCE/Plume_누끼.png`이며,
SHA-256 `fb736b93a274899b9750857ab7852c15d54d4f5233f7fbd655d28c2448f62dc4`, source canvas
`7616×5080`, alpha bounds `x=2485,y=1555,w=3878,h=2213`이다. frozen token의 target region
`x=40,y=0,w=235,h=160`에 contain한 normalized size는 `235×134`, final bounds는
`x=40,y=13,w=235,h=134`, visible alpha pixel은 `20,391/29,120`이며 validator error,
warning, info는 모두 0이다. Preview, Export, packaged runtime이 모두 PASS하고 output PNG
SHA-256은 `1fb633dfaab45bf404aaf59d58421982d3b450d9028fd4d760856f811743e373`,
pixel/render fingerprint는 `0383f4c920ee95b2a57cfc646da25fa418301992b1985ea5f8fecd6a83f93374`,
request fingerprint는 `fa1fdc0f595d2dc1295653b3882bffc2b1d4b9933a160c5805838a46c4e0bdc4`다.
이는 runtime/contract acceptance evidence이며 사용자 디자인 최종 승인(`manualAcceptanceStatus`)
을 자동으로 의미하지 않는다. **[PROJECT]**

실제 logo binary도 동일한 evidence registry에 유지한다. `842×595`, alpha bounds
`x=187,y=218,w=469,h=159`, normalized `235×80`, visible alpha pixel `7,801`이며 Preview,
Export, packaged runtime이 PASS다. **[PROJECT]**

### 43.4 Error i18n and regression boundary [PROJECT]

`naver_smartchannel.asset_dimension_mismatch`, `naver_smartchannel.object_out_of_region`,
`naver_smartchannel.object_opaque_pixel_limit`, `naver_smartchannel.font_unavailable`의
한국어 번역을 등록하고, object 오류에는 가능할 때 actual/expected 진단을 표시한다.
G1 large-transparent, G2 sofa ratio, G3 logo ratio, G4 oversized, G5 translated region,
G6 70% pixel, G7 font registry, G8 i18n fixture를 추가한다. N7.2/N7.3 editor state와
Kakao/FREEFORM/다른 NAVER source 계약은 변경하지 않는다. **[PROJECT]**

### 43.5 Version and implementation status [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.0 | 1.21.1 | SmartChannel normalization/font/i18n hotfix |
| Template contract | 1.9.0 | 1.9.0 | Coordinates and template contract unchanged |
| Renderer Core | 0.8.1 | 0.8.2 | Bundled exact Nanum preflight and disconnected meaningful-component trim correction |
| Desktop | 0.9.4 | 0.9.5 | Bundled Nanum asset inclusion and deterministic SmartChannel preview/export |
| Error Registry | 1.6.0 | 1.7.0 | Add final opaque-pixel limit error code |

N7.4 implementation is independent of plume, remote services, upload, telemetry, and runtime
network access. Required fonts are resolved bundled exact assets. Actual user sofa and logo
binary evidence both pass the full normalization path; exact source dimensions are not a
requirement. `manualAcceptanceStatus=NOT_REVIEWED` remains an explicit distinction from runtime
acceptance and does not block this phase closeout. **[PROJECT]**

---

## 44. Phase N7.5 — SmartChannel Fixed Component Runtime and Package Hotfix

N7.5은 N7.4의 고정된 SmartChannel 자산과 좌표를 변경하지 않고, packaged Desktop에서
landing icon과 APP CTA raster가 누락되어 Preview/Export가 실패하던 런타임 경로를 교정한다.
수정 전 source Core는 `assets/naver-smartchannel`을 읽을 수 있었지만 electron-builder의
`build.files`에 해당 디렉터리가 없어 packaged `resources/app`에 파일이 존재하지 않았다.
이 원인은 `PACKAGING`으로 분류하며, N3 exhaustive test가 source `projectRoot`만 사용하고
packaged `resources/app` resolver를 실행하지 않았기 때문에 발견되지 않았다. **[PROJECT]**

### 44.1 Frozen fixed-component inventory [PROJECT]

`contracts/naver-smartchannel-fixed-component-runtime.json`은 26개 runtime resource의
단일 인벤토리다. 모든 항목은 `id`, `scope`, `componentFamily`, `sourceProvenance`,
`expectedSha256`, `sourcePath`, `runtimePath`, `packagedRequired`, `templates`,
`expectedRenderBounds`를 가져야 하며 상태는 `FROZEN`이다. source와 runtime 경로는
프로젝트 상대 경로이고, 패키지 빌드에는 `assets/naver-smartchannel/**/*`가 반드시 포함된다.
누락, 변경, 비등록, digest 불일치는 fallback 없이 오류로 종료한다. **[PROJECT]**

Landing icon의 승인 digest와 좌표는 다음과 같이 그대로 유지한다.

| Component | SHA-256 | 160 | 200 | 280 |
|---|---|---|---|---|
| `LANDING_ICON_COMPACT` | `c731128d2bb468c5d7088c9d183d4ebbec24aa748085e6fe41f8d0cbd24a8e58` | `x=694,y=65,w=16,h=30` | `x=694,y=85,w=16,h=30` | — |
| `LANDING_ICON_280` | `b81d74dcadc9d21db0e81169117d52f9fc51973bd2bba0ce18985035efd617ca` | — | — | `x=660,y=112,w=56,h=59` |

Compact APP CTA는 frozen 11-label registry를 사용하며 160/200의 각 source occurrence와
280의 각 source occurrence만 허용한다. 임의의 Cartesian 조합을 만들지 않는다. **[PROJECT]**

### 44.2 Runtime validation order and diagnostics [PROJECT]

고정 구성요소 검증 순서는 다음으로 고정한다.

1. 선택한 template에서 허용된 component family인지 확인
2. runtime inventory registry entry 확인
3. trusted runtime/package 경로의 파일 존재 확인
4. 기대 SHA-256 확인
5. RGBA PNG decode 확인
6. source-backed placement bounds와 실제 pixel dimensions 확인
7. 최종 bounds가 frozen bounds와 일치하는지 확인
8. composite에 고정 구성요소를 그린다

고정 구성요소에는 제품 object의 alpha trim, contain scale, 70% opaque-pixel 규칙 또는
fallback을 적용하지 않는다. 실패 시 `NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID` 하나의
안정된 오류 코드로 반환하며 `componentId`, `templateId`, `failureReason`,
`expectedDigest`, `actualDigest`, `expectedBounds`, `actualBounds`, `runtimeResourceId`,
`runtimeResourcePath`를 포함한다. failure reason은 `MISSING_REGISTRY_ENTRY`,
`MISSING_RUNTIME_ASSET`, `DIGEST_MISMATCH`, `DECODE_FAILED`, `PLACEMENT_MISMATCH`,
`UNSUPPORTED_FOR_TEMPLATE` 중 하나다. **[PROJECT]**

`naver_smartchannel.fixed_component_invalid` 한국어 키를 UI registry에 등록하고, 외부
계약에는 AJV 원문 영어 메시지를 노출하지 않는다. Preview, Export, packaged runtime은
같은 Core resolver와 같은 inventory를 사용한다. **[PROJECT]**

### 44.3 Acceptance and deterministic boundary [PROJECT]

Acceptance는 LANDING_ICON 29개(160 8개, 200 8개, 280 13개)를 모두 실행하고, compact
CTA 11개 label의 160/200 source-backed occurrence와 280 CTA 11개 option matrix를
검사한다. digest corruption, missing asset, compact/280 wrong mapping은 각각 통제된
고정 구성요소 오류를 반환해야 한다. 동일 Windows 10/11 x64 runtime에서 대표 입력을
3회 실행한 PNG SHA-256과 fingerprint는 byte-equal이어야 한다. **[PROJECT]**

패키지 검증은 unpacked `release/win-unpacked/resources/app`와 portable EXE를 모두
대상으로 하며, source/runtime/packaged digest가 동일해야 한다. Runtime network request는
0이고 Error Boundary fallback은 0이어야 한다. Kakao, FREEFORM, N2/N4/N5/N6, N7.2,
N7.3, N7.4 actual sofa/logo/font acceptance와 기존 non-target fingerprint는 회귀 없이
유지한다. **[PROJECT]**

### 44.4 Version and next phase [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.1 | 1.21.1 | Fixed-component runtime/package hotfix; canonical geometry unchanged |
| Template contract | 1.9.0 | 1.9.0 | Source template and coordinates unchanged |
| Renderer Core | 0.8.2 | 0.8.3 | Frozen runtime inventory, digest/decode/placement validation, structured diagnostics |
| Desktop package | 0.9.5 | 0.9.6 | Include SmartChannel fixed assets and add packaged smoke mode |
| Fixed component runtime registry | — | 1.0.0 | New machine-readable source/runtime/package inventory |

N7.5는 공식 업로드 승인이나 외부 서비스 연동을 의미하지 않는다. plume, Railway,
PostgreSQL, telemetry, 원격 폰트, CDN, 카카오/NAVER API 업로드는 계속 범위 밖이며 runtime
network access는 금지한다. 다음 계획 단계는 `M0_META_OFFICIAL_FORMAT_SOURCE_CATALOG`다.
**[PROJECT]**

---

## 45. Phase N7.7 — SmartChannel PSD-exact renderer-owned runtime font correction

N7.6의 전수 감사는 120개 PSD의 typography token, font size, baseline, leading, text box,
template/object/fixed-component geometry가 frozen contract와 일치하지만, visible text의
runtime font만 NanumBarunGothic으로 달라 glyph width·ascent·weight가 달라지는 것을
확인했다. N7.7은 geometry와 token ID를 그대로 두고 token → runtime font binary 매핑만
교정한다. **[PROJECT]**

### 45.1 Renderer-owned font resource [PROJECT]

SmartChannel의 visible final role은 다음 logical token으로만 해석한다.

| Source role | Logical token | PSD label | Pinned resource |
|---|---|---|---|
| HEADLINE, HEADLINE_LINE_2 | `NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD` | `AppleSDGothicNeo-Bold` | `assets/fonts/naver-smartchannel/AppleSDGothicNeo-Bold.ttf` |
| SUBCOPY, THIRD_LINE, FOURTH_LINE, DISCLOSURE_LINE_1/2 | `NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR` | `AppleSDGothicNeo-Regular` | `assets/fonts/naver-smartchannel/AppleSDGothicNeo-Regular.ttf` |
| APP_CTA_TEXT | `NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD` | `AppleSDGothicNeo-SemiBold` | `assets/fonts/naver-smartchannel/AppleSDGothicNeo-SemiBold.ttf` |

각 resource는 `contracts/naver-smartchannel-font-asset-manifest.json`과
`contracts/naver-smartchannel-runtime-font-policy.json`에 실제 SHA-256과 binary
name-table PostScript identity를 함께 가진다. 현재 파일의 실제 identity는 각각
`AppleSDGothicNeoB00`, `AppleSDGothicNeoR00`, `AppleSDGothicNeoSB00`이며, renderer는
검증 후 안정된 registration alias를 사용한다. 이는 filename/family 추측이나 가짜
identity가 아니다. Binary provenance/redistribution 권리는 별도 문제로 남기고
`REDISTRIBUTION_STATUS_UNCONFIRMED`를 유지한다. **[PROJECT]**

OS-installed font, `C:\Windows\Fonts`, macOS system font, absolute Windows path,
browser fallback, Nanum fallback, remote URL, runtime download는 사용하지 않는다. Core는
logical token을 조회한 뒤 injected `SmartChannelFontResourceProvider`에서 trusted
project-relative resource를 받고, file existence → OpenType decode → PostScript identity
→ SHA-256 → glyph coverage → explicit binary registration 순서로 fail-closed preflight를
수행한다. DesktopResourceProvider와 TestDeploymentResourceProvider는 같은 logical
registry와 bytes를 공급할 수 있으며 physical path는 fingerprint material에 들어가지
않는다. **[PROJECT]**

### 45.2 Source-only fonts and Nanum boundary [PROJECT]

`AppleSDGothicNeo-Medium`은 GUIDE_TEXT만, `SFProDisplay-Bold`와 `SFUIDisplay-Bold`는
hidden English source layer만 확인되어 final renderer contribution이 없다. 세 source
font는 `SOURCE_ONLY_NON_RUNTIME`, `runtimeRequired=false`로 기록한다. SF binary를
제작하거나 내려받지 않으며, visible contribution이 새로 확인되면 별도 계약 변경 없이는
mapping하지 않는다.

N7.4의 Nanum binaries는 다른 format/UI의 historical resource로 보존할 수 있지만 SmartChannel
required role mapping에서는 제거한다. SmartChannel의 required runtime set은 Apple Bold,
Regular, SemiBold 세 자산뿐이며 fallback은 금지한다. **[PROJECT]**

### 45.3 Geometry and raster invariants [PROJECT]

N7.6에서 MATCH인 typography token ID, font size, baseline, leading, text box, tracking,
alignment, text origin, template coordinates, object placement, fixed-component digest와
placement는 N7.7에서 변경하지 않는다. 대표 template
`NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE`의 frozen values는 headline
35px/baseline `106.45703125`, second headline 35px/baseline `154.45703125`, subcopy
29px/baseline `201.45703125`, line gaps `48`/`47`이다.

Runtime font bytes가 바뀌므로 SmartChannel text pixel fingerprint와 text-dependent golden의
변경은 `PSD_EXACT_RUNTIME_FONT_CORRECTION`으로 예상되는 migration이다. Geometry와
non-SmartChannel output은 변경되지 않는다. 자동 shrink, baseline/box 보정, fallback,
무조건 golden overwrite는 금지한다. **[PROJECT]**

### 45.4 Determinism, security, and acceptance [PROJECT]

Windows 10/11 x64가 v1 공식 golden 환경이다. 동일 input/template/resource/dependency/runtime
조건에서 3회 PNG SHA-256과 pixel fingerprint가 같아야 한다. SmartChannel 120개 template
전수 렌더는 `fontResolutionFailures=0`, `newValidationErrors=0`, `passed=120`이어야 하며,
provider parity에서 동일 font SHA가 동일 pixel/PNG digest를 만들어야 한다. Runtime network
request는 0이고 system font lookup/fallback은 0이다. Kakao, 다른 NAVER, FREEFORM, N6
Collection, N7.2–N7.6 assertions와 N7.5 fixed-component digest/placement는 회귀 없이
유지한다. **[PROJECT]**

### 45.5 Version and artifacts [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.1 | 1.21.2 | Normative renderer-owned PSD-exact font mapping |
| Template contract | 1.9.0 | 1.9.0 | Geometry and template coordinates unchanged |
| Renderer Core | 0.8.3 | 0.8.4 | Provider, SHA/PostScript/glyph preflight, explicit registration |
| Desktop package | 0.9.6 | 0.9.7 | Include renderer-owned SmartChannel font resources |
| Runtime font policy | 1.3.0 | 1.4.0 | Apple exact required roles and no system mode |
| Font compatibility | 1.1.0 | 1.2.0 | Logical Apple role mapping and provider contract |
| Typography registry | 1.3.0 | 1.4.0 | Additive correction mapping; PSD token IDs preserved |

Machine-readable correction evidence is `contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json`,
human report is `docs/implementation/naver-smartchannel-psd-exact-runtime-font-correction-n7-7.md`,
and the deterministic verifier is `scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs`.
The renderer remains standalone; plume, Railway, PostgreSQL, Queue, telemetry, upload approval,
and remote services remain out of scope. **[PROJECT]**

## 46. Phase N7.7.4 — macOS original TTC source integration [PROJECT]

SmartChannel의 renderer-owned source of truth는
`assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc`이다. 파일 크기는 `28427796`
bytes이고 SHA-256은
`0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66`이다. Runtime은
Windows/macOS font installation, Font Book, user font directory 또는 OS font lookup에
의존하지 않는다. License status는
`UNCONFIRMED_REVIEW_REQUIRED_BEFORE_EXTERNAL_REDISTRIBUTION`, 현재 usage scope는
`PRIVATE_LOCAL_RENDERER_MODULE`이다. **[PROJECT]**

### 46.1 Collection faces and backend decision [PROJECT]

| Logical token | TTC face index | PostScript | Version | Runtime derived face |
|---|---:|---|---|---|
| `NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR` | 0 | `AppleSDGothicNeo-Regular` | `19.0d2e1` | `AppleSDGothicNeo-macOS19-Regular.otf` |
| `NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD` | 4 | `AppleSDGothicNeo-SemiBold` | `19.0d2e1` | `AppleSDGothicNeo-macOS19-SemiBold.otf` |
| `NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD` | 6 | `AppleSDGothicNeo-Bold` | `19.0d2e1` | `AppleSDGothicNeo-macOS19-Bold.otf` |

현재 text backend는 TypeScript/Node.js Core, `@napi-rs/canvas 1.0.3`의 Skia raster와
`GlobalFonts.register`/`registerFromPath`이다. 실제 TTC preflight에서 collection index 0은
등록되지만 API에 face-index selector가 없어 index 4/6을 deterministic하게 선택할 수 없다.
따라서 integration mode는 `VERIFIED_DERIVED_STANDALONE_FACE`이다. 원 TTC의 선택 face에서
SFNT table bytes를 그대로 복사하며 glyph outline, cmap, metrics, GSUB/GPOS/GDEF, kerning,
name 또는 PostScript identity를 재작성하지 않는다. 독립 SFNT checksum을 위한
`head.checkSumAdjustment`만 달라질 수 있고, normalized table SHA, glyph count `18662`,
unitsPerEm `1000`, CFF outline identity를 매 실행 preflight에서 검증한다. **[PROJECT]**

### 46.2 Fail-closed resource and fingerprint contract [PROJECT]

Font resource는 `SINGLE_FONT`, `FONT_COLLECTION`, `DERIVED_STANDALONE_FACE`를 표현한다.
Current SmartChannel mapping은 collection asset ID/SHA, face index/PostScript/version과 derived
resource SHA/provenance를 모두 요구한다. `FONT_RESOURCE_MISSING`,
`FONT_RESOURCE_SHA_MISMATCH`, `FONT_COLLECTION_FACE_NOT_FOUND`,
`FONT_COLLECTION_FACE_IDENTITY_MISMATCH`, `FONT_COLLECTION_UNSUPPORTED`,
`FONT_DERIVED_RESOURCE_PROVENANCE_MISMATCH`는 render 시작 전에 fail closed한다. 다른 폰트로
silent fallback하지 않는다. **[PROJECT]**

Pixel fingerprint의 font material은 logical token, collection asset ID, collection SHA-256,
face index, face PostScript name, font contract version이다. Machine-specific absolute path는
포함하지 않는다. Provider가 source TTC와 derived face를 동일 bytes로 공급하면 Core,
Desktop QA, package/handoff에서 동일 fingerprint와 PNG digest를 생성해야 한다. Runtime
network access는 계속 금지한다. **[PROJECT]**

### 46.3 Frozen geometry, evidence, and acceptance [PROJECT]

Font size, baseline, tracking, leading, origin, layout box, placement geometry, template/object/fixed
component coordinates는 변경하지 않는다. 대표 template
`NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE`는 동일 copy/assets/settings로
legacy N7.7 TTF와 macOS TTC derived face를 A/B 렌더한다. Decoded RGBA pixel SHA, 실제 text
alpha bounds, ink bounds, pixel count, measured width 및 diff metric을 기록한다.
`actualRasterBounds`는 PSD box를 복사하지 않고 각 text role의 격리 raster alpha scan으로
계산한다. **[PROJECT]**

macOS TTC candidate는 동일 프로세스 3회 PNG bytes 및 decoded pixels가 동일해야 한다.
SmartChannel 120개 smoke는 render/font/validator/crash 오류 0이어야 한다. Legacy converted TTF는
삭제하지 않고 `DEPRECATED_FOR_SMARTCHANNEL` evidence 용도로 보존한다. SmartChannel golden
rebase는 `manual_acceptance.approved_creative_match=NOT_REVIEWED`인 동안 금지한다. **[PROJECT]**

### 46.4 Version and artifacts [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.2 | 1.21.3 | macOS TTC source/provenance integration |
| Renderer Core | 0.8.4 | 0.8.5 | TTC parser, face/provenance preflight, collection fingerprint |
| Desktop/package | 0.9.7 | 0.9.8 | TTC and verified derived faces packaging |
| Font contract | 1.1.0 | 1.2.0 | Collection/derived resource union |
| Runtime font policy | 1.4.0 | 1.5.0 | TTC face mapping and fail-closed sequence |
| Font compatibility | 1.2.0 | 1.3.0 | macOS source TTC compatibility state |
| Asset manifest | 1.1.0 | 1.2.0 | source TTC and extraction provenance |
| Typography registry | 1.4.0 | 1.5.0 | token-to-collection-face mapping; token IDs preserved |

Machine-readable audit는
`contracts/audits/naver-smartchannel-font-source-migration-n7-7-4.json`, 구현 보고서는
`docs/implementation/naver-smartchannel-macos-original-ttc-integration-n7-7-4.md`, 검증 자료는
`artifacts/n7-7-4/`에 둔다. **[PROJECT]**

## 47. Phase N7.7.5 — SmartChannel typography parity correction [PROJECT]

N7.7.5는 현재 확인된 SmartChannel text 문제 세 개만 함께 교정한다. 대상은 source-known
copy의 false overflow, `naver_smartchannel.text_overflow` 한국어 번역 누락, 그리고
`PSD_TYPE_TOKEN_3cb00cba41e436f4` headline raster의 PSD 대비 +1px 수직 차이다. Font binary,
source font identity, font size, tracking, fill color, source baseline, source box와 template/object/
fixed-component 좌표는 변경하지 않는다. **[PROJECT]**

### 47.1 Actual horizontal raster boundary [PROJECT]

SmartChannel text overflow의 최종 판정 근거는 fractional glyph advance가 아니라 production과
같은 `fillText` primitive, font, size, tracking, origin 및 raster baseline을 사용한 격리 alpha
scan이다. Diagnostic surface는 layout box로 clip하지 않고 production canvas보다 넓게 생성한다.
`actualRasterBounds`는 일반적인 `x/y/width/height` bbox로 유지하고, 판정용
`actualRightEdge`는 `bounds.x + bounds.width - 1`인 마지막 non-transparent pixel의 포함 좌표다.
Source-effective `rightBoundary`는 해당 PSD layer의 `pixelBounds[2]`이며, 다음 조건이면
`NAVER_SMARTCHANNEL_TEXT_OVERFLOW` ERROR다. **[PROJECT]**

1. visible alpha pixel이 없거나 `actualRightEdge > rightBoundary`
2. `actualRightEdge > 749`여서 750px final canvas에서 clip되는 경우
3. 넓은 diagnostic surface 자체의 우측 끝까지 alpha가 닿아 진단이 clip된 경우

Character/grapheme count hardcode, arbitrary padding, font/tracking 축소, validator disable 또는
severity downgrade는 금지한다. `measuredWidth`는 진단 호환 필드로 유지하지만 overflow decision
source가 아니다. `horizontalOverflowEvidence`는 measured width, actual raster bounds,
right boundary, actual right edge, decision basis, overflow 및 clipping 상태를 additive하게 기록한다.
**[PROJECT]**

대표 `NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE`의 source-known 결과는
다음과 같다. **[TOOL_OUTPUT]**

| Role | Copy length | Measured advance | Actual raster | Right boundary | Actual right edge | Result |
|---|---:|---:|---|---:|---:|---|
| Headline 1/2 | 14 | `401.1700096130371` | H1 `(304,77,400,32)`, H2 `(304,125,400,32)` | 704 | 703 | PASS |
| Subcopy | 17 | `403.3300025939938` | `(305,177,401,27)` | 705 | 705 | PASS |

동일 알고리즘에서 Korean headline 13/14/15는 PASS/PASS/OVERFLOW, subcopy 16/17/18은
PASS/PASS/OVERFLOW다. 같은 15 grapheme의 Latin/numeric/space/`%`/`+` sample은 실제 raster
폭에 따라 판정되므로 Korean 15와 결과가 다를 수 있다. **[TOOL_OUTPUT]**

### 47.2 Token-scoped PSD-to-Skia raster adapter [PROJECT]

Pinned `AppleSDGothicNeo-macOS19-Bold.otf`와 frozen 35px, tracking -50, fractional PSD baseline을
Skia로 rasterize한 source text를 감사한 결과, token
`PSD_TYPE_TOKEN_3cb00cba41e436f4`를 사용하는 visible non-guide headline layer 83개 모두 source
pixel top보다 정확히 +1px 아래였다. 같은 token/role에 `baselineDeltaY=-1`인
`PSD_TO_SKIA_HEADLINE_BOLD_35_KO_MINUS_1Y` adapter를 적용하면 83개 모두 top delta 0이 된다.
다른 token, role, font 또는 channel에는 적용하지 않는다. **[TOOL_OUTPUT]**

Adapter는 source `baselineY`, expected origin, box 및 pixel bounds를 재작성하지 않는다. Report의
`baselineY`는 source 값을 유지하고 실제 draw coordinate는 additive `rasterBaselineY`에 기록한다.
대표 H1/H2는 source top `77/125`, runtime before `78/126`, runtime after `77/125`이며 Regular
subcopy는 `177`로 변하지 않는다. **[PROJECT]**

### 47.3 Localization, determinism, and acceptance [PROJECT]

Error Registry의 `NAVER_SMARTCHANNEL_TEXT_OVERFLOW`는 안정된 message key
`naver_smartchannel.text_overflow`를 유지한다. Desktop `ko-KR` registry에는
`텍스트가 스마트채널 허용 영역을 벗어났습니다.`를 등록하며 hardcoded UI string 또는
missing-translation fallback을 사용하지 않는다. **[PROJECT]**

대표 source-known input 3회의 PNG SHA-256과 pixel fingerprint는 각각 단일 값이어야 한다.
SmartChannel 120개 template은 각 3회 렌더, compact 160/200 및 280 CTA 11개 option을 포함해
120/120 PASS, new font/validator error 0, crash 0이어야 한다. Kakao frozen goldens,
NAVER fixed components와 non-SmartChannel, FREEFORM, platform-composed는 회귀 없이 유지한다.
Debug boundary overlay는 production output에 합성하지 않는다. 추가 사용자 오류가 예상되므로
golden rebase는 수행하지 않고 `readyForGoldenRebase=false`를 유지한다. **[PROJECT]**

### 47.4 Version and evidence [PROJECT]

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.21.3 | 1.21.4 | Current-known typography parity corrections |
| Renderer Core | 0.8.5 | 0.8.6 | Actual raster boundary validator and token-scoped adapter |
| Validator/Error Registry | 1.8.0 | 1.8.1 | Stable overflow condition clarification; code/key unchanged |
| SmartChannel Template Contract | 1.10.0 | 1.10.0 | Source template geometry unchanged |
| Typography Registry | 1.5.0 | 1.6.0 | Add deterministic raster adapter and overflow decision contract |
| Desktop/i18n/package | 0.9.8 | 0.9.9 | Korean localization and corrected Core packaging |

Machine-readable audit는
`contracts/audits/naver-smartchannel-typography-parity-n7-7-5.json`, 구현 보고서는
`docs/implementation/naver-smartchannel-typography-parity-correction-n7-7-5.md`, 재현 자료는
`artifacts/n7-7-5/`에 둔다. Font/TTC/OTF SHA-256은 N7.7.4 값에서 변경하지 않으며 runtime
network access는 계속 금지한다. **[PROJECT]**
