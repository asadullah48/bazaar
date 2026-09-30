const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const cases = [
  ['/en', '/en'], ['/en/products', '/en/products'],
  ['/en/products?category=textiles&max_price=2000', '/en/products'],
  ['/en/products/cotton-bedlinen', '/en/products/cotton-bedlinen'],
  ['/en/sellers/lahore-textile-studio', '/en/sellers/lahore-textile-studio'],
  ['/en/search?q=cotton', '/en/search'], ['/en/demo', '/en/demo'],
  ['/ur/checkout', '/ur/demo', 'checkout'], ['/ar/admin', '/ar/demo', 'seller'],
  ['/seller', '/en/demo', 'seller'],
];

(async () => {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3011'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  server.stderr.on('data', data => errors += data);
  server.stdout.on('data', () => {});
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try { if ((await fetch('http://127.0.0.1:3011/en')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, errors);
    for (const [path, expectedPath, view] of cases) {
      const response = await fetch(`http://127.0.0.1:3011${path}`);
      assert.equal(response.status, 200, path);
      const url = new URL(response.url);
      assert.equal(url.pathname, expectedPath, path);
      if (view) assert.equal(url.searchParams.get('view'), view);
      assert.match(await response.text(), /Portfolio demo/);
      console.log(`PASS ${path}`);
    }
    assert.equal((await fetch('http://127.0.0.1:3011/en/products/unknown-product')).status, 404);
    console.log('PASS unknown product returns 404');
  } finally { server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
