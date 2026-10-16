// Isolated browser-test fixture server. Never used by the production app.
const http = require('node:http');
const product = {id:'10000000-0000-4000-8000-000000000001',name:'DEMO — Cotton fabric',slug:'demo-cotton',price:1250.5,compare_price:null,stock_qty:12,avg_rating:null,review_count:0,is_b2b_eligible:true,images:[{id:'img-demo',url:'/demo-product.svg',alt:'DEMO cotton fabric placeholder',is_primary:true}],seller:{id:'20000000-0000-4000-8000-000000000001',display_name:'DEMO seller — test fixture',slug:'demo-seller'},description:'DEMO product for local browser testing. Not a real offer.',attributes:{Material:'DEMO cotton',Origin:'Test fixture'},variants:[{id:'30000000-0000-4000-8000-000000000001',sku_code:'DEMO-COTTON',price:1250.5,stock_qty:12,is_active:true}],b2b_tiers:[{id:'demo-tier',min_qty:6,max_qty:12,price_per_unit:1100}]};
let cart=[]; let sequence=0;
const server=http.createServer(async (req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','content-type,authorization');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end('{}');return;}
 const url=new URL(req.url,'http://localhost'); let body=''; for await(const part of req) body+=part;
 const payload=body?JSON.parse(body):{}; let result;
 if(url.pathname==='/v1/categories') result=[{id:'40000000-0000-4000-8000-000000000001',name:'DEMO textiles',slug:'demo-textiles',children:[],icon_url:null}];
 else if(url.pathname==='/v1/products/demo-cotton') result=product;
 else if(['/v1/products','/v1/search'].includes(url.pathname)) {const empty=url.searchParams.get('q')==='nothing';result={items:empty?[]:[{id:product.id,title:product.name,slug:product.slug,brand:'DEMO',condition:'new',min_price:product.price,is_b2b_eligible:true,category_id:null,seller_id:product.seller.id,created_at:'2026-01-01'}],total:empty?0:1,page:1,pages:empty?0:1};}
 else if(url.pathname==='/v1/payments/gateways') result=[{name:'jazzcash',is_active:true,environment:'sandbox',supported_currencies:['PKR'],min_amount:10,max_amount:500000}];
 else if(url.pathname==='/v1/cart') {if(req.method==='DELETE')cart=[]; result={items:cart};}
 else if(url.pathname==='/v1/cart/items'&&req.method==='POST'){cart.push({...payload,id:`demo-cart-${++sequence}`});result={items:cart};}
 else if(url.pathname.startsWith('/v1/cart/items/')&&req.method==='PUT'){cart=cart.map(i=>i.id===url.pathname.split('/').pop()?{...i,quantity:payload.quantity}:i);result={items:cart};}
 else if(url.pathname==='/v1/checkout'){result={checkout_session_id:'demo-session',orders:[{id:'demo-order',total_amount:cart.reduce((n,i)=>n+i.quantity*product.price,0)}]};cart=[];}
 else if(url.pathname==='/v1/payments/initiate')result={success:false,error:'DEMO simulated payment failure'};
 else if(url.pathname.includes('/reviews')) result={items:[],total:0,page:1,pages:0,avg_rating:null};
 else if(url.pathname.includes('/recommendations')) result={items:[]};
 else if(url.pathname.includes('/qr'))result={qr_code_url:null};
 else if(url.pathname.includes('/slots/')) result={items:[]};
 else if(req.method==='POST') result={};
 else {res.statusCode=404;result={detail:'DEMO fixture endpoint unavailable'};}
 res.end(JSON.stringify(result));
});
server.listen(Number(process.env.DEMO_API_PORT||8000),'127.0.0.1',()=>console.log(JSON.stringify({mode:'DEMO TEST FIXTURE ONLY',products:1,reviews:0,stock:product.stock_qty,price:product.price,port:Number(process.env.DEMO_API_PORT||8000)})));
