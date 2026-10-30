/**
 * Seed script: creates the admin account, one brand + login + API key
 * per brand (lumera / noria), plus demo products / confirmers / orders / expenses.
 *
 * Run:  npm run seed   (from backend/)
 * WARNING: deletes all demo data first.
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../src/db');

const ADMIN_EMAIL = 'admin@dashboard.local';
const ADMIN_PASS = 'Admin123!';
const BRAND_PASS = 'Brand123!';
const CONFIRMER_EMAIL = 'confirmer1@dashboard.local';
const CONFIRMER_PASS = 'Confirmer123!';

const BRANDS = [
  {
    name: 'Lumera', slug: 'lumera', email: 'lumera@dashboard.local',
    products: [
      { name: 'Crystal Rose', price: 649, cost: 120, delivery_fee: 0 },
      { name: 'Crystal Mauve', price: 649, cost: 120, delivery_fee: 0 },
      { name: 'VitaSilk', price: 299, cost: 100, delivery_fee: 0 },
      { name: 'SOS Therapy', price: 249, cost: 150, delivery_fee: 0 },
      { name: 'SOS Gold', price: 397, cost: 160, delivery_fee: 0 },
      { name: 'SOS Rose Foncé', price: 347, cost: 150, delivery_fee: 0 },
    ],
    confirmers: ['Salma B.', 'Yasmine K.'],
  },
  {
    name: 'Noria', slug: 'noria', email: 'noria@dashboard.local',
    products: [
      { name: 'Keratin Complex', price: 399, cost: 180, delivery_fee: 0 },
      { name: 'Shampoo Cafeine', price: 199, cost: 80, delivery_fee: 35 },
    ],
    confirmers: ['Rania M.', 'Hiba T.'],
  },
  {
    name: 'Atlas Studio', slug: 'atlas-studio', email: 'atlas-studio@dashboard.local',
    products: [{ name: 'Sac Horizon', price: 349, cost: 120, delivery_fee: 30 }, { name: 'Pochette Dune', price: 149, cost: 45, delivery_fee: 30 }],
    confirmers: ['Lina A.', 'Nour S.'],
  },
];

const SHIPPING_COMPANIES = [
  { name: 'Ozon Express', phone: '0522001122', tracking_url_template: 'https://ozon.ma/track?c={TRACKING_NUMBER}' },
  { name: 'Sendit Delivery', phone: '0522334455', tracking_url_template: 'https://sendit.ma/suivi/{TRACKING_NUMBER}' },
  { name: 'Cathedis', phone: '0522667788', tracking_url_template: 'https://cathedis.net/tracking/{TRACKING_NUMBER}' },
  { name: 'Amana Express', phone: '0802006060', tracking_url_template: 'https://barid.ma/suivi/{TRACKING_NUMBER}' },
  { name: 'Yalidine Express', phone: '0982400400', tracking_url_template: 'https://yalidine.app/track/{TRACKING_NUMBER}' },
];

const CALL = ['Confirmé', 'Confirmé', 'Confirmé', 'Appel 1', 'Appel 2', 'Appel 3',
  'Pas de réponse', 'Nouveau', 'Annulé', 'WhatsApp / SMS', 'Reporté'];
const SHIP_OK = ['Livré', 'Livré', 'Livré', 'Mise En Distribution', 'Reporté', 'Retourné', 'Refusé', 'Injoignable'];
const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Agadir', 'Oujda', 'Meknès', 'Kénitra', 'Tétouan'];
const NAMES = ['Ahmed Benali', 'Sara Mansouri', 'Yacine Haddad', 'Lina Cherif', 'Mohamed Kaci',
  'Amel Boumediene', 'Riyad Ziani', 'Nadia Belkacem', 'Karim Djellal', 'Hana Meziane',
  'Walid Saadi', 'Imane Larbi', 'Sofiane Merbah', 'Dounia Ait Ali', 'Bilal Ghezali', 'Manel Rahmani'];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  // wipe demo data
  for (const t of ['confirmer_brands', 'shipping_companies', 'blacklist', 'expenses', 'orders', 'confirmers', 'products', 'users', 'brands']) {
    try {
      await pool.query(`DELETE FROM ${t}`);
    } catch (e) {}
  }

  // 1. Admin account
  await pool.query('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)',
    [ADMIN_EMAIL, bcrypt.hashSync(ADMIN_PASS, 10), 'admin']);

  // 2. Shipping companies
  for (const sc of SHIPPING_COMPANIES) {
    await pool.query('INSERT INTO shipping_companies (name, phone, tracking_url_template) VALUES (?,?,?)',
      [sc.name, sc.phone, sc.tracking_url_template]);
  }

  const allBrandIds = [];

  for (const b of BRANDS) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const [br] = await pool.query(
      'INSERT INTO brands (name, slug, login_email, api_key) VALUES (?,?,?,?)',
      [b.name, b.slug, b.email, apiKey]
    );
    const brandId = br.insertId;
    allBrandIds.push(brandId);

    // Brand login
    await pool.query('INSERT INTO users (email, password_hash, role, brand_id) VALUES (?,?,?,?)',
      [b.email, bcrypt.hashSync(BRAND_PASS, 10), 'brand', brandId]);

    const productIds = [];
    for (const p of b.products) {
      const [r] = await pool.query(
        'INSERT INTO products (brand_id, name, price, cost, delivery_fee) VALUES (?,?,?,?,?)',
        [brandId, p.name, p.price, p.cost, p.delivery_fee || 0]
      );
      productIds.push({ id: r.insertId, ...p });
    }

    const confirmerIds = [];
    for (const c of b.confirmers) {
      const [r] = await pool.query('INSERT INTO confirmers (brand_id, name) VALUES (?,?)', [brandId, c]);
      confirmerIds.push(r.insertId);
    }

    // demo orders (last 45 days)
    const nOrders = b.products.length > 2 ? 42 : b.products.length > 0 ? 30 : 0;
    for (let i = 0; i < nOrders; i++) {
      const p = pick(productIds);
      const qty = ri(1, 3);
      const call = pick(CALL);
      const ship = call === 'Confirmé' ? pick(SHIP_OK) : 'En attente';
      const daysAgo = ri(0, 45);
      await pool.query(
        `INSERT INTO orders (brand_id, product_id, product_name, quantity, price, cost, delivery_fee,
          customer_name, phone, city, call_status, shipping_status, shipping_company, confirmer_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [brandId, p.id, p.name, qty, p.price, p.cost, p.delivery_fee || 0, pick(NAMES),
         '0' + ri(5, 7) + String(ri(10000000, 99999999)), pick(CITIES),
         call, ship, call === 'Confirmé' ? pick(SHIPPING_COMPANIES).name : null, pick(confirmerIds), daysAgo]
      );
    }

    // demo expenses
    if (b.products.length > 0) {
      const ads = [['Meta Ads', 3200], ['TikTok Ads', 1400], ['Meta Ads', 2100]];
      for (const [label, amount] of ads) {
        await pool.query(
          'INSERT INTO expenses (brand_id, type, amount, label, date) VALUES (?,?,?,? , DATE_SUB(CURDATE(), INTERVAL ? DAY))',
          [brandId, 'ads', amount, label, ri(0, 30)]
        );
      }
      await pool.query(
        'INSERT INTO expenses (brand_id, type, amount, label, date) VALUES (?,?,?,?,CURDATE())',
        [brandId, 'charge', 450, 'Packaging']
      );
    }

    console.log(`\nBrand: ${b.name}`);
    console.log(`  login:    ${b.email} / ${BRAND_PASS}`);
    console.log(`  api_key:  ${apiKey}`);
    console.log(`  products: ${b.products.map((p) => p.name).join(', ')}`);
  }

  // 3. Confirmateur 1 account (Multi-brand assigned to all brands)
  const [cIns] = await pool.query(
    'INSERT INTO confirmers (brand_id, name, phone, login_email) VALUES (?,?,?,?)',
    [allBrandIds[0], 'Sarah Multi-Brand', '0611223344', CONFIRMER_EMAIL]
  );
  const confirmerId = cIns.insertId;

  // Associate with all active brands
  for (const bId of allBrandIds) {
    await pool.query('INSERT INTO confirmer_brands (confirmer_id, brand_id) VALUES (?,?)', [confirmerId, bId]);
  }

  await pool.query(
    'INSERT INTO users (email, password_hash, role, confirmer_id, brand_id) VALUES (?,?,?,?,?)',
    [CONFIRMER_EMAIL, bcrypt.hashSync(CONFIRMER_PASS, 10), 'confirmer', confirmerId, allBrandIds[0]]
  );

  console.log(`\nConfirmateur 1: ${CONFIRMER_EMAIL} / ${CONFIRMER_PASS}`);
  console.log(`Admin login:    ${ADMIN_EMAIL} / ${ADMIN_PASS}`);
  console.log('Seed completed successfully.\n');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });


