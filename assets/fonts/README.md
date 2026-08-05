# Pinned font assets

Phase C1에서 Spoqa 공식 저장소의 legacy `Spoqa Han Sans` 원본 TTF를 고정했다. `Spoqa Han Sans Neo` 또는 시스템 폰트는 사용하지 않는다.

## 상태

- Registry status: `RESOLVED_ASSET`
- 실제 텍스트 Renderer 선행 Blocker: `NO`
- 시스템 폰트 fallback: 금지
- Runtime 원격 폰트 다운로드: 금지
- Registry SHA-256 불일치: 렌더 중단

## 필요한 파일

| Asset ID | 파일 | SHA-256 | Weight | 사용 범위 | 상태 |
|---|---|---:|---|---|---|
| `SPOQA_HAN_SANS_BOLD` | `SpoqaHanSansBold.ttf` | `5a6b9b258145e243dfd5f70cc869119c6af708843658e380304bdfe3d4f4eaef` | 700 | Headline 48px | `RESOLVED_ASSET` |
| `SPOQA_HAN_SANS_REGULAR` | `SpoqaHanSansRegular.ttf` | `1f56c8535b6592672ea7f540a67bb5792c34558d72875fc504166a3e2b28b4b1` | 400 | Subcopy 39px | `RESOLVED_ASSET` |

## Provenance

- Official repository: `https://github.com/spoqa/spoqa-han-sans.git`
- Tag: `v2.1.2`
- Commit: `771117a48d520e811cd9876af2ed07ed6f035a7f`
- Source directory: `Original/SpoqaHanSans`
- Font internal family: `SpoqaHanSans`
- Font internal version: `2.000`
- License: SIL Open Font License 1.1
- License file: `LICENSE-OFL-1.1.txt`

`contracts/font-asset-registry.json`이 실제 파일·weight·사용 범위·라이선스 상태의 machine-readable 기준이다. 파일을 교체하려면 Registry 버전과 Golden을 함께 갱신해야 한다.
