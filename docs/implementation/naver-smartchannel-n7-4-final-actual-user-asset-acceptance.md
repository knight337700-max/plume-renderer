# N7.4 Final — Actual User Asset Acceptance

Phase: `N7_4_SMARTCHANNEL_ASSET_FONT_RUNTIME_HOTFIX`

## Closeout decision

N7.4 is closed as `PASS`. The acceptance rule requires an actual high-resolution transparent
user binary and the complete render-space pipeline; it does not require a specific source canvas
dimension. `2048×1366` remains a historical/equivalent fixture characteristic only.

Machine-readable evidence is recorded in
`contracts/naver-smartchannel-actual-asset-acceptance.json`.

## Actual sofa evidence

- Source: `C:/Users/Lenovo/Desktop/kakao/TEST_SOURCE/Plume_누끼.png`
- SHA-256: `fb736b93a274899b9750857ab7852c15d54d4f5233f7fbd655d28c2448f62dc4`
- Source canvas: `7616×5080`
- Alpha bounds: `x=2485,y=1555,w=3878,h=2213`
- Normalized size: `235×134`
- Final bounds: `x=40,y=13,w=235,h=134`
- Target region: `x=40,y=0,w=235,h=160`
- Visible alpha pixels: `20,391 / 29,120`
- Validator: `error=0, warning=0, info=0`
- Output PNG SHA-256: `1fb633dfaab45bf404aaf59d58421982d3b450d9028fd4d760856f811743e373`
- Pixel/render fingerprint: `0383f4c920ee95b2a57cfc646da25fa418301992b1985ea5f8fecd6a83f93374`
- Request fingerprint from the user render manifest: `fa1fdc0f595d2dc1295653b3882bffc2b1d4b9933a160c5805838a46c4e0bdc4`
- Preview, Export, and both Windows packaged executables: `PASS`

## Actual logo evidence

- Source: `C:/Users/Lenovo/Desktop/kakao/TEST_SOURCE/자코모 로고_블랙-ai.png`
- SHA-256: `66c398b9994e27a358c8752a19e4425dd308327435bdd18005e8175cd3459e43`
- Source canvas: `842×595`
- Alpha bounds: `x=187,y=218,w=469,h=159`
- Normalized size: `235×80`
- Visible alpha pixels: `7,801`
- Preview, Export, and both Windows packaged executables: `PASS`

## Fonts and provenance

NanumBarunGothic Bold and Regular are the bundled exact runtime assets. The registry records
their PostScript identity, SHA-256, embedded copyright evidence, and role mapping. Optional
San Francisco remains source-only and non-blocking. `manualAcceptanceStatus=NOT_REVIEWED` is
preserved: runtime acceptance is not a user design approval.

## Reproduction

```powershell
pnpm verify:naver-actual-asset
node scripts/verify-n7-4-font-intake.mjs
```

The first command verifies the supplied source and user render manifest. The second re-runs
Core Preview/Export and packaged runtime checks without changing the source binary.
