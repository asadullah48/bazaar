# Bazaar storefront phase 1 — audit and validation

This draft is UI/UX and bug fixes on **Next.js 14.2.35**. The framework upgrade is reverted; the package, lockfile, lint package and TypeScript configuration retain the repository's original version/configuration. Baseline source: `bf54e04eb6cc231a92b0bfd6479ef5684f513fa7`. No portfolio repository changes, merge or production deployment.

## Audit — worst first

1. **Checkout contract was broken:** local product IDs were not the variant-based server cart; the required address was omitted. Added address collection, real variant selection and server-cart synchronization; conflicting account carts are blocked without deleting their contents.
2. **Payment failure lost the cart:** checkout cleared items before payment initiation and submitted the outer hosted-form wrapper. Items remain after failure, retry reuses the created session, and POST fields are unpacked correctly. A browser regression checks the exact hosted form fields without contacting a provider.
3. **Unsupported trust claims:** the home page asserted seller/product totals and payment assurances; product ratings inherited seller aggregates. Removed static promotional claims and calculate product ratings only from visible product reviews. No review data means no rating strip.
4. **Catalog response mismatch:** summary rows were treated as full products. The storefront now consumes the actual summary shape and fetches real detail data; seller cards no longer invent stock.
5. **Mobile overflow:** header controls compressed search and the closed cart drawer remained off-canvas/focusable. Search has its own mobile row; the native dialog removes closed content from interaction. Screenshot inventory: 10 before captures wider than their viewport, 0 after.
6. **Weak discovery controls:** added category, price range, retail/wholesale eligibility, supported sorts, actual result counts, preserved pagination/filter URLs, empty/error states and loading skeletons.
7. **Incomplete product buying context:** added real variant selection, actual specifications, wholesale tier table and quote action; gallery remains reserved in a consistent ratio. Wholesale badges require actual tiers. Internal variant cost fields are excluded from the public response.
8. **Card interaction problems:** removed nested links/buttons, retain keyboard access, clamp titles, reserve image ratios, format PKR decimals and provide a visible cart action.
9. **Keyboard/RTL gaps:** native modal focus handling, Escape dismissal, visible focus rings, labelled controls, Urdu protection-prefix fix, and language switches that preserve filters.
10. **Visual stability and accessibility:** removed build-time external font fetching, improved contrast and heading order, and tested EN/AR/UR buying surfaces against automated WCAG 2.1 AA rules.

## Exact build and test results

### Original storefront fresh-clone validation

This records the original storefront run. The later dependency-security follow-up and its separate validation attempts are recorded under **Known vulnerabilities** below.

Validated the **pushed** commit `316131d825ed7af9e87db8ff4e4130ddcbc21dcb` from a new clone outside the apostrophe path, with no source edits or reused `node_modules`/build cache. Platform: Windows, Node v24.19.0, npm 12.2.0. This is not a Linux validation claim.

Command, from `frontend/`: `npm ci && npm run build && npx playwright test`.

- `npm ci`: `added 523 packages, and audited 524 packages in 3m`; succeeded. Reported `12 vulnerabilities (2 moderate, 9 high, 1 critical)`, deprecation warnings and blocked install-script warnings.
- `npm run build`: succeeded on **Next.js 14.2.35**, with 7 lint warnings. Webpack emitted cache-dependency parsing warnings; the browser server emitted standalone-start and metadataBase warnings. Exact output is retained.
- `npx playwright test`: **`10 passed (24.2s)`**.
- Overall command exit code: **0**.

[Exact fresh-clone command output](storefront/fresh-clone-validation.txt). Refreshed after screenshots and Playwright JSON come from this run. Subsequent evidence-only commits do not change the validated source or lockfile. The missing SWC helper lock entry was regenerated from package.json, the unused seller-page `storeName` was removed, and the original TypeScript configuration was restored.

The earlier successful build was performed in a separate source copy and did **not** establish that pushed commit `91e2114` built. That revision had the lockfile mismatch and unused-variable error reported by review. The new fresh-clone result supersedes that earlier claim.

**The backend suite is not passing.** The same four pre-existing failures occur before and after.

