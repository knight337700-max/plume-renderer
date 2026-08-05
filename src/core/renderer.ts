import { readFile } from "node:fs/promises";
import path from "node:path";

import { verifyRuntimeAssets } from "./assets.js";
import { canonicalDigest, canonicalJson } from "./canonical.js";
import type { ContractBundle } from "./contracts.js";
import { loadContracts } from "./contracts.js";
import {
  INPUT_SCHEMA_VERSION,
  MANIFEST_SCHEMA_VERSION,
  OUTPUT_SCHEMA_VERSION,
  RESPONSE_SCHEMA_VERSION,
  TEMPLATE_CONTRACT_VERSION,
} from "./constants.js";
import { createIssue, sortAndDedupeIssues, splitIssues } from "./errors.js";
import { sha256Bytes } from "./hash.js";
import { calculateLayout } from "./layout.js";
import { applyDefaults, normalizeInput } from "./normalize.js";
import {
  PathSecurityError,
  resolveTrustedInputFile,
  resolveTrustedJobDirectory,
  resolveTrustedRoot,
} from "./path-security.js";
import { analyzeAndResizeProduct } from "./product-image.js";
import { PublishError, publishArtifacts } from "./publish.js";
import { renderRgbaPng, validateRenderedPng } from "./raster.js";
import { SchemaValidators, parseJsonInput } from "./schema-validation.js";
import { validateCanonicalSemantics, validateRawText } from "./semantic-validation.js";
import type {
  RenderManifest,
  RendererConfig,
  RenderResponse,
  ValidationIssue,
} from "./types.js";

const RENDERER_VERSION = "0.1.0";

function failureResponse(issues: readonly ValidationIssue[]): RenderResponse {
  const sorted = sortAndDedupeIssues(issues);
  const { errors, warnings } = splitIssues(sorted);
  if (errors.length === 0) throw new Error("Failure response requires at least one ERROR");
  return {
    schemaVersion: RESPONSE_SCHEMA_VERSION,
    manifestDigest: null,
    pngDigest: null,
    manifestPath: null,
    pngPath: null,
    downloadAllowed: false,
    status: "FAIL",
    errors,
    warnings,
  };
}

function manualAcceptanceStatus(): RenderManifest["manualAcceptanceStatus"] {
  return {
    status: "NOT_REVIEWED",
    items: ["M-001", "M-002", "M-003", "M-004", "M-005", "M-006"].map((id) => ({
      id,
      status: "NOT_REVIEWED" as const,
      reviewer: null,
      reviewedAt: null,
    })),
  };
}

export type KakaoBizboardRenderer = {
  render(request: unknown): Promise<RenderResponse>;
  renderJson(json: string): Promise<RenderResponse>;
};

