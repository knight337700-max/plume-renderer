# ADR-0033: Channel Compliance를 FormatProfile ID에 포함

- 상태: Accepted (F3A)
- 결정: 같은 pixel Canvas라도 Channel 규칙, safe zone, element allowlist,
  opacity/file-size가 다르면 별도 Profile ID를 사용한다.
- 근거: Display Native, Bizboard Expandable, Video Native, AdView는 raster
  primitive를 공유해도 매체 계약이 다르다.
- 영향: Renderer는 Profile을 선택하고 규칙을 검증하지만 Layout을 생성하지
  않는다. Profile metadata는 additive Integration Contract v1.6.0이다.
