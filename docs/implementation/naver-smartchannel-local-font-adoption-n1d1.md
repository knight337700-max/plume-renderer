# N1D.1 implementation note

## Local external resource

`NAVER_SMARTCHANNEL_FONT_DIR` (미설정 시 `.local-fonts/naver-smartchannel`)에서 네 TTF를
읽고, 실제 bytes SHA-256 및 SFNT name/OS/2 table을 검사한다. 현재 네 파일은 모두 exact
PostScript/weight identity mismatch로 승인되지 않는다. binary는 Git에 포함되지 않는다.

## SF audit

`scripts/audit-naver-smartchannel-sf-font-layers.mjs`가 N1C PSD metadata의 SF text layer를
전수 순회한다. `TEXT` parent, `HEADLINE` role, non-guide인 hidden English variants는
`EXPORT_RENDERED_TEXT`로 보수적으로 분류한다. 결과는
`contracts/naver-smartchannel-sf-font-audit.json`에 저장된다.

## Verification

```text
node scripts/audit-naver-smartchannel-sf-font-layers.mjs
node scripts/generate-naver-smartchannel-runtime-font-policy.mjs
node scripts/verify-naver-smartchannel-font-policy.mjs
```

N1D.1은 SmartChannel raster/UI/Golden을 구현하지 않는다.
