# MASK_SEMICIRCLE_RIGHT Rendering

이 구현은 `IMAGE_PRIMARY`를 crop/cover로 `(621,45,360,213)`에 렌더링한 뒤 pinned
analytic mask alpha를 곱한다. mask는 circle center `(801,225)` radius `180`의
circle-only alpha이며 logo cutout을 만들지 않는다. 기존 v2에서 사라졌던 우측 상단
영역은 같은 원호로 복원한다. source alpha와 mask alpha는 곱셈으로 보존하며
`alpha >= 1` trim, `alpha >= 8` layout visible 기준을 사용한다.

그 다음 copy를 고정 baseline `(48,120)` / `(48,178)`에 그린다. 선택적인
`LOGO_PRIMARY`가 제공된 경우에만 alpha trim 후 safe box `(847,24,126,44)`에
CENTER/CONTAIN overlay로 배치한다. PNG·alpha·transparent background만 필수이고
색상 제한은 없다. black/white/brand-color 원본을 보존하며, opaque background·empty·
overflow·upscale >1.5×는 결정적 오류다. 1× 초과 1.5× 이하의 upscale은 warning이다.
자동 색상 변환은 하지 않는다. 로고가 없어도 완전한 반원으로 정상 PASS다.

`renderMaskSemicircleRight`는 PNG-32를 반환하며 Integration adapter가 slot order,
placement provenance, mask digest, artifact IHDR와 validation issues를 확인한다.
Desktop Preview는 동일 bytes를 session token으로 저장하고 Export는 동일 입력/asset
digest를 재검증한 뒤 staging publish를 수행한다. preview-only 검정 배경 토글은
DOM/CSS layer이며 PNG에는 합성하지 않는다.

Runtime은 네트워크를 사용하지 않고 mask asset path는 project-relative registry 값만
허용한다. 기준 PNG는 읽기 전용 reference fixture로만 사용한다.
