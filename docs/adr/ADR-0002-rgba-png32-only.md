# ADR-0002: v1 출력은 RGBA PNG-32만 지원

- Status: Accepted
- Date: 2026-08-05
- Classification: `[PROJECT]`

## Context

공식 가이드는 PNG-24와 PNG-32를 허용하지만, 투명 배경과 결정적 출력 검증을 동시에 계약하면서 `PNG-24`, `hasAlpha`의 의미가 모호했다.

## Decision

v1 Renderer 출력은 PNG IHDR 기준 다음으로 고정한다.

- format: `PNG`
- color type: `6` (`RGBA`)
- bit depth: `8`
- alpha: 필수
- width: `1029`
- height: `258`

PNG-24 출력은 공식 허용 범위에는 남지만 이 프로젝트 v1 지원 범위에서는 제외한다.

## Consequences

- Output Validator가 IHDR을 결정적으로 검사할 수 있다.
- palette PNG, grayscale+alpha, RGB PNG를 v1 산출물로 publish할 수 없다.
- Canvas 및 좌표 계약은 바뀌지 않는다.
