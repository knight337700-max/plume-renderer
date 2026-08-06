# ADR-0012: Serializable Asset Descriptor and Runtime Resolver

- Status: Accepted
- Date: 2026-08-06
- Scope: Integration input and asset security

## Context

`Blob`, `Uint8Array`, and absolute paths cannot be stable JSON contract values. Desktop session tokens and a future integration token also have different lifetimes and trust roots.

## Decision

Persist only `RendererAssetDescriptor` (`assetId`, MIME, optional declared dimensions/checksum, serializable `assetRef`, and optional analysis). Resolve the reference at runtime through `RendererAssetResolver`. The Core computes the digest and decodes the returned bytes, then compares declared values. No path is included in canonical JSON or fingerprints.

## Consequences

Desktop, fixture, and future integration adapters can implement the resolver independently. Resolver failure, checksum mismatch, decode failure, and dimension mismatch block output. The Renderer Process never receives an arbitrary absolute path.
