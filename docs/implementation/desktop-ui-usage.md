# Desktop UI usage

1. `PNG 선택`에서 투명 제품 PNG 한 개를 선택한다.
2. 광고주체, Headline, Subcopy, 결과 폴더명을 입력한다.
3. 광고주체 문자열을 Headline 또는 Subcopy에 그대로 포함한다.
4. `Preview 검증`을 실행한다.
5. `VALID_PASS` 또는 `VALID_WARNING` 상태에서 출력 폴더를 선택한다.
6. `PNG 및 Manifest 저장`을 실행한다.

입력 변경 또는 제품 교체 시 기존 PASS는 즉시 무효화된다. ERROR는 export를 막고 WARNING은 표시하되 export를 허용한다. CTA와 Template, Canvas, Font, 좌표는 변경할 수 없다.

Guide 기본값은 켜짐이다. Object slot, text hard edge, 33px gap, 우측 48px margin을 DOM overlay로 표시하며 Preview와 output PNG bytes에는 포함되지 않는다.

성공 출력:

```text
<선택 폴더>/<결과 폴더명>/
├─ render-manifest.json
└─ output.png
```

같은 결과 폴더가 있으면 덮어쓰지 않는다.
