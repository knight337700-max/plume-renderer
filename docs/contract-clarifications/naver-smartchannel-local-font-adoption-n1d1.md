# N1D.1 Local Exact Font Adoption & SF Audit Clarification

상태: `BLOCKED` — local files are external evidence only; exact identity not resolved.

## 결정

- 사용자 지정 `fonts-archive/AppleSDGothicNeo` main branch의 Bold/Medium/Regular/SemiBold TTF를 `.local-fonts/naver-smartchannel/`에만 둔다.
- `.gitignore`로 binary commit/bundle을 금지한다. 재배포 라이선스 보장을 주장하지 않는다.
- `NAVER_SMARTCHANNEL_FONT_DIR`를 trusted local directory 입력으로 사용하며 runtime network fetch는 금지한다.
- filename이 아니라 SFNT table identity를 판정 기준으로 사용한다.
- 네 파일의 실제 PostScript는 각각 `AppleSDGothicNeoB00`, `AppleSDGothicNeoM00`, `AppleSDGothicNeoR00`, `AppleSDGothicNeoSB00`이고 모두 expected exact name과 불일치한다. 따라서 네 파일 모두 `IDENTITY_MISMATCH`다.
- SFProDisplay-Bold 85개와 SFUIDisplay-Bold 64개는 `TEXT` parent/`HEADLINE` role의 hidden source-selectable text variants로 감사되어 `EXPORT_RENDERED_TEXT`로 분류한다. Guide-only가 아니므로 runtime inventory에서 제거하지 않는다.

## 영향

`contracts/naver-smartchannel-sf-font-audit.json`과 runtime policy의 local external evidence가
추가된다. `sourceOnlyNonRuntime`은 빈 배열이며, N2 blocker `runtime_font_exact_match_to_psd`는
유지된다. Kakao/FREEFORM semantics, geometry, output Golden, Desktop version은 변경하지 않는다.

## 보안/법적 경계

외부 파일은 trusted root 상대 참조로만 검증하고 PostScript/SHA-256/version을 확인한다.
파일은 local-only이며 bundle/redistribution permission을 추정하지 않는다. 파일을 대체할 때는
동일한 identity gate와 승인된 사용자 권한을 다시 확인해야 한다.
