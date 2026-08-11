import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadContracts } from "../../src/core/index.js";
import { projectRoot } from "../helpers.js";

describe("NAVER SmartChannel N7.5 fixed component contract", () => {
  it("freezes the 26-resource source/runtime/package inventory", async () => {
    const contracts = await loadContracts(projectRoot);
    const registry = contracts.naverFixedComponentRuntime;
    const resources = Array.isArray(registry.resources) ? registry.resources : [];
    expect(registry.status).toBe("FROZEN");
    expect(registry.registryVersion).toBe("1.0.0");
    expect(resources).toHaveLength(26);
    expect(new Set(resources.map((entry) => String((entry as Record<string, unknown>).id))).size).toBe(26);
    for (const entry of resources as Array<Record<string, unknown>>) {
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.sourceProvenance).toBe("string");
      expect(typeof entry.expectedSha256).toBe("string");
      expect(typeof entry.sourcePath).toBe("string");
      expect(typeof entry.runtimePath).toBe("string");
      expect(entry.packagedRequired).toBe(true);
      expect(Array.isArray(entry.templates)).toBe(true);
      expect(entry.expectedRenderBounds).toBeTruthy();
    }
  });

  it("keeps the approved landing digests, bounds, and stable Korean diagnostic key", async () => {
    const contracts = await loadContracts(projectRoot);
    const fixed = Array.isArray(contracts.naverFixedComponents.components) ? contracts.naverFixedComponents.components : [];
    const compact = fixed.find((entry) => String((entry as Record<string, unknown>).id) === "LANDING_ICON_COMPACT") as Record<string, unknown> | undefined;
    const large = fixed.find((entry) => String((entry as Record<string, unknown>).id) === "LANDING_ICON_280") as Record<string, unknown> | undefined;
    expect((compact?.asset as Record<string, unknown>)?.assetPngSha256).toBe("c731128d2bb468c5d7088c9d183d4ebbec24aa748085e6fe41f8d0cbd24a8e58");
    expect((large?.asset as Record<string, unknown>)?.assetPngSha256).toBe("b81d74dcadc9d21db0e81169117d52f9fc51973bd2bba0ce18985035efd617ca");
    expect(JSON.stringify(compact?.heightPlacements)).toContain('"x":694');
    expect(JSON.stringify(large?.placement)).toContain('"x":660');
    expect(contracts.errorRegistry.get("NAVER_SMARTCHANNEL_FIXED_COMPONENT_INVALID")?.messageKey).toBe("naver_smartchannel.fixed_component_invalid");
    const ko = JSON.parse(await readFile(path.join(projectRoot, "apps/desktop/renderer-ui/src/i18n/ko-KR.json"), "utf8")) as Record<string, string>;
    expect(ko["naver_smartchannel.fixed_component_invalid"]).toBeTruthy();
    expect(ko["naver_smartchannel.fixed_component_invalid"]).not.toContain("등록된 번역이 없습니다");
  });
});
