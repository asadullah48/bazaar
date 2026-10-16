import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const [phase,port]=process.argv.slice(2);
if(!['before','after'].includes(phase)||!port)throw Error('Usage: node scripts/lighthouse.mjs before|after PORT');
const debugPort=phase === 'before' ? 9223 : 9224;
const browser=await chromium.launch({headless:true,args:[`--remote-debugging-port=${debugPort}`]});
const summary=[];
try{
 for(const locale of ['en','ar']) for(const [name,suffix] of [['home',''],['search','/search?q=cotton']]){
  const url=`http://localhost:${port}/${locale}${suffix}`;
  const result=await lighthouse(url,{port:debugPort,output:'json',logLevel:'error',onlyCategories:['performance','accessibility'],formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}});
  const target=path.join('..','docs','storefront',`lighthouse-${phase}-${locale}-${name}.json`);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,result.report);
  const lhr=result.lhr;const row={phase,locale,page:name,url,performance:lhr.categories.performance.score,accessibility:lhr.categories.accessibility.score,runtimeError:lhr.runtimeError,warnings:lhr.runWarnings,failedAudits:Object.values(lhr.audits).filter(a=>a.score===0).map(a=>({id:a.id,title:a.title,details:a.details}))};summary.push(row);console.log(JSON.stringify({...row,failedAudits:row.failedAudits.map(a=>({id:a.id,title:a.title}))}));
 }
 await fs.writeFile(path.join('..','docs','storefront',`lighthouse-${phase}-summary.json`),JSON.stringify(summary,null,2));
}finally{await browser.close();}
