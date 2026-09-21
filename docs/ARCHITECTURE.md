# Architecture

```text
OpenAPI JSON texts
        │
        ▼
MoonBit compare_text
  ├── bounded JSON parsing
  ├── validate_document / validate_schema
  ├── local reference resolution
  ├── operation + parameter + body + response comparison
  └── directional schema_subset + explicit coverage findings
        │
        ▼
Report (ToJson)
        │
        ▼
MoonBit JS bridge (analyze)
  ├── Node CLI: disk I/O, exit policy, report formatting
  └── browser: text/file input, filters, HTML/JSON download
```

The engine is pure: no network, filesystem, JavaScript FFI, wall clock, or global mutable state. Each request creates its own Context. Output traversal uses sorted keys and duplicate findings are suppressed, giving deterministic reports. Structural JSON equality ignores object member order.

The bridge exports only `analyze(old_text, new_text) -> JSON string`. Both host surfaces use the exact same compiled module. MoonBit behavior tests run under wasm-gc and JavaScript; the Node integration tests validate the shipping JS bridge and the real CLI process.

The JSON model is retained instead of projecting into a lossy OpenAPI AST. This preserves unknown schema keywords so they can be flagged as gaps. Standard local Reference Objects resolve lazily at use sites. Depth and shared work budgets bound recursive graphs; v0.1 deliberately does not claim coinductive recursive-schema inclusion.

Default policy is fail closed on known analysis gaps. The caller can explicitly choose a weaker reporting policy, but the report continues to expose warnings and complete=false. Invalid input never becomes a successful result through a CLI policy override.

The static demo uses system fonts and local files only. Its server binds to 127.0.0.1 and serves an explicit allowlist of paths; no document upload endpoint exists. HTML rendering escapes all document-controlled strings. Editing an input invalidates the previous report and disables exports until recomputation.

## Extending

1. Define behavioral fixtures in tests/cases.mjs, including both request and response directions.
2. Add validation and conservative inclusion logic in MoonBit.
3. Run node scripts/generate-tests.mjs, then moon fmt.
4. Run npm run verify. Update docs/SUPPORT.md and the rule table.
5. Preserve a warning until the entire advertised construct is supported.

Potential next steps: a tested security-requirement comparator, witness-producing enum/bound satisfiability, conservative allOf flattening, and recursive reference memoization. These are future work, not v0.1 features.
