# Retired SmartChannel external font resource record

This directory is retained only as a historical source record. SmartChannel runtime does
not read it, does not inspect system fonts, and does not accept an environment font
directory. The active renderer-owned resources are under
`assets/fonts/naver-smartchannel/` and are resolved by the trusted-root provider.

The expected local file names, OpenType identities, and SHA-256 values are retained in
`contracts/naver-smartchannel-runtime-font-policy.json` and
`contracts/naver-smartchannel-font-compatibility.json`. `licenseStatus` is
`NOT_CONFIRMED`; no redistribution claim is made. The active N7.7 contract records the
actual OpenType identities and SHA-256 values without fabricating names.

N5 `PLATFORM_COMPOSED` text is platform-owned and does not consume these fonts. Kakao
Spoqa assets remain separately governed by `assets/fonts/` and its OFL notice.
