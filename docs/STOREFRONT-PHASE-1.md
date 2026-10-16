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

**The backend suite is not passing.** The same four pre-existing failures occur before and after.

| Check | Before | After |
|---|---|---|
| Frontend production build | Next.js 14.2.35, completed, 7 lint warnings | Next.js 14.2.35, exit 0, 7 lint warnings |
| Existing backend suite | 87 passed, 4 failed, 336 warnings in 675.23s | 87 passed, 4 failed, 336 warnings in 679.37s |
| Added backend regressions (separate run) | Not present | 4 passed, 5 warnings in 11.11s |
| Playwright | No frontend test script in baseline | 10 passed, 0 failed — 21.3s |
| TypeScript | Not separately run | `npm run typecheck`, exit 0 |

The current backend collects **95 tests** (0.48s); the original suite and new regressions were executed separately. Do not read this as a claim that the whole backend passed.

Pre-existing failures, present in both complete original-suite runs:

- `tests/test_catalog.py::test_product_detail` — requests a UUID from the slug route; `assert 404 == 200`.
- `tests/test_order_fsm.py::test_seller_advances_order` — `RuntimeError: Event loop is closed` in Redis/ARQ-backed order advancement.
- `tests/test_reviews.py::test_duplicate_review_returns_409` — the same closed-event-loop failure during fixture order advancement.
- `tests/test_reviews.py::test_get_product_reviews` — the same closed-event-loop failure during fixture order advancement.

Raw output (machine-specific filesystem roots redacted): [frontend before](frontend-before.txt), [frontend after](frontend-after.txt), [backend before](backend-before.txt), [backend after](backend-after.txt), [new backend regressions](backend-regressions.txt), [backend collection](backend-collection-after.txt), [Playwright](storefront/playwright-after.txt), [typecheck](storefront/typecheck-after.txt).

The initial workspace build was blocked by external font DNS and an apostrophe-path metadata-loader defect. Both final builds used separate source copies without that path problem. Baseline backend assertions were unchanged; only isolated database connection details were adjusted. Current tests support an explicit test-only database override.

## Mobile Lighthouse — Next.js 14 before and after

One final sequential run per page/locale, at 390px mobile emulation, with the same browser and Lighthouse settings. Builds and regression tests were finished first. These are local, clearly labelled demo-fixture measurements, not production traffic benchmarks.

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

1. Start the fixture API from `frontend/`: set `DEMO_API_PORT=18000`, then run `node scripts/demo-api.cjs`. All fixture products/sellers are labelled DEMO.
2. Build the changed app with `NEXT_PUBLIC_API_URL=http://127.0.0.1:18000` and `npm run build`. Copy `public` and `.next/static` into the corresponding standalone directories. Run `.next/standalone/server.js` with `PORT=3005` and loopback `HOSTNAME`.
3. Set `STOREFRONT_URL=http://localhost:3005` and run `npm run test:e2e`.
4. Serve the original baseline on a separate port. Set `BASELINE_URL` and run `node scripts/capture-before.cjs`. Run `node scripts/lighthouse.mjs before BASELINE_PORT`, then `node scripts/lighthouse.mjs after 3005`.
5. Run `node scripts/screenshot-inventory.mjs`, then `node scripts/sanitize-evidence.mjs`. The hygiene report checks all published evidence text and screenshot metadata. PNG text/EXIF metadata is stripped when present; path redaction preserves counts, durations and errors. The final check covered 71 evidence files and 40 screenshots, with zero remaining machine-specific path matches. No PNG text/EXIF chunks were present.

## Portfolio card changes needed — proposal only

**Before (supplied claim text):** “Pakistan's first unified B2B + B2C marketplace. 500+ verified sellers, 10K+ products, JazzCash/Easypaisa/Card, EN/UR/AR.”

**After:** “Bazaar — a B2B and B2C marketplace project built with **Next.js 14** and FastAPI, with English, Urdu and Arabic storefront routes. JazzCash and Easypaisa backend adapters default to sandbox; the Checkout.com card adapter is partial. Successful sandbox transactions and live merchant processing are unverified.”

Keep the tech label at **Next.js 14** unless a separate framework-upgrade PR merges. No portfolio files were edited.
