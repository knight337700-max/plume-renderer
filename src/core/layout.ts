import { createCanvas } from "@napi-rs/canvas";

import type { ContractBundle } from "./contracts.js";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COPY_OBJECT_MINIMUM_GAP,
  FONT_ALIAS_BOLD,
  FONT_ALIAS_REGULAR,
  HEADLINE_BASELINE_Y,
  MINIMUM_COPY_WIDTH,
  OBJECT_SLOT,
  SUBCOPY_BASELINE_Y,
  TEXT_DRAW_X,
  TEXT_HARD_RIGHT_EDGE,
} from "./constants.js";
import { createIssue, sortAndDedupeIssues } from "./errors.js";
import type {
  BBox,
  CanonicalInput,
  LayoutMeasurements,
  ProductAnalysis,
  TextMeasurement,
  ValidationIssue,
} from "./types.js";

function scanCanvasAlpha(data: Uint8ClampedArray, width: number, height: number): BBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function measureText(
  text: string,
  fontSize: number,
  fontAlias: string,
  color: string,
  baselineY: number,
): TextMeasurement {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context = canvas.getContext("2d");
  context.textBaseline = "alphabetic";
  context.font = `${fontSize}px "${fontAlias}"`;
  const advanceWidth = context.measureText(text).width;
  context.fillStyle = color;
  context.fillText(text, TEXT_DRAW_X, baselineY);
  const imageData = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const bbox = scanCanvasAlpha(imageData.data, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (!bbox) throw new Error("Text produced no visible pixels");
  return { text, advanceWidth, bbox, drawX: TEXT_DRAW_X, baselineY };
}

function intersects(left: BBox, right: BBox): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

export function calculateLayout(
  input: CanonicalInput,
  product: ProductAnalysis,
  contracts: ContractBundle,
): { measurements: LayoutMeasurements; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const headline = measureText(input.copy.headline, 48, FONT_ALIAS_BOLD, "#4C4C4C", HEADLINE_BASELINE_Y);
  const subcopy = measureText(input.copy.subcopy, 39, FONT_ALIAS_REGULAR, "#777777", SUBCOPY_BASELINE_Y);

  if (headline.bbox.x + headline.bbox.width > TEXT_HARD_RIGHT_EDGE) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-TEXT-004", "/copy/headline", {
        expected: { maximumRightExclusive: TEXT_HARD_RIGHT_EDGE },
        actual: { rightExclusive: headline.bbox.x + headline.bbox.width },
        bbox: headline.bbox,
      }),
    );
  }
  if (subcopy.bbox.x + subcopy.bbox.width > TEXT_HARD_RIGHT_EDGE) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-TEXT-005", "/copy/subcopy", {
        expected: { maximumRightExclusive: TEXT_HARD_RIGHT_EDGE },
        actual: { rightExclusive: subcopy.bbox.x + subcopy.bbox.width },
        bbox: subcopy.bbox,
      }),
    );
  }
  if (headline.advanceWidth < MINIMUM_COPY_WIDTH && subcopy.advanceWidth < MINIMUM_COPY_WIDTH) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-TEXT-006", "/copy", {
        expected: { atLeastOneWidth: MINIMUM_COPY_WIDTH },
        actual: { headlineWidth: headline.advanceWidth, subcopyWidth: subcopy.advanceWidth },
      }),
    );
  }
  if (intersects(headline.bbox, subcopy.bbox)) {
    issues.push(createIssue(contracts.errorRegistry, "KBR-LAYOUT-004", "/copy"));
  }

  const copyRight = Math.max(headline.bbox.x + headline.bbox.width, subcopy.bbox.x + subcopy.bbox.width);
  const copyObjectGapPx = product.placedVisibleBox.x - copyRight;
  if (copyObjectGapPx < COPY_OBJECT_MINIMUM_GAP) {
    issues.push(
      createIssue(contracts.errorRegistry, "KBR-LAYOUT-001", "/copy", {
        expected: { minimumGap: COPY_OBJECT_MINIMUM_GAP },
        actual: { gap: copyObjectGapPx },
      }),
    );
  }

  for (const [pointer, box] of [
    ["/copy/headline", headline.bbox],
    ["/copy/subcopy", subcopy.bbox],
    ["/assets/product/path", product.placedVisibleBox],
  ] as const) {
    if (box.x < 0 || box.y < 0 || box.x + box.width > CANVAS_WIDTH || box.y + box.height > CANVAS_HEIGHT) {
      issues.push(createIssue(contracts.errorRegistry, "KBR-LAYOUT-007", pointer, { bbox: box }));
    }
  }

  const advertiser = input.advertiser.text.toLocaleLowerCase("ko-KR");
  const inHeadline = input.copy.headline.toLocaleLowerCase("ko-KR").includes(advertiser);
  const inSubcopy = input.copy.subcopy.toLocaleLowerCase("ko-KR").includes(advertiser);
  const advertiserMatchedField = inHeadline ? "headline" : inSubcopy ? "subcopy" : null;

  return {
    measurements: {
      headline,
      subcopy,
      headlineWidthPx: headline.advanceWidth,
      subcopyWidthPx: subcopy.advanceWidth,
      advertiserMatchedInCopy: inHeadline || inSubcopy,
      advertiserMatchedField,
      copyObjectGapPx,
      objectOpaqueWidthPx: product.placedVisibleBox.width,
      objectOpaqueHeightPx: product.placedVisibleBox.height,
      objectScale: product.scale,
      objectSlot: { ...OBJECT_SLOT },
      productPlacedBox: product.placedVisibleBox,
      alphaTrimBox: product.trimBox,
    },
    issues: sortAndDedupeIssues(issues),
  };
}
