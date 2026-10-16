const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const baseline=process.env.BASELINE_URL||'http://localhost:3004';
(async()=>{
 const browser=await chromium.launch({headless:true}); const records=[];
 for(const locale of ['en','ar'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addCookies([{name:'bazaar-auth',value:JSON.stringify({state:{accessToken:'DEMO-NOT-A-CREDENTIAL'}}),domain:'localhost',path:'/'}]);
  await context.addInitScript(()=>localStorage.setItem('bazaar-auth',JSON.stringify({state:{accessToken:'DEMO-NOT-A-CREDENTIAL',role:'consumer',refreshToken:null},version:0})));
  const page=await context.newPage();
  await page.route('http://localhost:8000/**',async route=>{try {const response=await route.fetch({url:route.request().url().replace('http://localhost:8000','http://127.0.0.1:18000')});await route.fulfill({response});}catch{await route.abort();}});
  await page.route('**/_next/image**',route=>route.request().url().includes('placehold.co') ? route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#f3ebe0"/><text x="120" y="300" font-size="40" fill="#333">DEMO fabric</text></svg>'}) : route.continue());
  const capture=async(name)=>{const target=path.join('..','docs','storefront','before',`${locale}-${width}-${name}.png`);await fs.mkdir(path.dirname(target),{recursive:true});await page.screenshot({path:target,fullPage:true});records.push({locale,width,page:name,url:page.url(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});};
  for(const [name,url] of [['home',`/${locale}`],['search',`/${locale}/search?q=cotton`],['product',`/${locale}/products/demo-cotton`]]){try{const response=await page.goto(`${baseline}${url}`,{waitUntil:'networkidle',timeout:60000});records.push({locale,width,page:name,status:response.status()});await capture(name);}catch(error){records.push({locale,width,page:name,error:error.message});}}
  try{await page.getByRole('button',{name:locale==='ar'?'أضف إلى السلة':'Add to Cart',exact:true}).click();await page.getByRole('dialog').waitFor({state:'visible'});await capture('cart');await page.keyboard.press('Escape');await page.goto(`${baseline}/${locale}/checkout`,{waitUntil:'networkidle'});await capture('checkout');}catch(error){records.push({locale,width,page:'cart/checkout',error:error.message});}
  await context.close();
 }
 await browser.close();await fs.writeFile(path.join('..','docs','storefront','before-capture.json'),JSON.stringify(records,null,2));console.log(JSON.stringify({captures:records.filter(r=>r.url).length,records},null,2));if(records.filter(r=>r.url).length!==20)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
