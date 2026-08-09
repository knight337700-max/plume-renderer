# NAVER SmartChannel Source Resolution — N1C

N1C is a source/contract gate, not a renderer implementation.

## Reproduction

Install the development-only extractor environment from
`scripts/requirements-naver-source.txt`, then run:

```text
python scripts/extract-naver-smartchannel-source.py \
  --source-root "C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12" \
  --contract-dir contracts \
  --asset-root assets/naver-smartchannel \
  --template-contract contracts/naver-smartchannel-template-contract.json
```

The extractor writes deterministic metadata and source-layer asset registries. It is not imported
by Core, CLI, Electron Main, Renderer Process, or runtime packaging.

## Output registries

- `contracts/naver-smartchannel-source-revision.json`
- `contracts/naver-smartchannel-psd-metadata.json`
- `contracts/naver-smartchannel-typography.json`
- `contracts/naver-smartchannel-fixed-components.json`
- `contracts/naver-smartchannel-cta-options.json`
- `assets/naver-smartchannel/*.png`

`scripts/verify-naver-smartchannel-contract.mjs --strict-source` verifies the committed registry,
asset digests, source PSD headers/SHA-256, current 280 rule, special geometry, and N2 blocker.

## Runtime boundary

No SmartChannel render function, PNG Golden generation, Desktop selector, Preview, Download,
upload, or runtime network access is added in N1C.
