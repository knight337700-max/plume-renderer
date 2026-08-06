# Phase C2 Manual Acceptance checklist

Canonical `docs/kakao-bizboard-renderer-spec-v1.md` 9.3의 번호와 의미를 그대로 사용한다.

자동 package smoke와 E2E는 PASS했지만 사람이 광고·시각·정책 판단을 수행하지 않았으므로 M-001~M-005를 허위 PASS 처리하지 않는다.

## Execution record

| ID | Canonical 의미 | 수행자 | 날짜 | 앱 버전 | 입력 fixture | 상태 | 증거 | 비고 |
|---|---|---|---|---|---|---|---|---|
| M-001 | 카카오 제작툴 기준 파일 비교 | NOT_ASSIGNED | 2026-08-06 | 0.2.1 | OBJECT_RIGHT reference + basic fixture | `NOT_EXECUTED` | `evidence/packaged-app-empty-state.png`, 자동 bbox/reference tests | 100% 육안 비교와 시각 균형 사람 승인 필요 |
| M-002 | 광고주체 적합성 | NOT_ASSIGNED | 2026-08-06 | 0.2.1 | 자코모 synthetic fixture | `NOT_EXECUTED` | Core advertiser containment test | 실제 광고주체 인정 여부 사람 판단 필요 |
| M-003 | 제품 이미지 품질 | NOT_ASSIGNED | 2026-08-06 | 0.2.1 | synthetic blue product | `NOT_EXECUTED` | Alpha Trim integration tests | 실제 후보 제품의 합성·저해상도·왜곡 검토 필요 |
| M-004 | 문구·심사 정책 | NOT_ASSIGNED | 2026-08-06 | 0.2.1 | synthetic Korean copy | `NOT_EXECUTED` | Validator E2E | 허위·과장·법적 고지·권리 검토 필요 |
| M-005 | CTA·랜딩 일치 | NOT_ASSIGNED | 2026-08-06 | 0.2.1 | CTA NONE | `NOT_EXECUTED` | CTA NONE registry/security tests | v1은 CTA NONE만 활성. 실제 랜딩의 수동 확인 필요 |
| M-006 | 카카오모먼트 외부 UAT | USER | 미정 | 0.2.1 | 사용자가 선택할 실제 후보 소재 | `PENDING_EXTERNAL_UAT` | 없음 | 로그인·업로드·계정 접근을 자동 수행하지 않음 |

## Automated prerequisites

- unpacked package smoke: PASS
- portable package smoke: PASS
- Preview/export PNG SHA-256: `20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`
- Runtime network request count: 0
- package evidence: `evidence/package-smoke-summary.json`

## M-006 user procedure

1. portable 앱으로 실제 후보 PNG와 manifest를 생성한다.
2. 사람이 카카오모먼트 소재 등록 화면에 로그인한다.
3. `output.png`를 업로드하고 플랫폼 Preview의 잘림·배경·가독성을 확인한다.
4. 실제 심사 결과와 공식 사유를 이 checklist의 별도 실행 record에 남긴다.
5. 계약과 다른 공식 사유가 확인되면 기존 계약을 임의 수정하지 않고 새 contract version을 제안한다.
