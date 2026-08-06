# Desktop UI usage

1. `제품 이미지 선택`에서 PNG/JPG/JPEG 한 개를 선택한다. OBJECT_RIGHT는 투명 PNG만 허용하고, THUMBNAIL_BOX_RIGHT는 배경 포함 PNG/JPG/JPEG를 허용한다.
2. 광고주체, Headline, Subcopy, 결과 폴더명을 입력한다.
3. 광고주체 문자열을 Headline 또는 Subcopy에 그대로 포함한다.
4. `Preview 검증`을 실행한다.
5. `VALID_PASS` 또는 `VALID_WARNING` 상태에서 출력 폴더를 선택한다.
6. `PNG 및 Manifest 저장`을 실행한다.

입력 변경 또는 제품 교체 시 기존 PASS는 즉시 무효화된다. ERROR는 export를 막고 WARNING은 표시하되 export를 허용한다. CTA와 Template, Canvas, Font, 좌표는 변경할 수 없다.

Headline/Subcopy 입력 하단에는 Core 검증이 완료된 뒤에만 다음 metrics가 표시된다.

```text
한글 환산 10.5 / 12자 · 실제 폭 510 / 585px · 공백 포함 15자
```

Headline baseline은 `120`, Subcopy baseline은 `178`, text X는 `48`이다. 527~585px은 WARNING, 586px 이상 또는 hard right edge `633` 초과는 ERROR이며, Korean-equivalent unit 초과도 ERROR다. 연속 내부 공백은 자동 수정하지 않고 WARNING으로 남긴다.

Guide 기본값은 켜짐이다. Object slot, text hard edge, 33px gap, 우측 48px margin을 DOM overlay로 표시하며 Preview와 output PNG bytes에는 포함되지 않는다.

성공 출력:

```text
<선택 폴더>/<결과 폴더명>/
├─ render-manifest.json
└─ output.png
```

같은 결과 폴더가 있으면 덮어쓰지 않는다.
