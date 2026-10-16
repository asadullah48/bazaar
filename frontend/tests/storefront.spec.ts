import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
// Requires scripts/demo-api.cjs and a running storefront. All shown products are DEMO fixtures.
for(const locale of ['en','ar']) for(const width of [1440,390]) {
 test(`${locale} ${width}: storefront journey, semantics and screenshots`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/_next/image**',route=>route.request().url().includes('placehold.co') ? route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#f3ebe0"/><text x="120" y="300" font-size="40" fill="#333">DEMO fabric</text></svg>'}) : route.continue());
  await page.context().addCookies([{name:'bazaar-auth',value:JSON.stringify({state:{accessToken:'DEMO-NOT-A-CREDENTIAL'}}),domain:'localhost',path:'/'}]);
  await page.addInitScript(()=>{localStorage.setItem('bazaar-auth',JSON.stringify({state:{accessToken:'DEMO-NOT-A-CREDENTIAL',role:'consumer',refreshToken:null},version:0}));});
  const screenshot=async(name:string)=>{await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr'); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:path.join('..','docs','storefront','after',`${locale}-${width}-${name}.png`),fullPage:true});};
  await page.goto(`/${locale}`);await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('article')).toHaveCount(1);await screenshot('home');
  expect(await page.locator('a a, a button').count()).toBe(0);
  await page.goto(`/${locale}/search?q=cotton&sort=price_asc`);await expect(page.getByRole('article')).toHaveCount(1);await screenshot('search');
  await page.goto(`/${locale}/products/demo-cotton`);await expect(page.getByRole('heading',{level:1})).toHaveText('DEMO — Cotton fabric');await expect(page.locator('table')).toBeVisible();await screenshot('product');
  // Product has zero reviews: no rating-star strip may be rendered.
  await expect(page.locator('svg.lucide-star.fill-amber-400')).toHaveCount(0);
  await page.getByRole('button',{name:locale==='ar'?'أضف إلى السلة':'Add to Cart',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await screenshot('cart');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await page.goto(`/${locale}/checkout`);await expect(page.locator('input[name="full_name"]')).toBeVisible();await screenshot('checkout');
  await page.locator('input[name="full_name"]').fill('DEMO buyer');await page.locator('input[name="phone"]').fill('03000000000');await page.locator('input[name="address_line1"]').fill('DEMO address');await page.locator('input[name="city"]').fill('DEMO city');
  await page.getByRole('button',{name:locale==='ar'?'تأكيد الطلب':'Place order',exact:true}).click();await expect(page.getByRole('heading',{level:1})).toContainText(locale==='ar'?'تم استلام الطلب':'Order received');
 });
}
test('filters preserve query and show empty state',async({page})=>{await page.goto('/en/products?q=nothing&min_price=1&sort=price_desc');await expect(page.getByRole('heading',{name:'No matching products'})).toBeVisible();await expect(page.locator('input[name="q"]')).toHaveValue('nothing');await expect(page.locator('select[name="sort"]')).toHaveValue('price_desc');});
test('price range rejects reversed boundaries',async({page})=>{await page.goto('/en/products?min_price=20&max_price=10');await expect(page.getByRole('alert').filter({hasText:'valid price range'})).toContainText('valid price range');});

test('Urdu is RTL and language switching preserves filters',async({page})=>{await page.setViewportSize({width:390,height:900});await page.goto('/ur/products?q=cotton&sort=price_asc');await expect(page.locator('html')).toHaveAttribute('dir','rtl');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.getByRole('button',{name:'EN',exact:true}).click();await expect(page).toHaveURL(/\/en\/products\?q=cotton&sort=price_asc/);});

test('sandbox failure preserves cart and retry does not create another order',async({page})=>{
 let checkoutCalls=0;
 await page.route('**/v1/checkout',async route=>{checkoutCalls++;await route.fulfill({response:await route.fetch()});});
 await page.addInitScript(()=>{
  localStorage.setItem('bazaar-auth',JSON.stringify({state:{accessToken:'DEMO-NOT-A-CREDENTIAL',role:'consumer'},version:0}));
  localStorage.setItem('bazaar-cart',JSON.stringify({state:{items:[{product_id:'10000000-0000-4000-8000-000000000001',variant_id:'30000000-0000-4000-8000-000000000001',name:'DEMO — Cotton fabric',slug:'demo-cotton',image_url:'https://placehold.co/600x600',price:1250.5,quantity:1,stock_qty:12,seller_name:'DEMO seller'}]},version:0}));
 });
 await page.goto('/en/checkout');
 await page.getByRole('radio',{name:/jazzcash/}).check();
 for(const [name,value] of Object.entries({full_name:'DEMO buyer',phone:'03000000000',address_line1:'DEMO address',city:'DEMO city'}))await page.locator(`input[name="${name}"]`).fill(value);
 await page.getByRole('button',{name:'Place order',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Payment could not start'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bazaar-cart')!).state.items.length)).toBe(1);
 await page.getByRole('button',{name:'Retry payment',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Payment could not start'})).toBeVisible();
 expect(checkoutCalls).toBe(1);
});

test('mobile buying surfaces pass automated WCAG AA rules',async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:900});
 await page.addInitScript(()=>{
  localStorage.setItem('bazaar-auth',JSON.stringify({state:{accessToken:'DEMO-NOT-A-CREDENTIAL',role:'consumer'},version:0}));
  localStorage.setItem('bazaar-cart',JSON.stringify({state:{items:[{product_id:'10000000-0000-4000-8000-000000000001',variant_id:'30000000-0000-4000-8000-000000000001',name:'DEMO — Cotton fabric',slug:'demo-cotton',image_url:'/demo-product.svg',price:1250.5,quantity:1,stock_qty:12,seller_name:'DEMO seller'}]},version:0}));
 });
 const source=readFileSync(path.join('node_modules','axe-core','axe.min.js'),'utf8');
 const check=async()=>{await page.evaluate(source);const result=await page.evaluate('axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})');expect(result.violations.map((v:{id:string;nodes:{target:string[]}[]})=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);};
 for(const locale of ['en','ar','ur']){
  for(const suffix of ['', '/products?q=cotton', '/products/demo-cotton', '/checkout']){await page.goto(`/${locale}${suffix}`);await check();}
  await page.locator('header nav button').last().click();await expect(page.getByRole('dialog')).toBeVisible();await check();await page.keyboard.press('Escape');
 }
});
