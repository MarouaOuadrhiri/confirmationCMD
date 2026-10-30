const express = require('express');
const pool = require('../db');
const { authRequired, requireAdmin, verifyAdminPassword } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /api/shipping-companies — accessible by all authenticated users
router.get('/', async (req, res) => {
  const [companies] = await pool.query(
    'SELECT * FROM shipping_companies WHERE is_active = TRUE ORDER BY name'
  );
  res.json({ companies });
});

// Admin-only mutating routes
router.post('/', requireAdmin, async (req, res) => {
  const { name, phone, tracking_url_template } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom de la société de livraison est requis' });
  }

  try {
    const [r] = await pool.query(
      'INSERT INTO shipping_companies (name, phone, tracking_url_template) VALUES (?,?,?)',
      [name.trim(), phone ? phone.trim() : null, tracking_url_template ? tracking_url_template.trim() : null]
    );
    const [[company]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [r.insertId]);
    res.status(201).json({ company });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cette société de livraison existe déjà.' });
    }
    throw e;
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { name, phone, tracking_url_template, is_active } = req.body;
  const [[existing]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Société de livraison introuvable' });

  const sets = [], params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name.trim()); }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(phone ? phone.trim() : null); }
  if (tracking_url_template !== undefined) { sets.push('tracking_url_template = ?'); params.push(tracking_url_template ? tracking_url_template.trim() : null); }
  if (is_active !== undefined) { sets.push('is_active = ?'); params.push(Boolean(is_active)); }

  if (sets.length) {
    params.push(req.params.id);
    await pool.query(`UPDATE shipping_companies SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  const [[company]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [req.params.id]);
  res.json({ company });
});

router.delete('/:id', verifyAdminPassword, async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM shipping_companies WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Société de livraison introuvable' });

  await pool.query('DELETE FROM shipping_companies WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Société de livraison supprimée avec succès' });
});

module.exports = router;
