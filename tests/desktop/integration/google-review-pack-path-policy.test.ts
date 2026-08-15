import { describe, expect, it } from "vitest";

import { assertPackRelativePath, buildPathNeutralExecutionIdentity, logicalRootLabel, scanReviewPackPayload, scanReviewPackText } from "../../../scripts/google-review-pack-path-policy.mjs";

describe("G3.2.2 review-pack path privacy policy", () => {
  it("rejects drive, UNC, home and temp paths while allowing relative paths and hashes", () => {
    const result = scanReviewPackText(JSON.stringify({
      repositoryRelativePath: "dist-desktop/electron-main/main.cjs",
      sha256: "c:/not-a-path-sha-value",
      executable: "C:\\Users\\Alice\\AppData\\Local\\Temp\\electron.exe",
      home: "/Users/Alice/Desktop/source.png",
      unc: "\\\\server\\share\\asset.png",
      uri: "sha256:abcdef",
    }));
    expect(result.absoluteLocalPaths.length).toBeGreaterThanOrEqual(3);
    expect(result.externalUrls).toEqual([]);
    expect(() => assertPackRelativePath("outputs/D01.png")).not.toThrow();
    expect(() => assertPackRelativePath("C:/Users/Alice/output.png")).toThrow();
    expect(() => assertPackRelativePath("../outside.png")).toThrow();
  });

  it("does not classify profile IDs, SHA values, or sha256 URI schemes as local paths", () => {
    const result = scanReviewPackText("GOOGLE_MARKETING_SQUARE_1_1 00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359 sha256:abcdef");
    expect(result.absoluteLocalPaths).toEqual([]);
    expect(result.externalUrls).toEqual([]);
  });

  it("creates path-neutral execution identity and logical roots", () => {
    expect(logicalRootLabel("DESKTOP_ROOT")).toBe("DESKTOP_ROOT");
    expect(buildPathNeutralExecutionIdentity({ desktopVersion: "0.13.1", electronVersion: "43.3.0", executablePath: "C:/Users/Alice/AppData/Local/electron.exe", buildArtifacts: [{ repositoryRelativePath: "dist-desktop/electron-main/main.cjs", sha256: "a" }] })).toEqual({
      mode: "ELECTRON_PRODUCTION_UI_IPC_EXPORT",
      desktopVersion: "0.13.1",
      electronVersion: "43.3.0",
      executableBasename: "electron.exe",
      isPackaged: false,
      buildArtifacts: [{ repositoryRelativePath: "dist-desktop/electron-main/main.cjs", sha256: "a" }],
    });
    expect(scanReviewPackPayload([{ path: "case.json", text: '{"root":"DESKTOP_ROOT","uri":"https://example.test"}' }])[0]?.externalUrls).toEqual(["https://"]);
  });
});
