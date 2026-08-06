import { describe, expect, it } from "vitest";

import {
  HEADLINE_BASELINE_Y,
  SUBCOPY_BASELINE_Y,
  TEXT_CONTRACT,
} from "../../src/core/constants.js";
import {
  graphemeCountIncludingSpaces,
  hasConsecutiveSpaces,
  koreanEquivalentUnits,
  segmentGraphemes,
  textWidthStatus,
} from "../../src/core/index.js";
import { loadContracts, validateRawText } from "../../src/core/index.js";
import { loadValidInput, projectRoot } from "../helpers.js";

describe("C2a TextContract", () => {
  it("counts Headline Korean-equivalent units at 12.0 and rejects 13.0", () => {
    expect(koreanEquivalentUnits("가나다라마바사아자차카타")).toBe(12);
    expect(koreanEquivalentUnits("가나다라마바사아자차카타파")).toBe(13);
  });

  it("counts Subcopy Korean-equivalent units at 15.0 and rejects 16.0", () => {
    expect(koreanEquivalentUnits("가나다라마바사아자차카타파하거")).toBe(15);
    expect(koreanEquivalentUnits("가나다라마바사아자차카타파하거너")).toBe(16);
  });

  it("counts U+0020 as zero while preserving it as a grapheme", () => {
    expect(koreanEquivalentUnits("가 나")).toBe(2);
    expect(graphemeCountIncludingSpaces("가 나")).toBe(3);
  });

  it("counts ASCII letters, digits, symbols, emoji, and combining graphemes deterministically", () => {
    expect(koreanEquivalentUnits("JACOMO 25% SALE")).toBe(6.5);
    expect(koreanEquivalentUnits("Ａ")).toBe(1);
    expect(segmentGraphemes("👨‍👩‍👧‍👦")).toHaveLength(1);
    expect(koreanEquivalentUnits("👨‍👩‍👧‍👦")).toBe(1);
    expect(segmentGraphemes("e\u0301")).toHaveLength(1);
    expect(koreanEquivalentUnits("e\u0301")).toBe(0.5);
  });

  it("preserves internal spaces for warning and trims only at normalization boundary", () => {
    expect(hasConsecutiveSpaces("가  나")).toBe(true);
    expect(hasConsecutiveSpaces("가 나")).toBe(false);
    expect(hasConsecutiveSpaces("  가 나  ")).toBe(false);
  });

  it("keeps tab and linebreak rejection in the existing Core text validator", async () => {
    const input = await loadValidInput();
    input.copy.headline = "가\t나";
    input.copy.subcopy = "가\n나";
    const issues = validateRawText(input, await loadContracts(projectRoot));
    expect(issues.filter(({ code }) => code === "KBR-TEXT-002")).toHaveLength(2);
  });

  it("applies the exact pixel width boundaries", () => {
    expect(textWidthStatus(526, 632)).toBe("PASS");
    expect(textWidthStatus(527, 633)).toBe("WARNING");
    expect(textWidthStatus(585, 633)).toBe("WARNING");
    expect(textWidthStatus(586, 634)).toBe("ERROR");
    expect(textWidthStatus(585, 634)).toBe("ERROR");
  });

  it("freezes the C2a baseline and X contract", () => {
    expect(HEADLINE_BASELINE_Y).toBe(120);
    expect(SUBCOPY_BASELINE_Y).toBe(178);
    expect(TEXT_CONTRACT.textStartX).toBe(48);
    expect(TEXT_CONTRACT.hardRightEdgeExclusive).toBe(633);
    expect(TEXT_CONTRACT.maximumOccupiedWidthPx).toBe(585);
  });
});
