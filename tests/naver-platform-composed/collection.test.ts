/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { loadContracts } from "../../src/core/contracts.js";
import {
  isNaverFeedCollectionRenderRequest,
  renderNaverFeedCollection,
  type NaverFeedCollectionRenderRequest,
} from "../../src/core/naver-collection.js";
import { inspectImageFile } from "../../src/core/image-input.js";
import {
  materializePlatformComposedProfile,
  validatePlatformComposedSource,
} from "../../src/core/naver-platform-composed.js";

const projectRoot = process.cwd();

async function image(root: string, name: string, width: number, height: number, seed: number): Promise<string> {
  const bytes = Buffer.alloc(width * height * 3);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 31 + seed * 17) % 256;
  const fileName = `${name}.jpg`;
  await sharp(bytes, { raw: { width, height, channels: 3 } }).jpeg({ quality: 86, chromaSubsampling: "4:4:4" }).toFile(path.join(root, fileName));
  return fileName;
}

async function requestWithItems(root: string, count: number): Promise<NaverFeedCollectionRenderRequest> {
  const profilePath = await image(root, "profile", 300, 300, 1);
  const profileInspected = await inspectImageFile(path.join(root, profilePath));
  const assets = [{
    assetId: "profile",
    assetRole: "profileImage",
    sourceProfileId: "NAVER_FEED_PROFILE_IMAGE_300X300",
    mime: profileInspected.metadata.detectedMimeType,
    width: profileInspected.metadata.width,
    height: profileInspected.metadata.height,
    bytes: profileInspected.metadata.bytes,
    hasAlpha: profileInspected.metadata.hasAlpha,
    safeArea: { x: 27, y: 27, width: 246, height: 246 },
    pathRef: profilePath,
  }];
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const fileName = await image(root, `item-${index}`, 600, 600, index + 2);
    const inspected = await inspectImageFile(path.join(root, fileName));
    assets.push({
      assetId: `asset-${index}`,
      assetRole: "collectionItemImage",
      sourceProfileId: "NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600",
      mime: inspected.metadata.detectedMimeType,
      width: inspected.metadata.width,
      height: inspected.metadata.height,
      bytes: inspected.metadata.bytes,
      hasAlpha: inspected.metadata.hasAlpha,
      safeArea: { x: 30, y: 30, width: 540, height: 540 },
      pathRef: fileName,
    });
    items.push({
      id: `item-${index}`,
      sourceProfileId: "NAVER_FEED_COLLECTION_ITEM_IMAGE_600X600" as const,
      assetId: `asset-${index}`,
      fields: {
        landingUrl: `https://example.test/item-${index}`,
        collectionDescription28: `상품 ${index}`,
      },
    });
  }
  return {
    schemaVersion: "1.1.0",
    channel: "NAVER_GFA",
    placement: "MOBILE_DA_FEED",
    compositionMode: "PLATFORM_COMPOSED",
    artifactCardinality: "COLLECTION",
    sourceProfileId: "NAVER_FEED_COLLECTION_SOURCE_V1",
    fields: { feedProfileName19: "테스트 상점", feedAdCopy65: "컬렉션 상품 안내", platformCta: "PLATFORM_DEFINED" },
    assets,
    collection: { items },
  };
}

