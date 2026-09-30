# Contributing

Help improve ShopUnity through focused pull requests. Start with an issue describing the buyer or seller problem and an observable acceptance criterion.

Good first contributions include complete EN/AR/UR showcase translations, accessible interface improvements, variant-aware live cart synchronization, seller product creation contract alignment and payment sandbox integration tests.

## Development

Use `frontend/.env.example` to run the backend-free demo. Run `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` before submitting frontend changes. Use `npm run test:e2e` with Chromium installed for buyer journey changes.

Backend changes require PostgreSQL/Redis, applied migrations and relevant integration tests. Document any checks you could not run. Do not modify live provider credentials or send real payments during tests.

Keep illustrative data explicitly labelled. Do not add unverified seller, customer or transaction claims. New external model calls must stay disabled in demo mode and document their data, cost and configuration requirements.
