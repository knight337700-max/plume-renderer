# Naver SmartChannel renderer-owned font assets

## N7.7 PSD-exact runtime resources

The SmartChannel renderer uses the three SHA-256-pinned Apple SD Gothic Neo
resource files below for visible final roles. They were copied byte-for-byte
from the already-present `.local-fonts/naver-smartchannel/` source candidate;
no download, substitution, or OS font lookup was used.

| Logical token | File | SHA-256 | Binary PostScript identity | Runtime role |
|---|---|---|---|---|
| `NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD` | `AppleSDGothicNeo-Bold.ttf` | `a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b` | `AppleSDGothicNeoB00` | `HEADLINE`, `HEADLINE_LINE_2` |
| `NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR` | `AppleSDGothicNeo-Regular.ttf` | `f44eec027992b99dc25de0229c5726fe209a6cb80761aaef98d050cdc0bc6cfe` | `AppleSDGothicNeoR00` | `SUBCOPY`, `THIRD_LINE`, `FOURTH_LINE`, `DISCLOSURE_LINE_1/2` |
| `NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD` | `AppleSDGothicNeo-SemiBold.ttf` | `a9c5ffb4dadce253d8748b18019954a8af19b7cfcc3b586fce64ef1f6bd71492` | `AppleSDGothicNeoSB00` | `APP_CTA_TEXT` |

The PSD-declared labels and the binary name-table identities are both
recorded in the machine-readable registries. The binaries use stable
renderer registration aliases matching the logical roles. This is an
identity record, not a redistribution claim: `REDISTRIBUTION_STATUS_UNCONFIRMED`
remains the license status until a separate license grant is supplied.

`AppleSDGothicNeo-Medium`, `SFProDisplay-Bold`, and `SFUIDisplay-Bold` remain
source-only/non-runtime because N7.6 found no final visible renderer
contribution and no approved SF binary.

## Historical Nanum assets

These two unmodified TTF binaries were copied from the user-provided
`nanum-barun-gothic` directory for the N7.4 continuation. Runtime lookup is
PostScript-exact and fail-closed; no OS fallback or network fetch is permitted.

| File | Role | PostScript | SHA-256 |
|---|---|---|---|
| `NanumBarunGothicBold.ttf` | Main / declared role weight 700 | `NanumBarunGothicBold` | `39bba4cd9bd2986143825c8654abbb62443914ab33b346c0c929a916f5d98bf2` |
| `NanumBarunGothic.ttf` | Sub/Disclaimer / weight 400 | `NanumBarunGothic` | `9b872773134e2e4d8c0b17021266786576db06c843ede0d0b523b214a450756c` |

Embedded metadata identifies NHN Corporation and FONTRIX. The user supplied the
files as official/legal assets; no separate license file was provided, so the
registry does not claim one.