describe("N6 NAVER Feed collection", () => {
  it("reuses COLLECTION cardinality and validates four and ten item bounds", async () => {
    const contracts = await loadContracts(projectRoot);
    const profile = materializePlatformComposedProfile(contracts.naverPlatformSourceProfiles, "NAVER_FEED_COLLECTION_SOURCE_V1");
    expect(profile?.artifactCardinality).toBe("COLLECTION");
    expect(profile?.collection?.minimumItems).toBe(4);
    expect(profile?.collection?.maximumItems).toBe(10);

    const root = await mkdtemp(path.join(os.tmpdir(), "kbr-n6-count-"));
    const validFour = await requestWithItems(root, 4);
    const validTen = await requestWithItems(root, 10);
    expect(validatePlatformComposedSource(validFour as never, profile!).errors).toHaveLength(0);
    expect(validatePlatformComposedSource(validTen as never, profile!).errors).toHaveLength(0);
    expect(isNaverFeedCollectionRenderRequest(validFour)).toBe(true);
  });

  it("reports deterministic count, duplicate, source-profile, nesting, and safe-area errors", async () => {
    const contracts = await loadContracts(projectRoot);
    const profile = materializePlatformComposedProfile(contracts.naverPlatformSourceProfiles, "NAVER_FEED_COLLECTION_SOURCE_V1")!;
    const root = await mkdtemp(path.join(os.tmpdir(), "kbr-n6-invalid-"));
    const base = await requestWithItems(root, 4);
    const tooFew = { ...base, collection: { items: base.collection!.items.slice(0, 3) } };
    const tooMany = { ...base, collection: { items: Array.from({ length: 11 }, (_, index) => ({ ...base.collection!.items[index % 4]!, id: `too-many-${index}` })) } };
    const duplicate = { ...base, collection: { items: base.collection!.items.map((item, index) => index === 1 ? { ...item, id: base.collection!.items[0]!.id } : item) } };
    const unsupported = { ...base, collection: { items: base.collection!.items.map((item, index) => index === 0 ? { ...item, sourceProfileId: "NAVER_FEED_COLLECTION_ITEM_VIDEO" } : item) } };
    const nested = { ...base, collection: { items: base.collection!.items.map((item, index) => index === 0 ? { ...item, collection: { items: [] } } : item) } } as never;
    const unsafe = { ...base, assets: base.assets.map((asset, index) => index === 1 ? { ...asset, safeArea: { x: 0, y: 0, width: 600, height: 600 } } : asset) };
    expect(validatePlatformComposedSource(tooFew as never, profile).errors.map((entry) => entry.code)).toContain("KBR-NAVER-SOURCE-COLLECTION-TOO-FEW-ITEMS");
    expect(validatePlatformComposedSource(tooMany as never, profile).errors.map((entry) => entry.code)).toContain("KBR-NAVER-SOURCE-COLLECTION-TOO-MANY-ITEMS");
    expect(validatePlatformComposedSource(duplicate as never, profile).errors.map((entry) => entry.code)).toContain("KBR-NAVER-SOURCE-COLLECTION-DUPLICATE-ITEM-ID");
    expect(validatePlatformComposedSource(unsupported as never, profile).errors.map((entry) => entry.code)).toContain("KBR-NAVER-SOURCE-COLLECTION-SOURCE-PROFILE-NOT-ALLOWED");
    expect(validatePlatformComposedSource(nested, profile).errors.map((entry) => entry.code)).toContain("KBR-NAVER-SOURCE-COLLECTION-NESTED-NOT-SUPPORTED");
    expect(validatePlatformComposedSource(unsafe as never, profile).errors.map((entry) => entry.code)).toContain("KBR-NAVER-SOURCE-COLLECTION-ASSET-SAFE-AREA");
  });

  it("keeps item bytes stable, makes order part of collection fingerprint, and publishes atomically", async () => {
    const contracts = await loadContracts(projectRoot);
    const root = await mkdtemp(path.join(os.tmpdir(), "kbr-n6-runtime-"));
    const output = await mkdtemp(path.join(os.tmpdir(), "kbr-n6-output-"));
    const request = await requestWithItems(root, 4);
    const first = await renderNaverFeedCollection(request, { projectRoot, inputRoot: root, outputRoot: output, contracts, publish: false });
    const second = await renderNaverFeedCollection(request, { projectRoot, inputRoot: root, outputRoot: output, contracts, publish: false });
    const reversed = { ...request, collection: { items: [...request.collection!.items].reverse() } };
    const changedOrder = await renderNaverFeedCollection(reversed, { projectRoot, inputRoot: root, outputRoot: output, contracts, publish: false });
    expect(first.status).toBe("PASS");
    expect(second.status).toBe("PASS");
    expect(first.manifestDigest).toBe(second.manifestDigest);
    expect(first.collectionFingerprint).toBe(second.collectionFingerprint);
    expect(first.artifacts.map((item) => item.artifactChecksum)).toEqual(second.artifacts.map((item) => item.artifactChecksum));
    expect(changedOrder.status).toBe("PASS");
    expect(changedOrder.collectionFingerprint).not.toBe(first.collectionFingerprint);

    const published = await renderNaverFeedCollection({ ...request, output: { directory: ".", baseName: "collection-pass" } }, { projectRoot, inputRoot: root, outputRoot: output, contracts, publish: true });
    expect(published.downloadAllowed).toBe(true);
    expect(published.manifestPath).not.toBeNull();
    expect((await readFile(published.manifestPath!, "utf8")).includes('"partialPublish":false')).toBe(true);
    expect(published.artifactPaths).toHaveLength(4);
    for (const filePath of published.artifactPaths) expect((await stat(filePath)).isFile()).toBe(true);

    const invalid = { ...request, collection: { items: request.collection!.items.slice(0, 3) }, output: { directory: ".", baseName: "collection-invalid" } };
    const blocked = await renderNaverFeedCollection(invalid, { projectRoot, inputRoot: root, outputRoot: output, contracts, publish: true });
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.downloadAllowed).toBe(false);
    expect(blocked.partialPublish).toBe(false);
    expect(blocked.artifactPaths).toHaveLength(0);
  });
});
