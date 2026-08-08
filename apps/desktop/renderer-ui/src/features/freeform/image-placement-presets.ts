import type {
  CreativeElement,
  ImagePlacementSpec,
  NormalizedRect,
} from "../../../../../../packages/renderer-contract/src/index.js";

export type ImagePlacementPreset = "FIT_CANVAS" | "FILL_CANVAS" | "RESET_PLACEMENT";

export type RasterDimensions = Readonly<{
  width: number;
  height: number;
}>;

type ImageElement = Extract<CreativeElement, { type: "IMAGE" }>;

function assertDimensions(value: RasterDimensions, label: string): void {
  if (!Number.isFinite(value.width) || !Number.isFinite(value.height) || value.width <= 0 || value.height <= 0) {
    throw new RangeError(`${label} dimensions must be positive finite numbers`);
  }
}

export function fullCanvasBounds(): NormalizedRect {
  return { x: 0, y: 0, width: 1, height: 1 };
}

export function fitCanvasPlacement(): ImagePlacementSpec {
  return {
    policy: "CENTER_CONTAIN",
    source: "MANUAL",
    fitMode: "CONTAIN",
    anchor: "CENTER",
    subjectProtection: "NONE",
  };
}

export function centeredCoverCropRect(
  source: RasterDimensions,
  canvas: RasterDimensions,
): NormalizedRect {
  assertDimensions(source, "Source");
  assertDimensions(canvas, "Canvas");
  const sourceRatio = source.width / source.height;
  const targetRatio = canvas.width / canvas.height;

  if (sourceRatio > targetRatio) {
    const width = targetRatio / sourceRatio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  if (sourceRatio < targetRatio) {
    const height = sourceRatio / targetRatio;
    return { x: 0, y: (1 - height) / 2, width: 1, height };
  }
  return fullCanvasBounds();
}

export function fillCanvasPlacement(
  source: RasterDimensions,
  canvas: RasterDimensions,
): ImagePlacementSpec {
  return {
    policy: "MANUAL_CROP",
    source: "MANUAL",
    fitMode: "COVER",
    cropRect: centeredCoverCropRect(source, canvas),
    anchor: "CENTER",
    subjectProtection: "NONE",
  };
}

export function calculateContainedDestination(
  source: RasterDimensions,
  canvas: RasterDimensions,
): Readonly<{ x: number; y: number; width: number; height: number }> {
  assertDimensions(source, "Source");
  assertDimensions(canvas, "Canvas");
  const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  return {
    x: Math.floor((canvas.width - width) / 2),
    y: Math.floor((canvas.height - height) / 2),
    width,
    height,
  };
}

export function createNeutralImageElement(id: string, assetId: string): ImageElement {
  return {
    id,
    type: "IMAGE",
    assetId,
    bounds: fullCanvasBounds(),
    zIndex: 0,
    opacity: 1,
    placement: fitCanvasPlacement(),
  };
}

export function applyImagePlacementPreset(
  element: ImageElement,
  preset: ImagePlacementPreset,
  dimensions?: Readonly<{ source: RasterDimensions; canvas: RasterDimensions }>,
): ImageElement {
  const placement = preset === "FILL_CANVAS"
    ? dimensions
      ? fillCanvasPlacement(dimensions.source, dimensions.canvas)
      : undefined
    : fitCanvasPlacement();
  if (!placement) throw new Error("FILL_CANVAS requires selected asset and canvas dimensions");
  return {
    ...element,
    bounds: fullCanvasBounds(),
    placement,
  };
}
