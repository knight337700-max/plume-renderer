import type { GoogleStaticUiRequest } from "./types.js";

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC");
  if (Array.isArray(value)) return value.map((entry) => normalizeValue(entry));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((key) => [key, normalizeValue(record[key])]),
    );
  }
  return value;
}
/**
 * Builds the one canonical Google Static request shape used by Preview and
 * Export. Metadata is normalized without entering rasterization, and array
 * order is intentionally preserved.
 */
export function buildCanonicalGoogleStaticRequest(
  plan: GoogleStaticUiRequest,
  deliveryMetadata: unknown = plan.deliveryMetadata,
): GoogleStaticUiRequest {
  if (deliveryMetadata === undefined) return { ...plan };
  if (!deliveryMetadata || Array.isArray(deliveryMetadata) || typeof deliveryMetadata !== "object") {
    throw new TypeError("Delivery metadata must be a JSON object.");
  }
  return {
    ...plan,
    deliveryMetadata: normalizeValue(deliveryMetadata) as Readonly<Record<string, unknown>>,
  };
}
