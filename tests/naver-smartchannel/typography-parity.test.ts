import { mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  diagnoseSmartChannelTextRaster,
  loadContracts,
  renderSmartChannel,
} from "../../src/core/index.js";
import { hasIssueMessageTranslation, issueMessage } from "../../apps/desktop/renderer-ui/src/features/validation/messages.js";
import { projectRoot } from "../helpers.js";

const templateId = "NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE";
const headline14 = "일이삼사오륙칠팔구십일이삼사";
const subcopy17 = "일이삼사오륙칠팔구십일이삼사오륙칠";

function request(content: Record<string, string>): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    channel: "NAVER_GFA",
    placement: "SMARTCHANNEL",
    layoutMode: "TEMPLATE_LOCKED",
    compositionMode: "RENDERER_COMPOSED",
    artifactCardinality: "SINGLE",
    templateId,
    content,
    assets: { object: { path: "fixtures/valid/mask-semicircle-right__logo__black__pass.png" } },
    output: { directory: "n7-7-5-test", baseName: "representative", overwrite: true },
  };
}

describe("N7.7.5 SmartChannel typography parity", () => {
  it("passes source-known 14/17 copy by actual raster boundary and aligns headline tops", async () => {
    const contracts = await loadContracts(projectRoot);
    const outputRoot = path.join(os.tmpdir(), `kbr-n775-${process.pid}`);
    await mkdir(outputRoot, { recursive: true });
    const content = { headline: headline14, headlineLine2: headline14, subcopy: subcopy17 };
    const result = await renderSmartChannel(request(content), { projectRoot, inputRoot: projectRoot, outputRoot, contracts, publish: false });
    expect(result.status).toBe("PASS");
    expect(result.errors).toEqual([]);
    const roles = result.report?.textRoles ?? [];
    expect(roles.map((role) => role.actualRasterBounds?.y)).toEqual([77, 125, 177]);
    expect(roles.map((role) => role.horizontalOverflowEvidence.rightBoundary)).toEqual([704, 704, 705]);
    expect(roles.map((role) => role.horizontalOverflowEvidence.actualRightEdge)).toEqual([703, 703, 705]);
    expect(roles.every((role) => role.horizontalOverflowEvidence.decisionBasis === "ACTUAL_RASTER_BOUNDARY")).toBe(true);
    expect(roles.every((role) => !role.overflow && !role.horizontalOverflowEvidence.clipped && !role.horizontalOverflowEvidence.diagnosticSurfaceClipped)).toBe(true);
  });

  it("uses the same raster algorithm for 13/14/15 and 16/17/18 boundaries", async () => {
    const contracts = await loadContracts(projectRoot);
    const headline = [
      "일이삼사오륙칠팔구십일이삼",
      headline14,
      `${headline14}오`,
    ];
    const subcopy = [
      "일이삼사오륙칠팔구십일이삼사오륙",
      subcopy17,
      `${subcopy17}팔`,
    ];
    const headlineResults = [];
    for (const text of headline) {
      const diagnostic = await diagnoseSmartChannelTextRaster(templateId, { headline: text }, { projectRoot, contracts });
      headlineResults.push(diagnostic.textRoles[0]?.overflow);
    }
    const subcopyResults = [];
    for (const text of subcopy) {
      const diagnostic = await diagnoseSmartChannelTextRaster(templateId, { subcopy: text }, { projectRoot, contracts });
      subcopyResults.push(diagnostic.textRoles[0]?.overflow);
    }
    expect(headlineResults).toEqual([false, false, true]);
    expect(subcopyResults).toEqual([false, false, true]);
  });

  it("does not use character count for mixed Korean, Latin, numeric, space, percent, or plus copy", async () => {
    const contracts = await loadContracts(projectRoot);
    const korean15 = `${headline14}오`;
    const latin15 = "ABCDEFGHIJKLMNO";
    expect([...korean15]).toHaveLength(15);
    expect([...latin15]).toHaveLength(15);
    const samples = [latin15, "123456789012345", "AB CD EF GH IJK", "SAVE 20% + 2026", "네이버 SMART 2026"];
    const korean = await diagnoseSmartChannelTextRaster(templateId, { headline: korean15 }, { projectRoot, contracts });
    expect(korean.textRoles[0]?.overflow).toBe(true);
    for (const text of samples) {
      const diagnostic = await diagnoseSmartChannelTextRaster(templateId, { headline: text }, { projectRoot, contracts });
      const evidence = diagnostic.textRoles[0]?.horizontalOverflowEvidence;
      expect(evidence?.decisionBasis).toBe("ACTUAL_RASTER_BOUNDARY");
      expect(evidence?.overflow).toBe((evidence?.actualRightEdge ?? Number.POSITIVE_INFINITY) > (evidence?.rightBoundary ?? Number.NEGATIVE_INFINITY));
    }
    expect((await diagnoseSmartChannelTextRaster(templateId, { headline: latin15 }, { projectRoot, contracts })).textRoles[0]?.overflow).toBe(false);
  });

  it("registers the overflow Korean translation without the missing-key fallback", async () => {
    const contracts = await loadContracts(projectRoot);
    const entry = contracts.errorRegistry.get("NAVER_SMARTCHANNEL_TEXT_OVERFLOW");
    expect(entry?.messageKey).toBe("naver_smartchannel.text_overflow");
    expect(hasIssueMessageTranslation("naver_smartchannel.text_overflow")).toBe(true);
    const rendered = issueMessage({ code: "NAVER_SMARTCHANNEL_TEXT_OVERFLOW", severity: "ERROR", messageKey: "naver_smartchannel.text_overflow", path: "/content/headline" });
    expect(rendered).toBe("텍스트가 스마트채널 허용 영역을 벗어났습니다.");
    expect(rendered).not.toContain("등록된 번역이 없습니다");
    const locale = JSON.parse(await readFile(path.join(projectRoot, "apps/desktop/renderer-ui/src/i18n/ko-KR.json"), "utf8")) as Record<string, string>;
    expect(locale["naver_smartchannel.text_overflow"]).toBe(rendered);
  });
});
