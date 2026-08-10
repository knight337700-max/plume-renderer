# ADR-0053: Keep NAVER editor failures observable and contained

## Status

Accepted for Desktop `0.9.1` (N7.1), with original affected-environment stack still required
before the N7 runtime blocker can be closed.

## Context

N7's dev-only E2E suite did not observe packaged renderer exceptions or assert the app shell after
placement selection. A React exception could therefore present as a white window with no local
evidence.

## Decision

Use a local-only diagnostics IPC and JSONL log under Electron userData. Capture window errors,
unhandled rejections, React component stacks, Main console errors, renderer process exits and
unresponsive events. Put the active editor below an Error Boundary; keep Channel navigation above
it. Resolve capability/source/freeform registry entries explicitly and fail closed when absent.
Add a package click matrix for both unpacked and portable artifacts.

## Consequences

The app remains usable enough to switch to the default screen after an editor failure, and the next
affected run supplies a timestamped stack signature. The log is local and may contain technical
error text, but no creative bytes, remote telemetry, or server dependency is introduced. Desktop
bumps `0.9.0 → 0.9.1`; Core and canonical contract versions do not change.
