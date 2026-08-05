export const CANVAS = Object.freeze({ width: 1029, height: 258 });

export function guideGeometry(renderedWidth: number): {
  scale: number;
  objectSlot: { x: number; y: number; width: number; height: number };
  textHardRightEdge: number;
  minimumGap: number;
  rightMargin: number;
} {
  const scale = renderedWidth / CANVAS.width;
  return {
    scale,
    objectSlot: { x: 666 * scale, y: 0, width: 315 * scale, height: 258 * scale },
    textHardRightEdge: 633 * scale,
    minimumGap: 33 * scale,
    rightMargin: 48 * scale,
  };
}
