/** Populate only demo brands; repeat runs skip already populated brands. */
require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../src/db');
const catalog = {
  lumera: [['Sérum Éclat',249,65,120],['Crème Nuage',189,48,8],['Coffret Rituel',449,130,65],['Gel Douceur',129,32,0]],
  noria: [['Gourde Nomade',199,55,150],['Sac Week-end',399,145,12],['Trousse Voyage',149,38,85],['Organiseur Essential',229,70,45]],
  'atlas-studio': [['Sac Horizon',349,120,95],['Pochette Dune',149,45,9],['Cabas Atlas',279,85,60],['Portefeuille Sable',199,60,110]],
};
const cities=['Casablanca','Rabat','Marrakech','Tanger','Fès','Agadir','Meknès','Kénitra'];
const names=['Amine','Salma','Youssef','Lina','Imane','Mehdi','Nour','Adam','Sara','Rayan','Hiba','Omar'];
const calls=['Confirmé','Confirmé','Confirmé','Confirmé','Confirmé','Confirmé','Nouveau','Appel 1','Pas de réponse','Reporté','Annulé','WhatsApp / SMS'];
const ships=['Livré','Livré','Livré','Livré','Mise En Distribution','Retourné','Refusé','Reporté'];
async function main(){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [[sarah]]=await db.query('SELECT confirmer_id FROM users WHERE email=?',['confirmer1@dashboard.local']);
  if(!sarah?.confirmer_id) throw new Error('Run ensure_demo_accounts.js first.');
  const [[carrier]]=await db.query('SELECT id,name FROM shipping_companies ORDER BY id LIMIT 1');
  for(const [slug,items] of Object.entries(catalog)){
   const [[brand]]=await db.query('SELECT id,name FROM brands WHERE slug=?',[slug]);
   if(!brand) throw new Error(`Missing demo brand: ${slug}`);
   const [[existing]]=await db.query('SELECT COUNT(*) AS n FROM orders WHERE brand_id=? AND note LIKE ?',[brand.id,'[DEMO-V1]%']);
   if(existing.n){console.log(`${brand.name}: demo data already present, skipped.`);continue;}
   const products=[];
   for(const [name,price,cost,stock] of items){
    let [[p]]=await db.query('SELECT id FROM products WHERE brand_id=? AND name=?',[brand.id,name]);
    if(!p){const [r]=await db.query('INSERT INTO products (brand_id,name,price,cost,delivery_fee,stock,min_stock_alert) VALUES (?,?,?,?,?,?,?)',[brand.id,name,price,cost,30,stock,15]);p={id:r.insertId};}
    products.push({...p,name,price,cost});
   }
   const agentName=`${slug==='lumera'?'Lina':slug==='noria'?'Nour':'Hiba'} Démo`;
   let [[agent]]=await db.query('SELECT id FROM confirmers WHERE brand_id=? AND name=?',[brand.id,agentName]);
   if(!agent){const [r]=await db.query('INSERT INTO confirmers (brand_id,name) VALUES (?,?)',[brand.id,agentName]);agent={id:r.insertId};}
   for(const id of [sarah.confirmer_id,agent.id]) await db.query('INSERT IGNORE INTO confirmer_brands (confirmer_id,brand_id) VALUES (?,?)',[id,brand.id]);
   for(let i=0;i<180;i++){
    const p=products[i%products.length],daysAgo=i<12?0:1+((i*7+i%5)%59);
    const call=calls[(i+Math.floor(i/12))%calls.length];
    const ship=call==='Confirmé'?ships[(i+Math.floor(i/8))%ships.length]:'En attente';
    await db.query(`INSERT INTO orders (brand_id,product_id,product_name,quantity,price,cost,delivery_fee,customer_name,phone,city,address,note,call_status,shipping_status,shipping_company,shipping_company_id,confirmer_id,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,TIMESTAMP(DATE_SUB(CURDATE(),INTERVAL ? DAY),'08:00:00'))`,[brand.id,p.id,p.name,1+(i%7===0?1:0),p.price,p.cost,30,`${names[i%names.length]} Client Démo ${i+1}`,`000${String(brand.id).padStart(3,'0')}${String(i).padStart(4,'0')}`,cities[(i+brand.id)%cities.length],'Adresse fictive — démonstration uniquement','[DEMO-V1] Commande fictive pour tester le suivi. Ne pas contacter ni expédier.',call,ship,call==='Confirmé'?(carrier?.name||null):null,call==='Confirmé'?(carrier?.id||null):null,i%3===0?agent.id:sarah.confirmer_id,['landing','manual','landing'][i%3],daysAgo]);
   }
   for(let i=0;i<12;i++) await db.query('INSERT INTO expenses (brand_id,type,amount,label,date) VALUES (?,?,?,?,DATE_SUB(CURDATE(),INTERVAL ? DAY))',[brand.id,i%3===0?'charge':'ads',i%3===0?180+i*15:320+i*25,`[DÉMO] ${i%3===0?'Emballage et préparation':i%2?'Campagne Meta':'Campagne TikTok'}`,i*5]);
   console.log(`${brand.name}: 4 products, 180 orders, 12 expenses; demo agents assigned.`);
  }
  await db.commit();
 }catch(e){await db.rollback();throw e;}finally{db.release();await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
