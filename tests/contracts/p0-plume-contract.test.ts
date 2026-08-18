import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readJson = (relativePath: string): Record<string, unknown> => JSON.parse(readFileSync(`${root}/${relativePath}`, 'utf8')) as Record<string, unknown>;

describe('P0 neutral PLUME placement boundary', () => {
  it('verifier proves the frozen inventory and fail-closed fixtures', () => {
    const output = execFileSync(process.execPath, ['scripts/verify-p0-plume.mjs'], { cwd: root, encoding: 'utf8' });
    const result = JSON.parse(output) as { status: string; passed: number; total: number; profiles: { total: number; byPlatform: Record<string, number> }; invalidFixtures: { passed: number; total: number }; g0_1SemanticProtection: { passed: boolean; checks: Record<string, boolean> } };
    expect(result.status).toBe('PASS');
    expect(result.passed).toBe(result.total);
    expect(result.profiles).toEqual({ total: 170, byPlatform: { KAKAO: 21, NAVER: 132, META_STATIC: 3, GOOGLE: 14 } });
    expect(result.invalidFixtures).toEqual({ passed: 16, total: 16 });
    expect(result.g0_1SemanticProtection.passed).toBe(true);
    expect(Object.values(result.g0_1SemanticProtection.checks).every(Boolean)).toBe(true);
  });

  it('keeps neutral schema versions and no PLUME runtime dependency', () => {
    const hints = readJson('packages/renderer-contract/schema/placement-capability-hints-v1.schema.json');
    const provenance = readJson('packages/renderer-contract/schema/placement-provenance-envelope-v1.schema.json');
    const freeze = readJson('contracts/p0-plume-architecture-freeze.json');
    const hintsProperties = hints.properties as { schemaVersion?: { const?: string } };
    const provenanceProperties = provenance.properties as { schemaVersion?: { const?: string } };
    expect(hintsProperties.schemaVersion?.const).toBe('1.0.0');
    expect(provenanceProperties.schemaVersion?.const).toBe('1.0.0');
    expect(freeze.rendererDependsOnPlume).toBe(false);
    expect(freeze.runtimeNetworkAccess).toBe('PROHIBITED');
  });

  it('contains exactly one expected-fail record for each registered error code', () => {
    const directory = `${root}/fixtures/p0-plume/invalid`;
    const fixtures = readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')) as { expected: { errorCode: string; evidence: string } });
    expect(fixtures).toHaveLength(16);
    expect(new Set(fixtures.map((fixture) => fixture.expected.errorCode)).size).toBe(16);
    expect(fixtures.every((fixture) => fixture.expected.evidence === 'EXPECTED_FAIL_CONFIRMED')).toBe(true);
  });
});
