export function formatBytes(bytes: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(bytes)} bytes`;
}

export function formatProductMetadata(product: {
  width: number;
  height: number;
  bytes: number;
  hasAlpha: boolean;
}): string {
  return `${product.width}×${product.height} · ${formatBytes(product.bytes)} · alpha ${product.hasAlpha ? "있음" : "없음"}`;
}
