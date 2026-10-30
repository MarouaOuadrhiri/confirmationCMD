const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authRequired, scopeBrand, verifyAdminPassword, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  let brandFilterSql = '';
  const params = [];
  if (req.user.role === 'brand') {
    brandFilterSql = 'WHERE (cb.brand_id = ? OR c.brand_id = ?)';
    params.push(req.user.brand.id, req.user.brand.id);
  } else if (req.user.role === 'confirmer') {
    const allowed = req.confirmerBrands || [];
    if (!allowed.length) {
      return res.json({ confirmers: [] });
    }
    if (req.query.brand_id && /^\d+$/.test(String(req.query.brand_id))) {
      const bid = Number(req.query.brand_id);
      brandFilterSql = 'WHERE (cb.brand_id = ? OR c.brand_id = ?)';
      params.push(bid, bid);
    } else {
      brandFilterSql = `WHERE (cb.brand_id IN (${allowed.map(() => '?').join(',')}) OR c.brand_id IN (${allowed.map(() => '?').join(',')}))`;
      params.push(...allowed, ...allowed);
    }
  } else if (req.query.brand_id && /^\d+$/.test(String(req.query.brand_id))) {
    const bid = Number(req.query.brand_id);
    brandFilterSql = 'WHERE (cb.brand_id = ? OR c.brand_id = ?)';
    params.push(bid, bid);
  }

  const [confirmersRaw] = await pool.query(
    `SELECT c.*, u.id AS user_id, u.email AS user_email,
       b_single.name AS single_brand_name,
       GROUP_CONCAT(DISTINCT b.id ORDER BY b.name) AS brand_ids_csv,
       GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR ', ') AS brand_names
     FROM confirmers c
     LEFT JOIN confirmer_brands cb ON cb.confirmer_id = c.id
     LEFT JOIN brands b ON b.id = cb.brand_id
     LEFT JOIN brands b_single ON b_single.id = c.brand_id
     LEFT JOIN users u ON u.confirmer_id = c.id
     ${brandFilterSql}
     GROUP BY c.id, u.id, u.email, b_single.name
     ORDER BY c.name`,
    params
  );

  const confirmers = confirmersRaw.map((c) => {
    let brandIds = [];
    if (c.brand_ids_csv) {
      brandIds = c.brand_ids_csv.split(',').map(Number);
    } else if (c.brand_id) {
      brandIds = [Number(c.brand_id)];
    }
    const brandNamesList = c.brand_names || c.single_brand_name || '';
    return {
      ...c,
      brand_ids: brandIds,
      brand_name: brandNamesList,
    };
  });

  res.json({ confirmers });
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, phone, brand_id, brand_ids, email, password } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  let targetBrandIds = [];
  if (Array.isArray(brand_ids) && brand_ids.length > 0) {
    targetBrandIds = brand_ids.map(Number).filter(Boolean);
  } else if (brand_id) {
    targetBrandIds = [Number(brand_id)];
  }
  if (!targetBrandIds.length) {
    return res.status(400).json({ error: 'Au moins une marque doit être assignée à ce confirmateur.' });
  }

  // If creating login account, check email
  let userEmail = email ? email.trim().toLowerCase() : null;
  if (userEmail) {
    const [[existingEmail]] = await pool.query('SELECT id FROM users WHERE email = ?', [userEmail]);
    if (existingEmail) return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte.' });
  }

  const primaryBrandId = targetBrandIds[0] || null;
  const [r] = await pool.query(
    'INSERT INTO confirmers (brand_id, name, phone, login_email) VALUES (?,?,?,?)',
    [primaryBrandId, name.trim(), phone ? phone.trim() : null, userEmail]
  );
  const confirmerId = r.insertId;

  for (const bId of targetBrandIds) {
    await pool.query('INSERT IGNORE INTO confirmer_brands (confirmer_id, brand_id) VALUES (?,?)', [confirmerId, bId]);
  }

  if (userEmail && password) {
    const passwordHash = await bcrypt.hash(password.trim(), 10);
    await pool.query(
      'INSERT INTO users (email, password_hash, role, brand_id, confirmer_id) VALUES (?,?,?,?,?)',
      [userEmail, passwordHash, 'confirmer', primaryBrandId, confirmerId]
    );
  }

  const [[confirmer]] = await pool.query(
    `SELECT c.*, u.id AS user_id, u.email AS user_email,
       GROUP_CONCAT(DISTINCT b.id ORDER BY b.name) AS brand_ids_csv,
       GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR ', ') AS brand_names
     FROM confirmers c
     LEFT JOIN confirmer_brands cb ON cb.confirmer_id = c.id
     LEFT JOIN brands b ON b.id = cb.brand_id
     LEFT JOIN users u ON u.confirmer_id = c.id
     WHERE c.id = ?
     GROUP BY c.id, u.id, u.email`,
    [confirmerId]
  );
  res.status(201).json({ 
    confirmer: {
      ...confirmer,
      brand_ids: targetBrandIds,
      brand_name: confirmer?.brand_names || '',
    }
  });
});

