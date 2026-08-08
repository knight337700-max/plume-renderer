# FREEFORM Renderer Lab UI v1

Status: `IMPLEMENTED` in Desktop `0.8.0`.

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

Plan JSON controls round-trip the plan and asset IDs only. No local or absolute filesystem
path is serialized. Runtime networking remains prohibited.
