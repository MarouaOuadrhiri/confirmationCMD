const express = require('express');
const pool = require('../db');
const { authRequired, scopeBrand, verifyAdminPassword } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const conds = [], params = [];
  scopeBrand('p', req, conds, params);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const [products] = await pool.query(
    `SELECT p.*, b.name AS brand_name, b.api_key AS brand_api_key,
      COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.product_id = p.id AND o.shipping_status = 'Livré'), 0) AS units_delivered,
      COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.product_id = p.id AND o.call_status = 'Confirmé'), 0) AS units_confirmed,
      COALESCE((SELECT SUM(o.quantity) FROM orders o WHERE o.product_id = p.id), 0) AS total_units_ordered
     FROM products p
     JOIN brands b ON b.id = p.brand_id ${where} ORDER BY b.name, p.name`,
    params
  );
  res.json({ products });
});

router.post('/', async (req, res) => {
  const { name, price = 0, cost = 0, delivery_fee = 0, stock = 100, min_stock_alert = 15, brand_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const bid = req.brandId || Number(brand_id);
  if (!bid) return res.status(400).json({ error: 'brand_id is required' });
  const [r] = await pool.query(
    'INSERT INTO products (brand_id, name, price, cost, delivery_fee, stock, min_stock_alert) VALUES (?,?,?,?,?,?,?)',
    [bid, name, Number(price) || 0, Number(cost) || 0, Number(delivery_fee) || 0, Number(stock) || 0, Number(min_stock_alert) || 15]
  );
  const [[product]] = await pool.query('SELECT * FROM products WHERE id = ?', [r.insertId]);
  res.status(201).json({ product });
});

router.put('/:id', async (req, res) => {
  const { name, price, cost, delivery_fee, stock, min_stock_alert, brand_id } = req.body;
  const [[existing]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (req.brandId && existing.brand_id !== req.brandId) return res.status(403).json({ error: 'Forbidden' });
  const targetBrandId = req.brandId ? existing.brand_id : (brand_id ? Number(brand_id) : existing.brand_id);
  await pool.query(
    'UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), cost = COALESCE(?, cost), delivery_fee = COALESCE(?, delivery_fee), stock = COALESCE(?, stock), min_stock_alert = COALESCE(?, min_stock_alert), brand_id = ? WHERE id = ?',
    [name || null, price !== undefined ? Number(price) : null, cost !== undefined ? Number(cost) : null, delivery_fee !== undefined ? Number(delivery_fee) : null, stock !== undefined ? Number(stock) : null, min_stock_alert !== undefined ? Number(min_stock_alert) : null, targetBrandId, req.params.id]
  );
  const [[product]] = await pool.query(
    'SELECT p.*, b.name AS brand_name FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.id = ?',
    [req.params.id]
  );
  res.json({ product });
});

// Quick Stock Adjust: { delta: +10 or -5 } or { stock: 120 }
router.post('/:id/adjust-stock', async (req, res) => {
  const { delta, stock } = req.body;
  const [[existing]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (req.brandId && existing.brand_id !== req.brandId) return res.status(403).json({ error: 'Forbidden' });

  let newStock = existing.stock;
  if (stock !== undefined && stock !== null) {
    newStock = Math.max(0, Number(stock));
  } else if (delta !== undefined && delta !== null) {
    newStock = Math.max(0, existing.stock + Number(delta));
  }

  await pool.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, req.params.id]);
  res.json({ ok: true, id: req.params.id, stock: newStock });
});

// DELETE PRODUCT: Restricted to Admin only + Verified with Admin password
router.delete('/:id', verifyAdminPassword, async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Product deleted successfully' });
});

module.exports = router;
