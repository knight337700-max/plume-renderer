import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  CtaRegistry,
  ErrorRegistryEntry,
  FontAssetRegistry,
  ReferenceFixtureRegistry,
} from "./types.js";

type AjvErrorMapping = {
  defaultCode: string;
  keywordMappings: Array<{
    keyword: string;
    defaultCode: string;
    pathOverrides: Array<{
      pointers: string[];
      code: string;
    }>;
  }>;
};

export type ContractBundle = {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  manifestSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  errorRegistry: ReadonlyMap<string, ErrorRegistryEntry>;
  ajvErrorMapping: AjvErrorMapping;
  ctaRegistry: CtaRegistry;
  fontRegistry: FontAssetRegistry;
  referenceRegistry: ReferenceFixtureRegistry;
};

async function readJson<T>(projectRoot: string, relativePath: string): Promise<T> {
  const filePath = path.join(projectRoot, ...relativePath.split("/"));
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function loadContracts(projectRoot: string): Promise<ContractBundle> {
  const [
    inputSchema,
    outputSchema,
    manifestSchema,
    responseSchema,
    errorRegistryJson,
    ajvErrorMapping,
    ctaRegistry,
    fontRegistry,
    referenceRegistry,
  ] = await Promise.all([
    readJson<Record<string, unknown>>(projectRoot, "contracts/input.schema.json"),
    readJson<Record<string, unknown>>(projectRoot, "contracts/output.schema.json"),
    readJson<Record<string, unknown>>(projectRoot, "contracts/render-manifest.schema.json"),
    readJson<Record<string, unknown>>(projectRoot, "contracts/response-envelope.schema.json"),
    readJson<{ codes: ErrorRegistryEntry[] }>(projectRoot, "contracts/error-registry.json"),
    readJson<AjvErrorMapping>(projectRoot, "contracts/ajv-error-mapping.json"),
    readJson<CtaRegistry>(projectRoot, "contracts/cta-registry.json"),
    readJson<FontAssetRegistry>(projectRoot, "contracts/font-asset-registry.json"),
    readJson<ReferenceFixtureRegistry>(projectRoot, "contracts/reference-fixture.json"),
  ]);

  return {
    inputSchema,
    outputSchema,
    manifestSchema,
    responseSchema,
    errorRegistry: new Map(errorRegistryJson.codes.map((entry) => [entry.code, entry])),
    ajvErrorMapping,
    ctaRegistry,
    fontRegistry,
    referenceRegistry,
  };
}
