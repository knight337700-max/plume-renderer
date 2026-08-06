export function formatBytes(bytes: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(bytes)} bytes`;
}

export function formatProductMetadata(product: {
  detectedMimeType?: "image/png" | "image/jpeg";
  width: number;
  height: number;
  bytes: number;
  hasAlpha: boolean;
}): string {
  const mime = product.detectedMimeType ? ` · ${product.detectedMimeType}` : "";
  return `${product.width}×${product.height} · ${formatBytes(product.bytes)}${mime} · alpha ${product.hasAlpha ? "있음" : "없음"}`;
}
