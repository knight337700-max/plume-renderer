# Kakao Bizboard Local Renderer Specification v1

- **Canonical path:** `docs/kakao-bizboard-renderer-spec-v1.md`
- **Document version:** 1.4.0
- **Status:** Frozen Implementation Contract — Phase C3 integration boundary
- **Checked date:** 2026-08-06 (KST)
- **Owner:** Local Renderer Project
- **Target:** `KAKAO_MOMENT / BIZBOARD / OBJECT_RIGHT / 1029×258`

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

Phase C2a 이후 계약 우선순위는 이 문서의 **14. Phase C2a Text Baseline and Copy Limit**, `contracts/`의 machine-readable contract, Phase C0 freeze, 본문의 나머지 조항 순이다. 본문에 `LEGACY / NON-NORMATIVE`로 표시된 이전 Schema snapshot은 구현 근거로 사용하지 않는다. **[PROJECT]**

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
- `THUMBNAIL_MULTI_RIGHT`, `MASK_SEMICIRCLE_RIGHT`, `THUMBNAIL_BOX_RIGHT`는 향후 템플릿 확장 참고 자료이며 v1 구현 범위와 Acceptance 대상이 아니다.

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

**Kakao Bizboard Local Renderer**는 구조화된 카피와 투명 제품 PNG 한 개를 입력받아 카카오 비즈보드 우측 오브젝트형 배너 한 개를 로컬에서 생성하고, 자동 Validator 결과의 `ERROR`가 0개일 때만 최종 PNG 다운로드를 허용하는 독립 실행형 도구다.

## 2.2 목표

1. 구조화 입력으로 반복 가능한 비즈보드 소재 생성
2. 템플릿 좌표와 렌더링 결과의 결정성 확보
3. 파일 규격·텍스트 폭·오브젝트 영역·CTA 호환성 자동 검증
4. `ERROR 0` 다운로드 게이트 강제
5. 기존 플룸 서비스와의 런타임·데이터·배포 의존성 제거

## 2.3 v1 지원 범위

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

## 6.1 입력 조건

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
6. Phase C0 검사 결과 Bold와 Regular 실제 파일이 없으므로 `UNRESOLVED_ASSET`이다. `assets/fonts/README.md`와 `contracts/font-asset-registry.json`이 해소되기 전 텍스트 Renderer 및 Golden PNG 구현은 BLOCKED다. **[PROJECT]**

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
- [ ] 제품 PNG 이외 포맷 차단
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

## 10.8 UI 최소 요구사항

1. 제품 PNG 선택
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

`render-manifest.json`은 자신의 SHA-256을 MUST NOT 포함한다. `manifestDigest`, `pngDigest`, `manifestPath`, `pngPath`, `downloadAllowed`, `status`, `errors`, `warnings`는 response envelope에만 둔다.

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

최종 `output.png` 존재는 ERROR 0 publish 완료를 의미해야 한다. 최종 PNG rename 후 response 생성 실패가 발생하더라도 Core는 published 두 파일을 재검증하여 일관된 response를 복구하거나 둘 다 정리해야 한다.

## 13.13 Runtime Network

- Runtime network access: `PROHIBITED`
- Build dependency resolution: lockfile 기반
- Offline install: pnpm store가 준비된 환경에서만 가능

외부 API, 원격 폰트, CDN, telemetry, update check, analytics, Railway, plume 서버, 카카오 API 업로드를 금지한다. 신규 PC의 최초 `pnpm install`까지 완전 오프라인이라고 주장하지 않는다.

## 13.14 Golden과 Fixture

v1 공식 지원 플랫폼은 Windows 10/11 x64다. 동일 입력, asset, dependency version, runtime 조건에서 byte-equal PNG를 목표로 하며 동일 입력 3회 SHA-256이 같아야 한다. 다른 OS의 pixel tolerance는 v1 Acceptance에 포함하지 않는다.

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

이 절은 Canonical 문서 `1.4.0`의 `[PROJECT]` 통합 경계 결정이다. Renderer는 Agent, Plume, OpenAI 또는 원격 서비스의 존재를 알지 못한다. Agent가 만든 Plan과 Lab에서 만든 Plan은 동일한 `Integration Contract v1.0.0` JSON Schema와 동일한 Core Adapter를 통과해야 한다. 이번 절은 특정 Agent의 내부 ID, Prompt, Queue, DB 또는 업로드 승인 규칙을 정의하지 않는다.

## 15.1 버전과 공존

| 계약 | 이전 | 현재 | 사유 |
|---|---:|---:|---|
| Canonical document | `1.3.0` | `1.4.0` | Agent-independent Integration Contract boundary |
| Template Contract | `1.2.0` | `1.2.0` | 좌표·현재 OBJECT_RIGHT 픽셀 변경 없음 |
| Input Schema | `1.2.0` | `1.2.0` | 기존 공개 Renderer Input 유지 |
| Output Schema | `2.0.0` | `2.0.0` | 기존 Core response/manifest 유지 |
| Desktop application | `0.2.1` | `0.3.0` | Renderer Lab Placement Plan 기능 |
| Integration Contract | 없음 | `1.0.0` | 별도 JSON namespace/package 추가 |

