# ADR-0011: Agent-ready, Renderer-independent Integration Contract

- Status: Accepted
- Date: 2026-08-06
- Scope: Integration boundary and Renderer Lab

## Context

Future planning producers may be human, a local tool, or an external agent. Coupling the Core Renderer to one producer would make provenance and execution non-portable and would threaten the existing security boundary.

## Decision

Add `Integration Contract v1.0.0` as a separate package and namespace. The Core accepts a serializable request plus a runtime asset resolver and remains unaware of Agents, Plume, OpenAI, queues, databases, and remote services. The existing OBJECT_RIGHT Input, Core pipeline, coordinates, and Golden output remain unchanged. Unsupported capabilities are explicitly `NOT_IMPLEMENTED`.

## Consequences

Manual and future Agent plans use the same schema, validation, adapter, and artifact gate. A later integration may provide an adapter without changing Core. Any missing plan value is an error rather than an inferred default.
