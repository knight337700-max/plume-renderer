# Kakao Moment FREEFORM Format Catalog v1

상태: `F3A_FIXED_CANVAS_IMPLEMENTED`
기준: Canonical 문서 `1.11.0`, Integration Contract `1.6.0`,
CreativeLayoutPlan `1.0.0`, Template Contract `1.6.0`, FormatProfile Registry `1.1.0`

이 카탈로그는 카카오모먼트 공식 가이드에서 확인된 정적 이미지 규격을
Renderer 실행 Profile로 분리한다. 가이드의 `이상` 크기는 `[OFFICIAL]`
`MINIMUM_WITH_RATIO`로 보존하고, v1 Renderer Canvas는 공식 최소 크기를
결정적 출력 크기로 선택한 `[PROJECT] OFFICIAL_MINIMUM_SIZE`다. 이 선택은
매체 가이드의 허용 범위를 변경하거나 업로드 승인을 보장하지 않는다.

## Fixed Profiles

| Profile | Canvas | 공식 규칙 | 용량 | 상태 |
|---|---:|---|---:|---|
| `KAKAO_DISPLAY_NATIVE_2_1` | 1200×600 | `MINIMUM_WITH_RATIO`, 2:1 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_DISPLAY_NATIVE_1_1` | 500×500 | `MINIMUM_WITH_RATIO`, 1:1 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_DISPLAY_NATIVE_9_16` | 720×1280 | `MINIMUM_WITH_RATIO`, 9:16 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_DISPLAY_NATIVE_4_5` | 800×1000 | `MINIMUM_WITH_RATIO`, 4:5 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_DISPLAY_CATALOG_SLIDE_1_1` | 500×500 | `MINIMUM_WITH_RATIO`, 1:1 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_VIDEO_NATIVE_THUMBNAIL_16_9` | 1280×720 | `MINIMUM_WITH_RATIO`, 16:9 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_VIDEO_NATIVE_THUMBNAIL_9_16` | 720×1280 | `MINIMUM_WITH_RATIO`, 9:16 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_VIDEO_NATIVE_SLIDE_1_1` | 500×500 | `MINIMUM_WITH_RATIO`, 1:1 | ≤500000 bytes | IMPLEMENTED |
| `KAKAO_BIZBOARD_EXPANDABLE_IMAGE_2_1` | 1200×600 | `MINIMUM_WITH_RATIO`, 2:1 | <500000 bytes | IMPLEMENTED |
| `KAKAO_BIZBOARD_EXPANDABLE_MULTI_1_1` | 1080×1080 | `MINIMUM_WITH_RATIO`, 1:1 | <1000000 bytes | IMPLEMENTED |
| `KAKAO_ADVIEW_FULL_IMAGE` | 720×1560 | `EXACT` | ≤400000 bytes | IMPLEMENTED |
| `KAKAO_ADVIEW_COMPACT_IMAGE` | 1280×720 | `EXACT` | ≤400000 bytes | IMPLEMENTED |
| `KAKAO_ADVIEW_CAROUSEL_IMAGE` | 1280×720 | `EXACT` | ≤400000 bytes | IMPLEMENTED |
| `KAKAO_ADVIEW_SHARE_BUBBLE_IMAGE` | 1280×720 | `EXACT` | 별도 공식 제한 미기록 | IMPLEMENTED |
| `KAKAO_ADVIEW_SCROLL_IMAGE` | width 720, height 360–7800 | VARIABLE_HEIGHT | ≤400000 bytes | CATALOG_ONLY |

수치는 공식 가이드에서 제공된 값만 `[OFFICIAL]`로 분류한다. `500KB`, `1MB`,
`400KB`의 byte comparator는 저장소의 보수적인 decimal-byte 해석
`500000`, `1000000`, `400000` `[PROJECT_CONSERVATIVE]`다. `미만`은 `LT`,
`이하`는 `LTE`로 기계적으로 고정한다.

## Output and compliance boundary

- Renderer 입력은 명시적인 `PNG` 또는 canonical `JPEG`를 받는다. 기존 `JPG`
  문자열은 호환 alias다. 자동 PNG/JPEG 전환은 하지 않는다.
- JPEG는 기존 Sharp/libvips encoder로 sRGB, alpha 불가, metadata 제거,
  progressive=false, chroma `4:2:0`으로 인코딩한다. `AUTO_FIT`은
  `92,88,84,80,76,72,68,64,60,56,52,48` 첫 통과 ladder다. 48에서도
  제한을 넘으면 ERROR다. `[PROJECT]`
- JPEG와 `TRANSPARENT` background 조합은
  `KBR-FREEFORM-JPEG-TRANSPARENT-BACKGROUND-NOT-SUPPORTED`로 차단하며 자동
  흰색 flatten을 하지 않는다.
- `requiresOpaqueOutput: true` Profile은 최종 artifact alpha를 검사한다.
  Video Thumbnail과 AdView는 근거가 없으므로 `UNSPECIFIED`를 유지한다.
- 2:1 safe zone은 `top40,left40,right40,bottom90` 권장(WARNING), 9:16은
  `top89,bottom89,left47,right47` 필수(ERROR)와 저해상도 권장
  `top279,bottom438`(WARNING), 4:5는 `top100,bottom100,left40` 필수(ERROR)다.
  Expandable Image는 edge 50과 top-right 84×78 close-button 영역을 ERROR로
  검사한다. 정확한 CTA 영역과 4:5 우측 하단 UI 영역은 추정하지 않고
  `MANUAL_REVIEW_REQUIRED`로 남긴다.
- Expandable Multi는 `IMAGE`만 허용한다. 법정 고지문구의 PSD 예외 영역은
  구현하지 않으며 필요한 소재에는 `PROFILE_NOT_SUITABLE_FOR_REQUIRED_DISCLAIMER_V1`
  상태를 적용한다.
- 이미지 내부에 baked된 텍스트·로고·버튼·제품 의미는 OCR/CV/LLM으로 분석하지
  않는다. 해당 검토는 `[MANUAL]`이다.

## Collection and variable canvas

Catalog에는 collection min/max metadata를 보존하지만 이번 단계의 request는
단일 `CreativeLayoutPlan`과 단일 artifact만 실행한다. Multi-artifact collection은
`DEFERRED`다. AdView Scroll은 `CONTRACT_BLOCKED_VARIABLE_CANVAS` catalog entry만
가지며 실행 시 `KBR-FREEFORM-FORMAT-NOT-IMPLEMENTED`를 반환한다. 기존 fixed
canvas schema를 범위형으로 변경하지 않는다. 후속 계약은 F3B다.

## Sources and non-goals

공식 Source A–E의 링크와 확인값은 Phase F3A prompt에 고정된 조사 결과를
반영한다 `[OFFICIAL]`. 메시지 광고, 개인화 메시지, 보장형/PSD Layer 소재,
상품 Feed 자체, Video raster는 이 catalog의 대상이 아니다. 별도 분석과 계약
버전 없이는 FREEFORM Profile로 승격하지 않는다.
