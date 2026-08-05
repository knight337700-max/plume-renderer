# Manual UAT guide

수동 UAT는 `tests/manual/manual-acceptance-checklist.md`의 Canonical M-001~M-006 의미를 그대로 사용한다.

M-001~M-005는 사람이 portable 앱을 열고 실제 후보 제품·카피·랜딩 자료로 판단한다. 자동 테스트나 Codex가 정책·시각 품질을 대신 승인하지 않는다.

M-006은 사용자가 직접 카카오모먼트 소재 등록 화면에서 수행한다. 앱과 이 저장소는 로그인, 업로드, API 호출 또는 계정 정보를 요구하지 않는다. 결과는 실제 플랫폼 메시지와 함께 별도 기록한다.

미실행 상태는 `NOT_EXECUTED`, 외부 업로드 대기는 `PENDING_EXTERNAL_UAT`로 기록한다. 심사 성공을 추정하거나 보장하지 않는다.
