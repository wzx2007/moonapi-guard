# Validation record — 2026-09-21

Reference environment: Windows x86-64, MoonBit and Node versions in TOOLCHAIN.md.

| Check | Observed result |
|---|---|
| moon check --deny-warn | passed, zero warnings/errors |
| moon test --target wasm-gc | 78 passed, 0 failed |
| moon test --target js | 78 passed, 0 failed |
| release JavaScript bridge build | passed |
| Node engine and CLI tests | 98 passed, 0 failed |
| Generated numeric-bound comparisons | 200 assertions passed within the Node suite |
| Exhaustive 3-value enum subset comparisons | 98 assertions passed within the Node suite |
| Branching recursive-reference resource limit | returns incomplete with WORK_LIMIT |
| CLI breaking fixture | 7 breaking, complete=true, exit 1 |
| CLI compatible fixture | compatible, exit 0 |
| CLI review fixture | incomplete, exit 3 by default |
| Explicit CLI policies | breaking-only / report-only behave as documented; invalid remains exit 2 |
| HTML escaping | hostile document strings escaped |
| File output / UTF-8 BOM / paths with spaces | passed |

Browser checks were performed against the actual local app in the Codex in-app browser: initial sample loading; seven findings for the breaking example; compatible and manual-review scenarios; invalid JSON; filtering to no results and back; stale exports disabled after input changes; desktop screenshot inspection. No browser console errors were observed during these checks. The preview image is docs/preview.png.

Automated Node tests call the shipping MoonBit-compiled JS module. The 78 behavioral fixtures are also compiled into genuine MoonBit black-box tests and run on two backends. Counts overlap by design; they are not 254 independent specifications. Generated comparisons are assertions inside test cases, not separately reported Node test cases.

This record does not claim full OAS conformance, exhaustive proof of compatibility, Linux/macOS local verification, a completed hosted CI run, mobile browser verification, or organizer acceptance. The GitHub Actions configuration is supplied and will run after the repository is published.

Reproduction: npm run verify. To modify fixtures: edit tests/cases.mjs, run node scripts/generate-tests.mjs, then moon fmt and npm run verify.
