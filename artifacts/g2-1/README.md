# Google Static G2.1 Visual Review Package

상태: `AWAITING_USER_VISUAL_ACCEPTANCE`

이 디렉터리는 G2 후보 14개를 사용자에게 제시하기 위한 review evidence다. 후보 PNG/JPEG를
재렌더링하거나 수정하지 않았고, 이 단계에서 Golden registry를 만들지 않는다.

검토 시작점:

- HTML index: `artifacts/g2/google-static-candidate-index.html`
- immutable review manifest: `artifacts/g2-1/google-static-review-manifest.json`
- 원본 artifact 디렉터리: `artifacts/g2/google-static-candidates/`

HTML index의 각 카드에는 원본 파일 링크, 1× native-size viewport, 2× 확대 viewport가 있다.
원본 파일은 repository-relative 경로로 manifest에 고정되어 있으며, 검토 중 candidate를
덮어쓰면 manifest digest가 더 이상 일치하지 않는다.

## 공통 체크리스트

각 후보에서 다음을 확인한다.

- canvas가 잘리거나 늘어나지 않고, 예상 edge가 일관되다.
- source asset 비율과 explicit crop/contain 계획이 일치한다.
- 원치 않는 투명 여백, 배경색, alpha halo, clipping, blur가 없다.
- artifact에 debug path, SHA, profile 식별 문자열이 노출되지 않는다.
- Google platform UI/chrome, headline, CTA, URL, business name의 자동 rasterization이 없다.
- preview overlay가 최종 artifact에 포함되지 않는다.

## 프로필별 체크리스트

- `GOOGLE_MARKETING_LANDSCAPE_1_91`: `MANUAL_CROP`, 1200×628
- `GOOGLE_MARKETING_SQUARE_1_1`: `SEMANTIC_CROP_COVER`, 1200×1200
- `GOOGLE_MARKETING_PORTRAIT_4_5`: `CENTER_CONTAIN`, 960×1200
- `GOOGLE_RDA_VERTICAL_9_16`: `CENTER_CONTAIN`, 900×1600; source discrepancy INFO는 결함이 아니다.
- `GOOGLE_DEMAND_GEN_VERTICAL_9_16`: `MANUAL_CROP`, 1080×1920; safe-zone source-required INFO는 결함이 아니다.
- `GOOGLE_LOGO_SQUARE_1_1`: `ALPHA_TRIM_CONTAIN`, 1200×1200; crop 금지.
- `GOOGLE_LOGO_LANDSCAPE_4_1`: `CENTER_CONTAIN`, 1200×300; crop 금지.
- `GOOGLE_DG_UPLOAD_300X250`, `336X280`, `728X90`, `970X90`, `160X600`, `300X600`, `320X50`: explicit `NONE` plan, 실제 canvas 유지, encoded bytes ≤ 150,000.

## 응답 형식

전체가 승인되면 다음 문자열만 명시한다.

```text
ACCEPT_ALL_GOOGLE_G2_CANDIDATES
```

하나라도 수정이 필요하면 다음 형식으로 거절 사유와 profile ID를 적는다.

```yaml
REJECT_GOOGLE_G2_CANDIDATES:
  - profile_id: GOOGLE_...
    reason: "구체적인 시각적 문제"
```

“괜찮아”, “진행해” 같은 모호한 표현은 visual acceptance로 해석하지 않는다.
