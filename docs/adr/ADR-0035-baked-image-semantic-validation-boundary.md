# ADR-0035: baked image semantic은 자동 검증하지 않음

- 상태: Accepted (F3A)
- 결정: IMAGE asset 내부의 baked text/logo/button/product/shape를 OCR, CV,
  LLM으로 추정하지 않는다. Renderer-managed TEXT/LOGO의 bounds만 자동
  safe-zone 검증하고, 내부 semantic은 `MANUAL_REVIEW_REQUIRED`로 기록한다.
- 근거: source asset 내부 의미와 공식 safe-zone 위치를 현재 계약만으로
  deterministic하게 판정할 수 없다.
- 영향: 자동 업로드 승인이나 디자인 품질 판단을 주장하지 않는다.
