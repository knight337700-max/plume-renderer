export type PreviewCanvasDimensions = {
  width: number;
  height: number;
};

export type FitPreviewGeometry = PreviewCanvasDimensions & {
  scale: number;
};

export type PreviewContentRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Resolve the view-only contain geometry. The export canvas dimensions are
 * never changed by this calculation; it only determines CSS display size.
 */
export function resolveFitPreviewGeometry(
  viewport: PreviewCanvasDimensions,
  canvas: PreviewCanvasDimensions,
): FitPreviewGeometry | null {
  if (![viewport.width, viewport.height, canvas.width, canvas.height].every(positiveFinite)) return null;
  const scale = Math.min(viewport.width / canvas.width, viewport.height / canvas.height);
  if (!positiveFinite(scale)) return null;
  return {
    width: Math.max(1, canvas.width * scale),
    height: Math.max(1, canvas.height * scale),
    scale,
  };
}

export function isPointInsidePreviewContent(point: { x: number; y: number }, rect: PreviewContentRect): boolean {
  return point.x >= rect.left && point.x <= rect.left + rect.width && point.y >= rect.top && point.y <= rect.top + rect.height;
}

export function normalizedPointerDelta(
  start: { x: number; y: number },
  current: { x: number; y: number },
  rect: PreviewContentRect,
): { x: number; y: number } {
  if (!positiveFinite(rect.width) || !positiveFinite(rect.height)) return { x: 0, y: 0 };
  return {
    x: (current.x - start.x) / rect.width,
    y: (current.y - start.y) / rect.height,
  };
}
