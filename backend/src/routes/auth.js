const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

function publicUser(u, confirmerBrands = []) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    confirmer_id: u.confirmer_id || null,
    confirmer_name: u.confirmer_name || null,
    brand: u.role === 'brand' && u.brand_id ? { id: u.brand_id, name: u.brand_name, slug: u.brand_slug } : null,
    brands: u.role === 'confirmer' ? confirmerBrands : (u.role === 'brand' && u.brand_id ? [{ id: u.brand_id, name: u.brand_name, slug: u.brand_slug }] : []),
  };
}

router.post('/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const [[u]] = await pool.query(
    `SELECT u.*, b.name AS brand_name, b.slug AS brand_slug, c.name AS confirmer_name
     FROM users u 
     LEFT JOIN brands b ON b.id = u.brand_id
     LEFT JOIN confirmers c ON c.id = u.confirmer_id
     WHERE u.email = ?`,
    [email]
  );
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (role && role !== u.role) return res.status(403).json({ error: 'Ce compte ne correspond pas à cet espace. Choisissez le bon accès.' });

  let confirmerBrands = [];
  if (u.role === 'confirmer' && u.confirmer_id) {
    const [cbRows] = await pool.query(
      `SELECT b.id, b.name, b.slug FROM brands b
       JOIN confirmer_brands cb ON cb.brand_id = b.id
       WHERE cb.confirmer_id = ? ORDER BY b.name`,
      [u.confirmer_id]
    );
    confirmerBrands = cbRows;
    if (!confirmerBrands.length && u.brand_id && u.brand_name) {
      confirmerBrands = [{ id: u.brand_id, name: u.brand_name, slug: u.brand_slug }];
    }
  }

  res.json({ token: signToken(u), user: publicUser(u, confirmerBrands) });
});

router.get('/me', authRequired, async (req, res) => {
  res.json({ user: req.user });
});

router.post('/verify-password', authRequired, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe requis' });
  const [[u]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const match = await bcrypt.compare(password, u.password_hash);
  if (!match) return res.status(401).json({ error: 'Mot de passe incorrect' });
  res.json({ ok: true, valid: true });
});

module.exports = router;