기존 Desktop/CLI Input을 제거하거나 대체하지 않는다. `packages/renderer-contract`는 직렬화 가능한 타입·Schema·검증·fingerprint·Resolver 인터페이스를 제공하고, Adapter는 이를 기존 OBJECT_RIGHT Core Input 모델로 변환한다. Core는 Integration Input에 없는 값(카피, asset, slot, crop)을 추측하거나 자동 보정하지 않는다.

## 15.2 Serializable Asset Descriptor와 Runtime Resolver

Integration JSON의 Asset Descriptor는 `assetId`, PNG/JPEG/WebP `mimeType`, 선택적 declared dimensions/checksum, 그리고 `assetRef`(`DESKTOP_ASSET_TOKEN`, `INTEGRATION_ASSET_TOKEN`, `FIXTURE_ASSET_ID`)만 포함한다. Blob, Uint8Array, OS 절대 경로는 JSON 계약에 포함하지 않는다. Runtime에서는 `RendererAssetResolver.resolve(assetRef)`가 실제 bytes와 resolved MIME을 반환하고, Core가 bytes의 SHA-256·decode·dimensions·alpha를 직접 검증한다. 선언값과 실제값이 다르면 ERROR이며 `analysis`는 검증 가능한 힌트일 뿐 신뢰 원본이 아니다. Canonical JSON, request/pixel fingerprint에는 절대 경로를 포함하지 않는다.

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

`RendererIntegrationInputV1`의 `schemaVersion`은 `1.0.0`이다. 현재 실제 구현은 `output.mimeType=image/png`만 지원한다. JPEG를 Schema 또는 Capability에 IMPLEMENTED로 표시하지 않는다. `RendererIntegrationOutputV1`은 `PASS` 또는 `BLOCKED`이며 ERROR가 하나라도 있으면 artifact metadata와 다운로드를 제공하지 않는다. `AppliedImagePlacement`에는 requested/resolved crop, source pixel crop, destinationRect, scale, anchor, alphaTrimApplied, candidate ID를 기록하고 `changedFromRequestedPlan`은 v1에서 항상 `false`다.

Capability Registry에서 `KAKAO_BIZBOARD_OBJECT_RIGHT`만 `IMPLEMENTED`다. 기본 정책은 `ALPHA_TRIM_CONTAIN`, semantic placement는 `NOT_REQUIRED`, 허용 정책은 `ALPHA_TRIM_CONTAIN`, manual/agent placement는 현재 `false`다. Thumbnail, mask, native, Naver 지면은 `NOT_IMPLEMENTED`이며 정책 표현 가능성과 실제 Renderer 지원을 혼동하지 않는다.

## 15.5 Fingerprint

`artifactChecksumSha256`은 실제 최종 PNG bytes의 SHA-256이다. `pixelFingerprint`는 pixel-affecting canonical input, 실제 asset digest, policy/fit/resolved crop, 실제 사용되는 anchor/encoding, Template Contract `1.2.0`을 포함하고 source/confidence/rationale/warnings/timestamp/absolute path/token 문자열 자체는 제외한다. 현재 Renderer가 focal point를 pixel 계산에 사용하지 않으므로 focal point는 pixel fingerprint에 포함하지 않는다. `requestFingerprint`는 전체 Integration Input의 Canonical JSON을 기반으로 하여 provenance 차이를 보존한다. 동일 Placement의 `MANUAL`과 `AGENT`는 동일 pixelFingerprint와 동일 artifact bytes를 만들고 requestFingerprint만 달라진다. 기존 `renderFingerprint`를 사용해야 하는 응답에서는 그 의미를 `pixelFingerprint`와 동일하게 고정한다.

## 15.6 Renderer Lab과 금지 범위

Desktop Lab은 Capability, policy/fit/anchor/protection, crop/focal/candidate 입력, 적용 destinationRect/validation, Plan JSON Import/Export를 표시한다. OBJECT_RIGHT에서 수동 Crop control은 disabled와 사유를 표시한다. JSON Import는 `additionalProperties:false` Schema와 안정적인 KBR 오류 매핑을 사용하며 누락값을 추측하거나 자동 보정하지 않는다. Agent fixture도 동일 Import 경로로 통과한다. OpenAI 호출, Plume 연결, Agent 구현, Object Detection, 자동 후보 생성, 미지원 지면 Renderer 구현, 원격 배포와 업로드는 이 계약 범위에 없다.

## 15.7 Acceptance

기존 C2a Golden `20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`은 동일해야 한다. Integration Contract는 Schema parse/ID/unknown-field, normalized geometry, policy matrix, Candidate/subject protection, asset checksum/dimension, manual-agent fingerprint equivalence, Adapter bridge, Lab round trip을 자동 검증한다. 공식 지원 플랫폼은 계속 Windows 10/11 x64이며, 다른 OS의 pixel tolerance는 추가 계약 버전에서 다룬다.
