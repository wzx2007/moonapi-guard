# Changelog

## 0.2.0 — 2026-09-21

- MoonBit authentication inclusion checks: root inheritance, operation overrides, anonymous alternatives, OR/AND schemes and OAuth scopes. Changes to credential definitions remain review findings.
- SARIF 2.1.0 reports with rule metadata, logical locations and failed-invocation diagnostics.
- CLI worker isolation with configurable timeouts; strict UTF-8; atomic report writes; protection against overwriting source documents, including hardlinks.
- Browser worker isolation, cancellation and stale-result suppression; report search and batches of 200 findings.
- Stricter status-code/content/parameter validation; bounded authentication requirement sizes.
- Expanded cross-backend, credential truth-table, file safety, timeout, browser lifecycle and server tests.
- Still a bounded OpenAPI 3.0 JSON subset; no YAML, full composition reasoning, remote references or runtime API probing.

## 0.1.0 — 2026-09-21

Initial implementation: pure MoonBit OpenAPI 3.0 comparison engine, directional schema checks, local reference resolution, explicit coverage warnings and bounded traversal; Node CLI with four report formats and CI policies; Chinese local browser demo; behavioral, generated and CLI tests; example documents; build and CI scripts; architecture, support, validation and proposal documents.

This release has not yet been published to Mooncakes or registered with the competition.
