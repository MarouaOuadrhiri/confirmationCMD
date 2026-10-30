const express = require('express');
const pool = require('../db');
const { apiKeyAuth } = require('../middleware/apiKey');

const router = express.Router();
router.use(apiKeyAuth);

// POST /api/public/orders  — called by landing pages.
// The API key identifies the BRAND; product_id identifies which landing page.
router.post('/orders', async (req, res) => {
  const { product_id, product_name, quantity = 1, customer_name, phone, city, address, note, delivery_fee } = req.body;
  if (!customer_name || !phone) {
    return res.status(400).json({ error: 'customer_name and phone are required' });
  }
  const brand_id = req.brand.id;

  let pId = null, pName = product_name || null, price = 0, cost = 0, deliveryFee = 0;
  if (product_id) {
    const [[p]] = await pool.query(
      'SELECT * FROM products WHERE id = ? AND brand_id = ?',
      [product_id, brand_id]
    );
    if (!p) return res.status(400).json({ error: 'Unknown product_id for this brand' });
    pId = p.id; pName = p.name; price = Number(p.price); cost = Number(p.cost);
  }

  const incomingPrice = req.body.price ?? req.body.unit_price;
  if (incomingPrice !== undefined && incomingPrice !== null && !isNaN(Number(incomingPrice))) {
    const numIncoming = Number(incomingPrice);
    // If incoming price is total price including 35 DH delivery fee for Shampoo Cafeine (e.g., 234)
    if (numIncoming === 234 && (pId === 8 || (pName && /cafeine|caffeine/i.test(pName)))) {
      price = 199;
      deliveryFee = 35;
    } else {
      price = numIncoming;
    }
  }

  if (delivery_fee !== undefined && delivery_fee !== null && !isNaN(Number(delivery_fee))) {
    deliveryFee = Number(delivery_fee);
  }

  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  // Check blacklist / refusal history
  const [[manualBl]] = await pool.query(
    'SELECT * FROM blacklist WHERE (REPLACE(REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", ""), "/", "") LIKE ? OR phone LIKE ?) AND is_blocked = TRUE',
    [`%${cleanPhone}%`, `%${phone}%`]
  );
  const [[{ refCount }]] = await pool.query(
    `SELECT COUNT(*) AS refCount FROM orders 
     WHERE (REPLACE(REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", ""), "/", "") LIKE ? OR phone LIKE ?)
       AND (shipping_status IN ('Retourné', 'Refusé') OR call_status IN ('Fake order', 'Pas sérieux'))`,
    [`%${cleanPhone}%`, `%${phone}%`]
  );

  let finalNote = note ? String(note).trim() : null;
  if (manualBl || Number(refCount) >= 3) {
    const warning = `[🚫 ALERTE LISTE NOIRE: ${Number(refCount) >= 3 ? `${refCount} commandes refusées/retournées` : 'Numéro bloqué manuellement'}]`;
    finalNote = finalNote ? `${warning} · ${finalNote}` : warning;
  }

  const [r] = await pool.query(
    `INSERT INTO orders (brand_id, product_id, product_name, quantity, price, cost, delivery_fee,
       customer_name, phone, city, address, note, source)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'landing')`,
    [brand_id, pId, pName, Number(quantity) || 1, price, cost, deliveryFee,
     customer_name, phone, city || null, address || null, finalNote]
  );
  res.status(201).json({ ok: true, order_id: r.insertId });
});

// GET /api/public/products?api_key=... — lets a landing page fetch its brand's products.
router.get('/products', async (req, res) => {
  const [products] = await pool.query(
    'SELECT id, name, price FROM products WHERE brand_id = ? ORDER BY name',
    [req.brand.id]
  );
  res.json({ brand: req.brand.name, products });
});

module.exports = router;