| Check | Before | After |
|---|---|---|
| Frontend production build | Next.js 14.2.35 source copy, completed, 7 lint warnings | Pushed commit 316131d fresh clone: Next.js 14.2.35, exit 0, 7 lint warnings |
| Existing backend suite | 87 passed, 4 failed, 336 warnings in 675.23s | 87 passed, 4 failed, 336 warnings in 679.37s |
| Added backend regressions (separate run) | Not present | 4 passed, 5 warnings in 11.11s |
| Playwright | No frontend test script in baseline | Fresh clone: 10 passed — 24.2s |
| TypeScript | Not separately run | `npm run typecheck`, exit 0 |

The current backend collects **95 tests** (0.48s); the original suite and new regressions were executed separately. Do not read this as a claim that the whole backend passed.

Pre-existing failures, present in both complete original-suite runs:

- `tests/test_catalog.py::test_product_detail` — requests a UUID from the slug route; `assert 404 == 200`.
- `tests/test_order_fsm.py::test_seller_advances_order` — `RuntimeError: Event loop is closed` in Redis/ARQ-backed order advancement.
- `tests/test_reviews.py::test_duplicate_review_returns_409` — the same closed-event-loop failure during fixture order advancement.
- `tests/test_reviews.py::test_get_product_reviews` — the same closed-event-loop failure during fixture order advancement.

Raw output (machine-specific filesystem roots redacted): [frontend before](frontend-before.txt), [frontend after](frontend-after.txt), [backend before](backend-before.txt), [backend after](backend-after.txt), [new backend regressions](backend-regressions.txt), [backend collection](backend-collection-after.txt), [Playwright](storefront/playwright-after.txt), [typecheck](storefront/typecheck-after.txt).

The initial workspace build was blocked by external font DNS and an apostrophe-path metadata-loader defect. Both final builds used separate source copies without that path problem. Baseline backend assertions were unchanged; only isolated database connection details were adjusted. Current tests support an explicit test-only database override.

## Known vulnerabilities

`npm audit --json` on the pushed branch's original lockfile reported **12 vulnerable package entries: 1 critical, 9 high and 2 moderate**. These are package entries, including inherited dependency findings, not twelve independent exploits. [Raw before audit](storefront/npm-audit-before.json).

| Package | Severity | Relationship reported by audit | Available fix and decision |
|---|---|---|---|
| `@next/eslint-plugin-next` | High | Transitive | Inherits `glob`; npm proposes eslint-config-next 16.4.2 (major). Instead, scoped override updates its glob to 10.5.0 without changing plugin/Next major. |
| `braces` | High | Transitive | Latest published 3.0.3 remains affected. npm proposes Tailwind 4.3.3 (major) to leave the dependency chain; unchanged. |
| `chokidar` | High | Transitive | Inherits `braces`; npm proposes Tailwind 4.3.3 (major); unchanged. |
| `eslint-config-next` | High | Direct | Inherits plugin/glob finding; same scoped glob fix, keeping eslint-config-next 14.2.35. |
| `fast-glob` | High | Transitive | Inherits micromatch/braces; npm proposes Tailwind 4.3.3 (major); unchanged. |
| `glob` | High | Transitive | Compatible minor fix 10.3.10 → 10.5.0, scoped to @next/eslint-plugin-next. |
| `micromatch` | High | Transitive | Inherits `braces`; npm proposes Tailwind 4.3.3 (major); unchanged. |
| `next` | Critical | Direct | npm proposes Next 16.4.2 (major); unchanged at 14.2.35. No published 14.2 release beyond 14.2.35 was returned by the registry query. Removing the nested PostCSS finding does not fix Next's own advisories. |
| `postcss` | High | Transitive vulnerable instance | Next's nested 8.4.31 is affected; scoped compatible minor override to 8.5.30. The separately declared direct PostCSS instance was already 8.5.30 and was not the vulnerable node. |
| `postcss-nested` | Moderate | Transitive | Inherits selector-parser finding; npm proposes Tailwind 4.3.3 (major); unchanged. |
| `postcss-selector-parser` | Moderate | Transitive | Fixed range starts at 7.1.6, a major change from installed 6.1.4. Latest published 6.x returned was 6.1.4; unchanged. |
| `tailwindcss` | High | Direct | Inherits braces and selector-parser chains; npm proposes 4.3.3 (major). Latest published 3.x returned was 3.4.19; unchanged. |