export async function createKakaoBizboardRenderer(config: RendererConfig): Promise<KakaoBizboardRenderer> {
  const [projectRoot, inputRoot, outputRoot] = await Promise.all([
    resolveTrustedRoot(config.projectRoot),
    resolveTrustedRoot(config.inputRoot),
    resolveTrustedRoot(config.outputRoot),
  ]);
  const contracts = await loadContracts(projectRoot);
  const schemas: SchemaValidators = new SchemaValidators(contracts);
  const assetVerification = await verifyRuntimeAssets(projectRoot, contracts);

  async function render(request: unknown): Promise<RenderResponse> {
    const schemaResult = schemas.validateInput(request);
    if (!schemaResult.valid) return failureResponse(schemaResult.issues);
    const rawTextIssues = validateRawText(schemaResult.value, contracts);
    if (rawTextIssues.some(({ severity }) => severity === "ERROR")) return failureResponse(rawTextIssues);

    const defaulted = applyDefaults(schemaResult.value);
    const canonicalInput = normalizeInput(defaulted);
    const canonicalInputDigest = canonicalDigest(canonicalInput);
    const semanticIssues = validateCanonicalSemantics(canonicalInput, contracts);
    const startupIssues = assetVerification.issues;
    const preAssetIssues = sortAndDedupeIssues([...rawTextIssues, ...semanticIssues, ...startupIssues]);
    if (preAssetIssues.some(({ severity }) => severity === "ERROR")) return failureResponse(preAssetIssues);
    if (!assetVerification.assets) {
      return failureResponse([
        createIssue(contracts.errorRegistry, "KBR-SYSTEM-001", "/assets/fonts"),
      ]);
    }

    let productPath: string;
    try {
      productPath = await resolveTrustedInputFile(inputRoot, canonicalInput.assets.product.path);
    } catch (error) {
      if (error instanceof PathSecurityError) {
        return failureResponse([
          ...preAssetIssues,
          createIssue(contracts.errorRegistry, "KBR-INPUT-009", "/assets/product/path", {
            actual: error.inputPath,
          }),
        ]);
      }
      throw error;
    }

    let jobDirectory: string;
    try {
      jobDirectory = await resolveTrustedJobDirectory(
        outputRoot,
        canonicalInput.output.directory,
        canonicalInput.output.baseName,
      );
    } catch (error) {
      if (error instanceof PathSecurityError) {
        return failureResponse([
          ...preAssetIssues,
          createIssue(contracts.errorRegistry, "KBR-INPUT-009", "/output/directory", {
            actual: error.inputPath,
          }),
        ]);
      }
      throw error;
    }

    const productResult = await analyzeAndResizeProduct(
      productPath,
      canonicalInput.assets.product.expectedSha256,
      contracts,
    );
    const productIssues = sortAndDedupeIssues([...preAssetIssues, ...productResult.issues]);
    if (productIssues.some(({ severity }) => severity === "ERROR")) return failureResponse(productIssues);
    if (!productResult.analysis || !productResult.productDigest) {
      return failureResponse([
        ...productIssues,
        createIssue(contracts.errorRegistry, "KBR-SYSTEM-005", "/assets/product/path"),
      ]);
    }

    const layout = calculateLayout(canonicalInput, productResult.analysis, contracts);
    const layoutIssues = sortAndDedupeIssues([...productIssues, ...layout.issues]);
    if (layoutIssues.some(({ severity }) => severity === "ERROR")) return failureResponse(layoutIssues);

    const png = renderRgbaPng(canonicalInput, productResult.analysis);
    const outputIssues = await validateRenderedPng(png, contracts);
    const allIssuesBeforePublish = sortAndDedupeIssues([...layoutIssues, ...outputIssues]);
    if (allIssuesBeforePublish.some(({ severity }) => severity === "ERROR")) {
      return failureResponse(allIssuesBeforePublish);
    }

    const pngDigest = sha256Bytes(png);
    // Phase C0 exposes both legacy names. In v1.2, the Canonical Input is the
    // default-materialized, NFC/trim-normalized value, so both names identify
    // the same RFC 8785 JCS UTF-8 byte sequence.
    const normalizedInputDigest = canonicalInputDigest;
    const completeIssues = sortAndDedupeIssues([
      ...allIssuesBeforePublish,
      createIssue(contracts.errorRegistry, "KBR-OUTPUT-010", "/output"),
    ]);
    const issueGroups = splitIssues(completeIssues);
    const manifest: RenderManifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      canonicalInputDigest,
      normalizedInputDigest,
      outputPngDigest: pngDigest,
      templateContractVersion: TEMPLATE_CONTRACT_VERSION,
      inputSchemaVersion: INPUT_SCHEMA_VERSION,
      outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
      validatorResult: {
        errorCount: 0,
        warningCount: issueGroups.warnings.length,
        infoCount: issueGroups.infos.length,
        issues: completeIssues,
      },
      assetDigests: {
        product: { id: "PRODUCT", sha256: productResult.productDigest },
        fonts: assetVerification.assets.fontDigests,
        approvedIcons: [],
        referenceFixture: assetVerification.assets.referenceDigest,
      },
      manualAcceptanceStatus: manualAcceptanceStatus(),
    };
    schemas.assertManifest(manifest);
    const manifestText = canonicalJson(manifest);
    const manifestDigest = sha256Bytes(Buffer.from(manifestText, "utf8"));
    const expectedManifestPath = path.join(jobDirectory, "render-manifest.json");
    const expectedPngPath = path.join(jobDirectory, "output.png");
    const responseDraft: RenderResponse = {
      schemaVersion: RESPONSE_SCHEMA_VERSION,
      manifestDigest,
      pngDigest,
      manifestPath: expectedManifestPath,
      pngPath: expectedPngPath,
      downloadAllowed: true,
      status: "PASS",
      errors: [],
      warnings: issueGroups.warnings,
    };
    schemas.assertResponse(responseDraft);

    try {
      const published = await publishArtifacts({
        outputRoot,
        jobDirectory,
        png,
        manifest: manifestText,
        overwrite: canonicalInput.output.overwrite,
      });
      const response: RenderResponse = {
        ...responseDraft,
        manifestPath: published.manifestPath,
        pngPath: published.pngPath,
      };
      return response;
    } catch (error) {
      if (error instanceof PublishError) {
        return failureResponse([
          ...allIssuesBeforePublish,
          createIssue(contracts.errorRegistry, error.code, "/output"),
        ]);
      }
      throw error;
    }
  }

  async function renderSafe(request: unknown): Promise<RenderResponse> {
    try {
      return await render(request);
    } catch (error) {
      if (process.env.KBR_DEBUG === "1") {
        process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      }
      return failureResponse([
        createIssue(contracts.errorRegistry, "KBR-SYSTEM-005", "/"),
      ]);
    }
  }

  return {
    render: renderSafe,
    async renderJson(json: string): Promise<RenderResponse> {
      const parsed = parseJsonInput(json, contracts);
      return parsed.valid ? renderSafe(parsed.value) : failureResponse(parsed.issues);
    },
  };
}

export function assertDownloadAllowed(response: RenderResponse, contracts: ContractBundle): void {
  if (!response.downloadAllowed) {
    const issue = createIssue(contracts.errorRegistry, "KBR-DOWNLOAD-001", "/downloadAllowed");
    throw new Error(`${issue.code}:${issue.messageKey}`);
  }
}

export async function readRenderedManifest(response: RenderResponse): Promise<RenderManifest | null> {
  if (!response.downloadAllowed || response.manifestPath === null) return null;
  return JSON.parse(await readFile(response.manifestPath, "utf8")) as RenderManifest;
}

export function rendererVersion(): string {
  return RENDERER_VERSION;
}

export function contractsForTesting(contracts: ContractBundle): ContractBundle {
  return contracts;
}
