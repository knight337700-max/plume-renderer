# Renderer Lab Placement Plan

The Desktop Lab uses the same `parsePlacementPlan` and `serializePlacementPlan` functions as the Integration Contract. The panel displays the current capability, fixed policy/fit/anchor/protection, disabled crop controls with their reason, JSON Import/Export, Agent fixture loading, and the Core-applied destination rectangle after Preview.

OBJECT_RIGHT permits only `ALPHA_TRIM_CONTAIN + CONTAIN`; the Lab never turns on manual crop or semantic candidate controls for that template. Import rejects unknown fields and malformed JSON with stable KBR error codes. Import does not fill missing values or change `source`. Export emits canonical JSON. The Agent fixture button passes through the same parser and preserves `source=AGENT`, proving that provenance is data rather than a separate execution path.

Preview/Export continue to use the existing Main/Core pipeline and download gate. A stale or ERROR Core result cannot be exported. The Lab is a local renderer surface only; it performs no network request and has no Agent or Plume client.
