# Validation record — v0.3.0, 2026-09-27

Local full verification completed on 2026-09-27: moon check --deny-warn passed; 102 MoonBit tests passed on each of wasm-gc and JS; 148 Node tests passed. The tested MoonBit/Node versions remain those recorded in TOOLCHAIN.md. Seven independently tested changes extend file reading, CLI arguments, local server restrictions, rendering, CSV, worker cancellation and release packaging.

The ZIP writer was independently checked with Python zipfile: CRCs and per-file SHA-256 digests passed. Browser interaction evidence below belongs to v0.2.0; v0.3.0 server and rendering changes are covered by automated tests. Current hosted CI status is visible in the repository Actions tab.

## Previous v0.2.0 validation

# Validation record — v0.2.0, 2026-09-21

Reference environment: Windows x86-64, MoonBit and Node versions in TOOLCHAIN.md.

| Check | Observed result |
|---|---|
| moon check --deny-warn | passed, zero warnings/errors |
| moon test --target wasm-gc | 102 passed, 0 failed |
| moon test --target js | 102 passed, 0 failed |
| release JavaScript bridge build | passed |
| Node engine, CLI, stability and server tests | 136 passed, 0 failed |
| Generated numeric-bound comparisons | 200 assertions passed within the Node suite |
| Exhaustive 3-value enum subset comparisons | 98 assertions passed within the Node suite |
| Auth alternative inclusion truth-table oracle | 225 comparisons passed within the Node suite |
| SARIF 2.1.0 output | validated against the official OASIS JSON Schema using Python jsonschema |
| Report cannot overwrite input, including hardlink alias | passed; original bytes preserved |
| Atomic replacement, UTF-8 rejection and timeout exit | passed |
| Browser worker cancellation, stale results, timeout and crash handling | controller unit tests passed |
| Local server method/path restrictions and worker routes | passed |
| Branching recursive-reference resource limit | returns incomplete with WORK_LIMIT |
| CLI breaking fixture | 7 breaking, complete=true, exit 1 |
| CLI compatible fixture | compatible, exit 0 |
| CLI review fixture | incomplete, exit 3 by default |
| Explicit CLI policies | breaking-only / report-only behave as documented; invalid remains exit 2 |
| HTML escaping | hostile document strings escaped |
| File output / UTF-8 BOM / paths with spaces | passed |

Browser checks were performed against the actual local app in the Codex in-app browser. v0.1 checks covered invalid JSON, filtering and stale exports. v0.2 rechecked the shipping worker engine with breaking, compatible, authentication-tightening and manual-review examples, report search (one matching /health finding), and browser console errors (none observed). Cancellation and timeout races are tested deterministically at the worker-controller boundary; no claim is made of a timed UI cancellation test. The preview image is docs/preview.png.

Automated Node tests call the shipping MoonBit-compiled JS module. The 102 behavioral fixtures are also compiled into genuine MoonBit black-box tests and run on two backends. Counts overlap by design and must not be added together as independent specifications. Generated comparisons are assertions inside test cases, not separately reported Node test cases.

SARIF schema source: https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json . Validation tooling was installed only in the build workspace, not added as a project runtime dependency. SARIF uses logical locations; platform-specific Code Scanning upload has not been verified.

This record does not claim full OAS conformance, exhaustive proof of compatibility, Linux/macOS local verification, mobile browser verification, or organizer acceptance. The GitHub Actions configuration is supplied and will run after the repository is published.

Reproduction: npm run verify. To modify fixtures: edit tests/cases.mjs, run node scripts/generate-tests.mjs, then moon fmt and npm run verify.

Hosted CI: GitHub Actions Ubuntu / Node.js 22 run 35574403123 passed on commit 023ef6a: https://github.com/wzx2007/moonapi-guard/actions/runs/35574403123 . This supplements the Windows reference validation above.
