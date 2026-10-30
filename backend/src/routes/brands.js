const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db');
const { authRequired, requireAdmin, verifyAdminPassword } = require('../middleware/auth');

// Admin only: manage brands (one per brand, e.g. okinso / vinillia).
// Each brand owns: its login, its API key, its products (= landing pages).
const router = express.Router();
router.use(authRequired);

const slugify = (s) =>
  String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brand';

router.get('/', async (req, res) => {
  if (req.user.role === 'confirmer') {
    const allowed = req.confirmerBrands || [];
    if (!allowed.length) {
      return res.json({ brands: [] });
    }
    const [brands] = await pool.query(
      `SELECT b.*, (SELECT COUNT(*) FROM orders o WHERE o.brand_id = b.id AND o.confirmer_id = ?) AS orders_count,
              (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS products_count
       FROM brands b
       WHERE b.id IN (${allowed.map(() => '?').join(',')})
       ORDER BY b.name`,
      [req.user.confirmer_id, ...allowed]
    );
    return res.json({ brands });
  } else if (req.user.role === 'brand') {
    const [brands] = await pool.query(
      `SELECT b.*, (SELECT COUNT(*) FROM orders o WHERE o.brand_id = b.id) AS orders_count,
              (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS products_count
       FROM brands b
       WHERE b.id = ?
       ORDER BY b.name`,
      [req.user.brand.id]
    );
    return res.json({ brands });
  } else if (req.user.role === 'admin') {
    const [brands] = await pool.query(
      `SELECT b.*, (SELECT COUNT(*) FROM orders o WHERE o.brand_id = b.id) AS orders_count,
              (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS products_count
       FROM brands b ORDER BY b.name`
    );
    return res.json({ brands });
  } else {
    return res.status(403).json({ error: 'Forbidden' });
  }
});

// All mutating routes require Admin
router.use(requireAdmin);

router.post('/', async (req, res) => {
  const { name, slug, login_email, login_password } = req.body;
  if (!name || !login_email || !login_password) {
    return res.status(400).json({ error: 'name, login_email and login_password are required' });
  }
  if (String(login_password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const finalSlug = slugify(slug || name);
  const apiKey = crypto.randomBytes(32).toString('hex');
  try {
    const [r] = await pool.query(
      'INSERT INTO brands (name, slug, login_email, api_key) VALUES (?,?,?,?)',
      [name, finalSlug, login_email, apiKey]
    );
    await pool.query('INSERT INTO users (email, password_hash, role, brand_id) VALUES (?,?,?,?)',
      [login_email, bcrypt.hashSync(login_password, 10), 'brand', r.insertId]);
    const [[brand]] = await pool.query('SELECT * FROM brands WHERE id = ?', [r.insertId]);
    res.status(201).json({ brand });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Name, slug or login email already used' });
    throw e;
  }
});

router.put('/:id', async (req, res) => {
  const { name, login_email } = req.body;
  try {
    await pool.query('UPDATE brands SET name = COALESCE(?, name), login_email = COALESCE(?, login_email) WHERE id = ?',
      [name || null, login_email || null, req.params.id]);
    if (login_email) {
      await pool.query('UPDATE users SET email = ? WHERE brand_id = ? AND role = ?', [login_email, req.params.id, 'brand']);
    }
    const [[brand]] = await pool.query('SELECT * FROM brands WHERE id = ?', [req.params.id]);
    res.json({ brand });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Login email already used' });
    throw e;
  }
});

router.delete('/:id', verifyAdminPassword, async (req, res) => {
  await pool.query('DELETE FROM brands WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Brand deleted successfully' });
});

router.post('/:id/regenerate-key', async (req, res) => {
  const apiKey = crypto.randomBytes(32).toString('hex');
  await pool.query('UPDATE brands SET api_key = ? WHERE id = ?', [apiKey, req.params.id]);
  res.json({ api_key: apiKey });
});

router.post('/:id/reset-password', async (req, res) => {
  const { password } = req.body;
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  await pool.query('UPDATE users SET password_hash = ? WHERE brand_id = ? AND role = ?',
    [bcrypt.hashSync(password, 10), req.params.id, 'brand']);
  res.json({ ok: true });
});

module.exports = router;
