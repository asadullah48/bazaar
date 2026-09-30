const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
// Compile only modules under test, using the project's installed TypeScript.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  module._compile(outputText, filename);
};
const { demoResponse, DEMO_PRODUCTS, DEMO_CATEGORIES } = require('../src/lib/demo-catalog.ts');
const { compareQuotes } = require('../src/lib/sourcing.ts');

test('mode is deliberate: a configured live API never enables demo automatically', () => {
  const { outputText } = ts.transpileModule(fs.readFileSync('src/lib/runtime-mode.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const evaluate = env => {
    const context = { exports: {}, process: { env } };
    vm.runInNewContext(outputText, context);
    return context.exports.DEMO_MODE;
  };
  assert.equal(evaluate({}), true);
  assert.equal(evaluate({ NEXT_PUBLIC_API_URL: 'https://api.example.test' }), false);
  assert.equal(evaluate({ NEXT_PUBLIC_DEMO_MODE: 'true', NEXT_PUBLIC_API_URL: 'https://api.example.test' }), true);
  assert.equal(evaluate({ NEXT_PUBLIC_DEMO_MODE: 'false' }), false);
});

test('catalog and detail resolve the same sample product and local artwork', async () => {
  const data = await demoResponse('/v1/products?size=50').json();
  assert.equal(data.total, 12);
  for (const product of data.items) {
    const detail = await demoResponse(`/v1/products/${product.slug}`).json();
    assert.equal(detail.id, product.id);
    assert.ok(fs.existsSync(`public${product.images[0].url}`));
    assert.equal(product.review_count, 0);
  }
  assert.equal(demoResponse('/v1/products/not-a-product').status, 404);
});
test('category and budget filters intersect; pagination does not invent results', async () => {
  const category = DEMO_CATEGORIES.find(c => c.slug === 'textiles').id;
  const data = await demoResponse(`/v1/products?category_id=${category}&max_price=2000`).json();
  assert.deepEqual(data.items.map(p => p.slug), ['linen-fabric']);
  const empty = await demoResponse('/v1/products?page=99').json();
  assert.equal(empty.items.length, 0);
});
test('search finds sample products and handles no matches', async () => {
  const data = await demoResponse('/v1/search?q=cotton').json();
  assert.equal(data.items[0].slug, 'cotton-bedlinen');
  assert.equal((await demoResponse('/v1/search?q=unmatchable').json()).total, 0);
});
test('demo refuses real mutations including accounts, checkout and model calls', async () => {
  for (const path of ['/v1/auth/register', '/v1/checkout', '/v1/payments/initiate', '/v1/seller/ai-describe']) {
    const result = demoResponse(path, 'POST');
    assert.equal(result.status, 503);
    assert.match((await result.json()).detail, /disabled/);
  }
});
test('shortlist uses delivery-inclusive price and excludes MOQ, budget and deadline violations', () => {
  const quotes = compareQuotes(4200, 50, 180000, 14);
  assert.equal(quotes[0].name, 'Faisalabad Wholesale Co.');
  assert.equal(quotes[0].total, 4200 * 0.74 * 50 + 2400);
  assert.ok(quotes[0].eligible);
  assert.equal(compareQuotes(4200, 10, 100000, 14).filter(q => q.eligible).length, 1);
  assert.ok(compareQuotes(4200, 50, 1, 14).every(q => !q.eligible));
  assert.ok(compareQuotes(4200, 50, 1000000, 3).every(q => !q.eligible));
});
test('all supplier profiles resolve and unknown suppliers fail', async () => {
  for (const product of DEMO_PRODUCTS) {
    const data = await demoResponse(`/v1/sellers/${product.seller.slug}`).json();
    assert.ok(data.products.items.some(p => p.id === product.id));
  }
  assert.equal(demoResponse('/v1/sellers/unknown').status, 404);
});