The two overrides are restricted to their affected parents and retain each overridden package's major version. No direct dependency or vulnerable package received a major upgrade, and no `npm audit fix --force` was run. The glob minor release changes its own internal dependency requirement: the lockfile now resolves jackspeak 3.4.3 instead of 2.3.6 and adds package-json-from-dist 1.0.1. These are glob's declared internal dependencies, not overrides across their major versions. The [glob advisory](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) identifies 10.5.0 as patched. Audit JSON includes every advisory URL and range, including [PostCSS source-map disclosure](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [braces exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), and [selector parsing exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).

Next's own critical/high advisories remain unresolved under the requested 14.2.x constraint. This work does not establish exploitability or safety of a deployment. Major upgrades and security exploit testing were not performed. See the after audit and fresh-clone validation evidence below for measured results.

After the compatible fixes, `npm audit --json` reports **8 entries: 1 critical, 5 high and 2 moderate**, and exits **1** because findings remain. [Raw after audit](storefront/npm-audit-after.json). The removed entries are `glob`, `@next/eslint-plugin-next`, `eslint-config-next` and `postcss`. The remaining entries are `next`, `braces`, `chokidar`, `fast-glob`, `micromatch`, `postcss-nested`, `postcss-selector-parser` and `tailwindcss`. Lockfile inspection confirms glob 10.5.0 and a deduplicated PostCSS 8.5.30, with Next and eslint-config-next both still 14.2.35.

### Security follow-up validation attempts

The first new clone of pushed security commit `0c4ba4823a22e4eb41aa2aca01699302638dad88` completed install/build, but Playwright reported **8 failed / 2 passed (4.4m)** and the sequence exited **1**. No configured API URL was supplied, so the app used localhost:8000. A direct diagnostic during the run returned HTTP 200 and the DEMO catalog from `127.0.0.1:8000/v1/products`, but HTTP 404 from `localhost:8000/v1/products`. [Exact failed output](storefront/security-default-api-failed.txt) · [Failed Playwright JSON](storefront/security-default-api-failed.json).

The failed run also exposed an API-error-state `color-contrast` finding on `.bg-orange-500`; that state is not covered by the successful DEMO catalog journeys. It is recorded here and was not changed in this dependency-only follow-up.

The second new clone, configured with an explicit IPv4 API URL, also completed install/build but timed out waiting for the port-8000 fixture readiness URL; the sequence exited **1** before browser assertions ran. [Exact startup-failure output](storefront/security-ipv4-startup-failed.txt). Subsequent inspection found existing IPv6 listeners on that shared port. Those services were not stopped.

Playwright now honors the fixture's existing `DEMO_API_PORT` setting in its readiness URL. Port 19180 was checked with a loopback bind. For the isolated fixture run, set `DEMO_API_PORT=19180` and `NEXT_PUBLIC_API_URL=http://127.0.0.1:19180` **before** building. The command sequence itself remains `npm ci && npm run build && npx playwright test`. This changes test startup configuration only; no product code or assertions were changed.

[Installed dependency tree](storefront/security-installed-dependencies.json) (exit 0) confirms the overridden versions; [installed audit](storefront/npm-audit-installed.json) (exit 1) independently confirms the same 8 remaining entries.

### VERIFIED — final security follow-up run

A further fresh clone of **pushed commit `a2f2976d00333943bd26a6d4f8f10d783ac577a6`** ran the exact sequence `npm ci && npm run build && npx playwright test`, with `DEMO_API_PORT=19180` and `NEXT_PUBLIC_API_URL=http://127.0.0.1:19180` set before the command. Platform: **Windows**, Node v24.19.0, npm 12.2.0. No source edits, reused node_modules or build cache; a post-run diff confirmed the source, manifests, lockfile and TypeScript/Playwright configuration were unchanged.

- Install: **`added 523 packages, and audited 524 packages in 2m`**; succeeded.
- Production build: **Next.js 14.2.35**, succeeded, **7 lint warnings**. Cache/startup warnings and npm's blocked install-script warnings are retained in the transcript.
- Playwright: **`10 passed (27.9s)`**.
- Overall sequence exit code: **0**.
- Audit: **12 → 8 vulnerable package entries**; remaining **1 critical, 5 high, 2 moderate**. Audit exit code remains **1**.

[Exact final command output](storefront/security-fresh-clone-validation.txt) · [Final Playwright JSON](storefront/security-playwright.json). Later evidence-only commits do not change the validated source or lockfile. The final evidence hygiene check covered **81 files and 40 screenshots**, with **0 remaining absolute local-path matches**.

### NOT VERIFIED

Linux execution, exploitability of the remaining advisories in a deployed configuration, production security and live provider processing were not verified. No direct dependency or audited package received a major upgrade; no forced audit fix was performed. The passing fixture journeys do not verify the API-error-state contrast issue recorded above. Backend tests and Lighthouse were not rerun for this dependency-only follow-up; their earlier results remain historical evidence. No merge, deployment or portfolio change was performed.

## Mobile Lighthouse — Next.js 14 before and after

One sequential run per page/locale, at 390px mobile emulation, with the same browser and Lighthouse settings. These earlier source-copy measurements precede the regenerated lockfile; they are not fresh-clone Lighthouse measurements. These are local, clearly labelled demo-fixture measurements, not production traffic benchmarks.

| Page | Performance before → after | Accessibility before → after | CLS before → after |
|---|---|---|---|
| EN home | 63 → 98 | 92 → 100 | 0 → 0 |
| EN search | 87 → 99 | 94 → 100 | 0 → 0 |
| AR home | 69 → 97 | 92 → 100 | 0 → 0 |
| AR search | 84 → 99 | 94 → 100 | 0 → 0 |

[Exact metrics, including LCP](storefront/mobile-metrics.json) · [before Lighthouse output](storefront/lighthouse-before.txt) · [after Lighthouse output](storefront/lighthouse-after.txt). Raw Lighthouse JSON files are alongside these outputs. Automated scores are not a site-wide accessibility certification.

## Screenshots

**20 before + 20 after**: home, search, product, cart and checkout at 1440px and 390px, in EN and AR. Catalog data and product imagery are explicitly DEMO; no live marketplace activity or real provider acceptance is implied. Original baseline branding/promotions remain visible as audit evidence.

[Dimensions, framework versions and capture inventory](storefront/screenshots.json) · [baseline capture metadata](storefront/before-capture.json) · [evidence hygiene](storefront/evidence-hygiene.json).

| Locale / viewport | Page | Before | After |
|---|---|---|---|
| EN / 1440 | home | [view](storefront/before/en-1440-home.png) | [view](storefront/after/en-1440-home.png) |
| EN / 1440 | search | [view](storefront/before/en-1440-search.png) | [view](storefront/after/en-1440-search.png) |
| EN / 1440 | product | [view](storefront/before/en-1440-product.png) | [view](storefront/after/en-1440-product.png) |
| EN / 1440 | cart | [view](storefront/before/en-1440-cart.png) | [view](storefront/after/en-1440-cart.png) |
| EN / 1440 | checkout | [view](storefront/before/en-1440-checkout.png) | [view](storefront/after/en-1440-checkout.png) |
| EN / 390 | home | [view](storefront/before/en-390-home.png) | [view](storefront/after/en-390-home.png) |
| EN / 390 | search | [view](storefront/before/en-390-search.png) | [view](storefront/after/en-390-search.png) |
| EN / 390 | product | [view](storefront/before/en-390-product.png) | [view](storefront/after/en-390-product.png) |
| EN / 390 | cart | [view](storefront/before/en-390-cart.png) | [view](storefront/after/en-390-cart.png) |
| EN / 390 | checkout | [view](storefront/before/en-390-checkout.png) | [view](storefront/after/en-390-checkout.png) |
| AR / 1440 | home | [view](storefront/before/ar-1440-home.png) | [view](storefront/after/ar-1440-home.png) |
| AR / 1440 | search | [view](storefront/before/ar-1440-search.png) | [view](storefront/after/ar-1440-search.png) |
| AR / 1440 | product | [view](storefront/before/ar-1440-product.png) | [view](storefront/after/ar-1440-product.png) |
| AR / 1440 | cart | [view](storefront/before/ar-1440-cart.png) | [view](storefront/after/ar-1440-cart.png) |
| AR / 1440 | checkout | [view](storefront/before/ar-1440-checkout.png) | [view](storefront/after/ar-1440-checkout.png) |
| AR / 390 | home | [view](storefront/before/ar-390-home.png) | [view](storefront/after/ar-390-home.png) |
| AR / 390 | search | [view](storefront/before/ar-390-search.png) | [view](storefront/after/ar-390-search.png) |
| AR / 390 | product | [view](storefront/before/ar-390-product.png) | [view](storefront/after/ar-390-product.png) |
| AR / 390 | cart | [view](storefront/before/ar-390-cart.png) | [view](storefront/after/ar-390-cart.png) |
| AR / 390 | checkout | [view](storefront/before/ar-390-checkout.png) | [view](storefront/after/ar-390-checkout.png) |

## Payment implementation and remaining limits

Inspected `backend/app/services/payment.py` and configuration defaults.

| Method | Actual implementation |
|---|---|
| JazzCash | Backend adapter; sandbox by default, with production endpoint branches. Not UI-only. Successful sandbox transactions and live merchant processing are unverified. |
| Easypaisa | Backend adapter including HTTP initiation; sandbox by default, with a production endpoint branch. Not UI-only. Successful sandbox transactions and live merchant processing are unverified. |
| Card | Partial Checkout.com backend adapter, sandbox by default; payment-source/tokenization flow is incomplete. Card payment is unavailable in this phase's checkout. |

Online checkout exposes configured sandbox methods only. No provider transaction was attempted during this audit. Backend tests use isolated database/Redis services; browser tests use a labelled local fixture API and a non-credential demo authentication marker. They do not validate live payment acceptance or a production sign-in flow.

The existing backend failures remain open. Catalog cards currently use bounded detail requests after summary retrieval; production-scale catalog performance needs separate profiling. Conflicting cross-device account carts are blocked for review. Payment retry is protected in the current checkout view; resuming a pending payment after a full page reload remains follow-up work.

## Reproduce the local browser audit

Use a checkout path without an apostrophe on Windows. Install the locked frontend dependencies. Audit scripts require a Node version supported by the locked Lighthouse package.

For the clean validation above, use `npm ci && npm run build && npx playwright test` from `frontend/`. Playwright starts the DEMO API on port 8000 and the production app on port 3000 automatically; both ports must be free. On a machine without the Playwright Chromium browser, install it first with `npx playwright install chromium`. The following separate-port procedure reproduces the original source-copy audit:

1. Start the fixture API from `frontend/`: set `DEMO_API_PORT=18000`, then run `node scripts/demo-api.cjs`. All fixture products/sellers are labelled DEMO.
2. Build the changed app with `NEXT_PUBLIC_API_URL=http://127.0.0.1:18000` and `npm run build`. Copy `public` and `.next/static` into the corresponding standalone directories. Run `.next/standalone/server.js` with `PORT=3005` and loopback `HOSTNAME`.
3. Set `STOREFRONT_URL=http://localhost:3005` and run `npm run test:e2e`.
4. Serve the original baseline on a separate port. Set `BASELINE_URL` and run `node scripts/capture-before.cjs`. Run `node scripts/lighthouse.mjs before BASELINE_PORT`, then `node scripts/lighthouse.mjs after 3005`.
5. Run `node scripts/screenshot-inventory.mjs`, then `node scripts/sanitize-evidence.mjs`. The hygiene report checks all published evidence text and screenshot metadata. PNG text/EXIF metadata is stripped when present; path redaction preserves counts, durations and errors. The final check covered 72 evidence files and 40 screenshots, with zero remaining machine-specific path matches. No PNG text/EXIF chunks were present.

## Portfolio card changes needed — proposal only

**Before (supplied claim text):** “Pakistan's first unified B2B + B2C marketplace. 500+ verified sellers, 10K+ products, JazzCash/Easypaisa/Card, EN/UR/AR.”

**After:** “Bazaar — a B2B and B2C marketplace project built with **Next.js 14** and FastAPI, with English, Urdu and Arabic storefront routes. JazzCash and Easypaisa backend adapters default to sandbox; the Checkout.com card adapter is partial. Successful sandbox transactions and live merchant processing are unverified.”

Keep the tech label at **Next.js 14** unless a separate framework-upgrade PR merges. No portfolio files were edited.