// Admin creates or updates login credentials for a confirmer
router.post('/:id/account', requireAdmin, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const [[confirmer]] = await pool.query('SELECT * FROM confirmers WHERE id = ?', [req.params.id]);
  if (!confirmer) return res.status(404).json({ error: 'Confirmateur introuvable' });

  const userEmail = email.trim().toLowerCase();
  const [[existing]] = await pool.query('SELECT id, confirmer_id FROM users WHERE email = ?', [userEmail]);
  if (existing && existing.confirmer_id !== Number(req.params.id)) {
    return res.status(400).json({ error: 'Cet email est déjà attribué à un autre compte.' });
  }

  const passwordHash = await bcrypt.hash(password.trim(), 10);
  const [[userRecord]] = await pool.query('SELECT id FROM users WHERE confirmer_id = ?', [req.params.id]);

  if (userRecord) {
    await pool.query('UPDATE users SET email = ?, password_hash = ? WHERE id = ?',
      [userEmail, passwordHash, userRecord.id]);
  } else {
    await pool.query(
      'INSERT INTO users (email, password_hash, role, brand_id, confirmer_id) VALUES (?,?,?,?,?)',
      [userEmail, passwordHash, 'confirmer', confirmer.brand_id || null, confirmer.id]
    );
  }

  await pool.query('UPDATE confirmers SET login_email = ? WHERE id = ?', [userEmail, confirmer.id]);
  res.json({ ok: true, message: 'Compte confirmateur configuré avec succès.' });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM confirmers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, phone, brand_ids, brand_id } = req.body;
  const sets = [], params = [];
  if (name !== undefined) { sets.push('name = ?'); params.push(name.trim()); }
  if (phone !== undefined) { sets.push('phone = ?'); params.push(phone ? phone.trim() : null); }

  let targetBrandIds = null;
  if (Array.isArray(brand_ids)) {
    targetBrandIds = brand_ids.map(Number).filter(Boolean);
  } else if (brand_id !== undefined && brand_id !== null) {
    targetBrandIds = [Number(brand_id)].filter(Boolean);
  }

  if (targetBrandIds && targetBrandIds.length > 0) {
    sets.push('brand_id = ?');
    params.push(targetBrandIds[0]);
    await pool.query('DELETE FROM confirmer_brands WHERE confirmer_id = ?', [req.params.id]);
    for (const bId of targetBrandIds) {
      await pool.query('INSERT IGNORE INTO confirmer_brands (confirmer_id, brand_id) VALUES (?,?)', [req.params.id, bId]);
    }
    await pool.query('UPDATE users SET brand_id = ? WHERE confirmer_id = ?', [targetBrandIds[0], req.params.id]);
  }

  if (sets.length) {
    params.push(req.params.id);
    await pool.query(`UPDATE confirmers SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  const [[confirmer]] = await pool.query(
    `SELECT c.*, u.id AS user_id, u.email AS user_email,
       GROUP_CONCAT(DISTINCT b.id ORDER BY b.name) AS brand_ids_csv,
       GROUP_CONCAT(DISTINCT b.name ORDER BY b.name SEPARATOR ', ') AS brand_names
     FROM confirmers c
     LEFT JOIN confirmer_brands cb ON cb.confirmer_id = c.id
     LEFT JOIN brands b ON b.id = cb.brand_id
     LEFT JOIN users u ON u.confirmer_id = c.id
     WHERE c.id = ?
     GROUP BY c.id, u.id, u.email`,
    [req.params.id]
  );
  res.json({ 
    confirmer: {
      ...confirmer,
      brand_ids: targetBrandIds || (confirmer?.brand_ids_csv ? confirmer.brand_ids_csv.split(',').map(Number) : []),
      brand_name: confirmer?.brand_names || '',
    }
  });
});

router.delete('/:id', verifyAdminPassword, async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM confirmers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM users WHERE confirmer_id = ?', [req.params.id]);
  await pool.query('DELETE FROM confirmers WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Confirmer deleted successfully' });
});

module.exports = router;
