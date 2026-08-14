# Google static contracts and profile catalog — G1

This catalog is a project implementation index, not a replacement for the frozen G0.1 source
records. Normative machine-readable values live in `contracts/google/`.

| Family | Runtime profiles | Composition | Delivery | Placement/default |
|---|---:|---|---|---|
| Marketing image geometry | 5 | PLATFORM_COMPOSED | COLLECTION | CENTER_CONTAIN |
| Logo geometry | 2 | PLATFORM_COMPOSED | COLLECTION | ALPHA_TRIM_CONTAIN |
| Demand Gen uploaded static | 7 | RENDERER_COMPOSED | COLLECTION | NONE; explicit element plan |

The geometry profiles are landscape 1.91:1, square 1:1, portrait 4:5, RDA vertical 9:16,
Demand Gen vertical 9:16, square logo 1:1, and landscape logo 4:1. Uploaded-static presets are
300×250, 336×280, 728×90, 970×90, 160×600, 300×600, and 320×50. Project presets do not claim
exhaustive Google acceptance.

The twenty legacy Display canvases remain G0.1 architecture metadata and are not runtime profiles
in G1. Platform-owned copy, CTA, URL, and layout are manifest metadata only; no local rasterizer
consumes them.
