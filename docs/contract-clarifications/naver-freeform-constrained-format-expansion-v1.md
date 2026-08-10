# N4 NAVER FREEFORM constrained format clarification

## 문제

N3는 `NAVER_GFA/SMARTCHANNEL`의 Template-locked runtime만 제공했다. Naver의 정적
이미지 배너(모바일 DA와 1:1)는 기존 FREEFORM Core의 Canvas ownership, output,
safe-area, alpha, filesize 의미와 연결되지 않아 runtime 가능한 machine contract가
없었다. Feed는 이미지/동영상/컬렉션을 설명하지만 최종 wrapper는 플랫폼이 구성한다.

## 결정

- 새 `FREEFORM_CONSTRAINED` LayoutMode를 만들지 않는다.
- `NAVER_MOBILE_DA`와 `NAVER_IMAGE_BANNER_1_1`을 기존
  `contracts/freeform-format-profiles.json`에 additive하게 등록한다.
- 두 profile은 `FREEFORM`, `RENDERER_COMPOSED`, `SINGLE`이며 Canvas는 각각
  `1250×560`과 `1200×1200`이다.
- Mobile DA는 `50000..250000` bytes, 1250×560, PNG/JPEG, opaque output, source-backed
  safe area/text limits를 machine-enforce한다.
- 1:1은 `80000..800000` bytes, PNG/JPEG, 1200×1200을 enforce한다. pt 기반 text 최소값과
  transparency/design rule은 px 환산이나 heuristic 없이 metadata로 보존한다.
- Renderer는 Plan을 수정하지 않는다. Safe area는 actual raster bounds를 기준으로
  Validator가 보고한다.
- Feed outer wrapper는 `PLATFORM_COMPOSED`이므로 N4에서 렌더하지 않는다. Feed single
  image source는 CATALOG_ONLY, collection/video는 deferred다.

## 근거

공식 페이지와 첨부의 URL, update date, SHA-256, page count 및 추출된 source values는
`contracts/naver-freeform-source-revision.json`에 고정했다.

- [Mobile DA guide](https://ads.naver.com/adguide/1474)
- [Image Banner 1:1 guide](https://ads.naver.com/adguide/1473)
- [Mobile DA Feed guide](https://ads.naver.com/adguide/1480)
- [SAFE AREA / minimum filesize notice](https://ads.naver.com/notice/18556)

## 영향 범위

FormatProfile registry는 `1.1.0 → 1.2.0`, Canonical 문서는 `1.18.0 → 1.19.0`,
Renderer Core는 `0.6.0 → 0.7.0`으로 minor bump한다. Integration `1.8.0`,
CreativeLayoutPlan `1.0.0`, Desktop `0.8.2`, global template contract `1.9.0`은
그대로 둔다. Desktop NAVER selector/UI는 구현하지 않는다.

## 호환성

기존 Kakao Template-locked/FREEFORM request와 SmartChannel request는 변경하지 않는다.
기존 profile에는 `profileVersion`/Naver constraint 필드가 없으므로 기존 pixel/request
fingerprint material은 동일하다. Naver profile만 profile version이 pixel fingerprint에
포함된다.

## 미해결 Blocker 및 범위 밖

- 1:1 transparency exact policy와 디자인/gradient/white-area의 기계적 알고리즘은
  `UNRESOLVED` 또는 `NON_MACHINE_ENFORCEABLE`로 남긴다.
- Feed wrapper, collection, video, Desktop NAVER UI, upload API, runtime network는 N5+
  범위다.
- 공식 업로드 승인이나 Photoshop byte parity를 보장하지 않는다.

## 원본 명세 변경 섹션

Canonical 문서 §36 전체를 추가하고, §18.1의 이전 `NAVER_GFA_IMAGE_BANNER`
`NOT_IMPLEMENTED` 문구를 N4 superseded snapshot으로 명시했다.
