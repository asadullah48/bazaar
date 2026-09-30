# Buyer handoff and readiness

## Current offering

ShopUnity is a portfolio demonstration of retail and wholesale marketplace workflows, plus a separate commerce backend codebase. It is ready for local demo evaluation. It is not yet certified for live transactions. Defer paid compute until a buyer approves scope and funds a pilot.

The commercially useful differentiator is the sourcing workbench: it considers MOQ, delivery deadline and budget before ranking offers by delivered total. It explains the result, handles no-fit cases, requires human approval and exports a decision brief. The demo does not pretend to obtain live supplier quotes or run an AI model.

## Modes and data boundaries

| Mode | Configuration | Data and behavior |
| --- | --- | --- |
| Portfolio | `NEXT_PUBLIC_DEMO_MODE=true` | Local illustrative catalog; memory-only decision, seller status and receipt; cart persisted in browser localStorage; no backend API or model calls |
| Local default | No API URL and no explicit mode | Same deliberate demo mode |
| Buyer pilot | `NEXT_PUBLIC_DEMO_MODE=false`, configured API URL | Existing commerce backend path; errors remain errors, with no sample-data fallback |

Public environment values are baked into the frontend build. Rebuild after changing mode. Demo protected routes redirect to the workbench and never create an authenticated server identity. Demo payment routes must not be used as proof of settlement.

Arabic and Urdu route/layout infrastructure exists, but new showcase copy remains English. Complete and review translations before claiming full localization.

## Pilot launch gates

These are specific findings from code inspection, not hypothetical requirements:

1. **Cart and checkout contract:** the storefront persists product-level cart items, while the backend checkout reads variant-level server cart rows and expects an address snapshot. Finish variant selection, synchronize server cart and align request/response schemas before enabling real checkout.
2. **Seller product creation:** the frontend submits nested variants, whereas backend product creation and variant creation use separate endpoints. Align this flow and define slug generation/uniqueness before onboarding a real seller.
3. **Backend acceptance:** run migrations and the full integration suite against disposable PostgreSQL/Redis. Some older tests expect detail-by-UUID and variant fields while the public detail endpoint now resolves by slug and returns the storefront shape; update those contracts deliberately.
4. **Provider verification:** validate sandbox callbacks, signature checking, duplicate callback handling, reconciliation and payout behavior for each payment method actually offered. Disable unsupported methods. Validate storage, notification and AI adapters separately; credentials alone do not prove they work.
5. **Security:** replace the development JWT secret, restrict production CORS, review token storage and authorization, validate stock concurrency and define backup/restore procedures. These checks are required before real buyer data or funds.
6. **Operational scope:** agree on delivery, tax, return/refund, seller moderation and support rules with the buyer. Configure monitoring and an explicit monthly spend ceiling before provisioning paid services.
7. **Public deployment:** publish the demo from `frontend`, with demo mode explicitly enabled. Confirm the real domain, mobile behavior and buyer journeys after deployment.

The current changes repair public catalog card data and query handling, including batched image, stock, seller and review data. They do not claim to close the independent checkout and seller onboarding gaps above.

## Buyer walkthrough

1. Browse `/en/products`, filter to textiles and set a maximum price.
2. Open a product, adjust quantity, add it to the cart and create a simulated receipt.
3. Open `/en/demo`, compare wholesale offers, tighten the delivery deadline and observe excluded offers.
4. Set a budget too low for all offers; confirm the workbench selects none.
5. Select a fitting offer, approve the simulation and export the brief. Changing constraints clears approval.
6. Open seller operations, advance fulfilment and reset it. No real shipment is created.

## Hosting after a buyer commits

Use the buyer's approved provider and account. The backend requires PostgreSQL and Redis/arq as well as compute; buying only an API host is insufficient. Keep optional provider integrations disabled until tested. No paid provider was provisioned by this change.

## Verification record

See the pull request for checks run and limitations. Local browser testing requires Chromium; backend integration testing requires Postgres/Redis. Neither missing prerequisite should be disguised as a passing check.
