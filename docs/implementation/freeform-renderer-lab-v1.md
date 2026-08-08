# FREEFORM Renderer Lab UI v1

Status: `IMPLEMENTED` in Desktop `0.8.0`; Preview artifact hotfix applied in Desktop `0.8.1`;
neutral IMAGE defaults and manual placement presets applied in Desktop `0.8.2`.

The lab has two explicit modes. `Template Locked` retains the four existing Kakao
Bizboard workflows. `Freeform` is a separate editor that produces only the frozen
`CreativeLayoutPlan 1.0.0`; it does not recreate Core validation or raster behavior.

## Registry and profile surface

`FreeformEditor` imports `contracts/freeform-format-profiles.json` at build time. Human
labels are registry `displayName` metadata, not a UI-only profile table. Fourteen
`IMPLEMENTED` profiles are selectable. `KAKAO_ADVIEW_SCROLL_IMAGE` remains disabled because
its variable-height canvas is catalog-only. The summary panel reports both official size
rule/ratio and the fixed Renderer canvas, plus output bytes, opacity, safe-zone metadata,
element allowlist, collection metadata, and implementation status.

## Plan editor

Background, element list, and editor controls modify the same serializable plan object.
Image and Logo use the existing session asset selectors and token resolver; Logo fixes
`ALPHA_TRIM_CONTAIN`, while Image exposes the four existing placement policies, decimal
crop rect, anchor, protection, and candidate reference. Text fonts come exclusively from
the font registry and WORD_WRAP remains disabled. Shape is disabled and remains a Core
unsupported element. Geometry fields are normalized numbers with direct decimal input and
C5B keyboard increments. Element IDs are editable, with deterministic prefix/integer
defaults.

Desktop `0.8.2` creates a new IMAGE with full normalized bounds, `CENTER_CONTAIN`, zIndex
`0`, and explicit opacity `1`. New TEXT and LOGO elements also use neutral zIndex `0`; their
existing geometry choices are not official coordinates and F4C adds no presets for them.
Equal zIndex remains deterministic by original Plan array order.

## IMAGE placement presets

The selected IMAGE editor exposes three Desktop-only, one-shot Plan edits before Geometry.
Fit writes full bounds and a fresh `CENTER_CONTAIN` placement. Reset writes the same
placement while preserving zIndex and opacity. Fill reads the selected asset's actual
oriented dimensions and the selected Registry Profile canvas, calculates an exact centered
normalized crop, and writes `MANUAL_CROP` into the Plan. It is disabled when those dimensions
are unavailable.

No preset runs during JSON Import, including plans with `source: AGENT`. No preset reads Safe
Zone metadata, rounds with `toFixed`, adds a persistent constraint, or delegates crop
inference to Core. A button click follows the existing pixel-edit invalidation path and a new
Core Preview is required before export. See `freeform-image-placement-presets.md` and
ADR-0041.

## Preview, validation, and output

The UI calls the existing Desktop IPC. `DesktopController` resolves tokens inside the
trusted session and calls `renderFreeform` for both preview (`publish:false`) and export
(`publish:true`). Core issues are rendered with severity, stable code, element ID, actual,
and expected values. F3A manual-review warnings are shown separately. Safe Zone guides are
UI-only and unknown geometry is never inferred.

Any pixel-affecting edit clears the preview token and disables export. Safe Zone visibility
and UI scale do not alter the plan or fingerprint. A fresh preview with zero Core errors is
the only export path; Core's existing atomic publisher writes the artifact and manifest.
PNG/JPEG metadata and resolved AUTO_FIT JPEG quality are taken from the Core response.

Desktop `0.8.1` serves both formats through the same private `kbr-preview:` token protocol.
The session record stores the canonical artifact format and maps PNG to `image/png` and JPEG
to `image/jpeg`; the UI never infers MIME from the compatibility field
`outputPngDigest` or from a filename. A PRE_RENDER error has no artifact. An encoded
POST_RENDER compliance failure retains its session Preview artifact while keeping
publish/download ineligible. The Desktop-only internal Preview entry point forces
`publish:false`; public Core callers and final publish retain the previous fail-closed result.

Plan JSON controls round-trip the plan and asset IDs only. No local or absolute filesystem
path is serialized. Runtime networking remains prohibited.
