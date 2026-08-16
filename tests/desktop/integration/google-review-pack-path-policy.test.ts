import { describe, expect, it } from "vitest";

import { assertPackRelativePath, buildPathNeutralExecutionIdentity, logicalRootLabel, scanReviewPackPayload, scanReviewPackText, scanZipEntryNames } from "../../../scripts/google-review-pack-path-policy.mjs";

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

  it("accepts a canonical-request fixture with zero path/privacy findings", () => {
    const entries = [
      { path: "README.md", text: "Review evidence · canonicalRequest included · links: manifests/D01.json" },
      { path: "manifests/D01.json", text: JSON.stringify({
        schemaVersion: "1.0.0",
        canonicalRequest: { formatProfileId: "GOOGLE_MARKETING_LANDSCAPE_1_91", placement: { x: 0.5, y: 0.5, scale: 1 } },
        links: ["outputs/D01.png"],
      }) },
      { path: "outputs/D01.png", text: "binary-placeholder" },
    ];
    expect(scanReviewPackPayload(entries)).toEqual([]);
    expect(entries.every((entry) => assertPackRelativePath(entry.path))).toBe(true);
    const entryPaths = new Set(entries.map((entry) => entry.path));
    expect(entryPaths.has("manifests/D01.json")).toBe(true);
    expect(entryPaths.has("outputs/D01.png")).toBe(true);
    const manifestEntry = entries.find((entry) => entry.path === "manifests/D01.json");
    if (!manifestEntry) throw new Error("canonical manifest fixture missing");
    const manifest = JSON.parse(manifestEntry.text) as { links: string[]; canonicalRequest: unknown };
    expect(manifest.canonicalRequest).toBeTruthy();
    expect(manifest.links.every((link) => entryPaths.has(link))).toBe(true);
    expect(() => assertPackRelativePath("../outside.json")).toThrow();
  });

  it("detects every required local path, privacy, traversal, and URL class", () => {
    const text = [
      "C:/Users/Lenovo/Desktop/example.zip",
      "C:\\Users\\Lenovo\\Desktop\\example.zip",
      "\\\\server\\share\\example.zip",
      "file://C:/Users/Lenovo/example.zip",
      "/home/user/example.zip",
      "/workspace/build/example.json",
      "/tmp/render/example.json",
      "../outside.json",
      "https://example.test/review",
      "NOT_EXPOSED",
    ].join(" ");
    const result = scanReviewPackText(text, { usernameTokens: ["Lenovo"] });
    expect(result.absoluteLocalPaths.length).toBeGreaterThanOrEqual(6);
    expect(result.usernameTokens).toContain("lenovo");
    expect(result.parentTraversalSegments).toContain("../");
    expect(result.externalUrls).toContain("https://");
    expect(result.notExposedPlaceholders).toEqual(["NOT_EXPOSED"]);
  });

  it("rejects absolute, backslash, and traversal ZIP entry names", () => {
    const result = scanZipEntryNames([
      "google-g3-2-2-final-output-pack/README.md",
      "C:/Users/Lenovo/Desktop/leak.txt",
      "\\\\server\\share\\leak.txt",
      "google-g3-2-2-final-output-pack\\outputs\\D01.png",
      "google-g3-2-2-final-output-pack/../outside.txt",
    ]);
    expect(result.zipAbsoluteEntries.length).toBe(2);
    expect(result.zipBackslashEntries.length).toBe(2);
    expect(result.zipTraversalEntries.length).toBe(1);
  });

  it("catches an absolute path injected by late-added completion evidence", () => {
    const initial = [
      { path: "README.md", text: "clean review pack" },
      { path: "verification/automated-summary.json", text: JSON.stringify({ absoluteWindowsPaths: 0 }) },
    ];
    expect(scanReviewPackPayload(initial)).toEqual([]);
    const finalStaging = [
      ...initial,
      { path: "manifests/g3-0-6-completion-evidence.json", text: JSON.stringify({ sourceArchive: { path: "C:/Users/Lenovo/Desktop/example.zip" } }) },
    ];
    const findings = scanReviewPackPayload(finalStaging);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe("manifests/g3-0-6-completion-evidence.json");
    expect(findings[0]?.absoluteLocalPaths.length).toBeGreaterThan(0);
    expect(findings[0]?.usernameTokens).toContain("lenovo");
  });
});
