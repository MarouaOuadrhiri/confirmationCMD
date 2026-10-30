const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );
}

// Verifies the JWT and attaches the user.
// Brand users get req.brandId set -> every query is scoped to their brand.
// Confirmer users get req.confirmerBrands set -> queries scoped to all their assigned brands.
async function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const [[u]] = await pool.query(
      `SELECT u.id, u.email, u.role, u.brand_id, u.confirmer_id, b.name AS brand_name, b.slug AS brand_slug, c.name AS confirmer_name
       FROM users u 
       LEFT JOIN brands b ON b.id = u.brand_id
       LEFT JOIN confirmers c ON c.id = u.confirmer_id
       WHERE u.id = ?`,
      [payload.id]
    );
    if (!u) return res.status(401).json({ error: 'Invalid token' });

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

    req.user = {
      id: u.id,
      email: u.email,
      role: u.role,
      confirmer_id: u.confirmer_id,
      confirmer_name: u.confirmer_name,
      brand: u.role === 'brand' && u.brand_id ? { id: u.brand_id, name: u.brand_name, slug: u.brand_slug } : null,
      brands: u.role === 'confirmer' ? confirmerBrands : (u.role === 'brand' && u.brand_id ? [{ id: u.brand_id, name: u.brand_name, slug: u.brand_slug }] : []),
    };

    req.brandId = u.role === 'brand' ? u.brand_id : null;
    req.confirmerId = u.role === 'confirmer' ? u.confirmer_id : null;
    req.confirmerBrands = confirmerBrands.map((b) => b.id);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Action non autorisée. Seul l\'administrateur peut effectuer cette opération.' });
  next();
}

// Verifies admin role AND validates admin password
async function verifyAdminPassword(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Action refusée. Seul le compte Administrateur est autorisé.' });
  }
  const password = req.headers['x-admin-password'] || (req.body && req.body.admin_password) || (req.query && req.query.admin_password);
  if (!password) {
    return res.status(400).json({ error: 'Mot de passe administrateur requis pour confirmer cette action.' });
  }
  const [[u]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!u) return res.status(401).json({ error: 'Compte administrateur introuvable.' });
  
  const match = await bcrypt.compare(password, u.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect. Opération refusée.' });
  }
  next();
}

// Adds "brand_id = ?" or "brand_id IN (...)" to a WHERE clause.
// - brand users: always their own brand (query param is ignored)
// - confirmer users: restricted to their assigned brands (can filter by ?brand_id= among assigned brands)
// - admin: optional ?brand_id= filter, otherwise all brands
function scopeBrand(alias, req, conds, params) {
  const col = alias ? `${alias}.brand_id` : 'brand_id';
  if (req.user && req.user.role === 'brand') {
    conds.push(`${col} = ?`);
    params.push(req.user.brand.id);
  } else if (req.user && req.user.role === 'confirmer') {
    const allowed = req.confirmerBrands || [];
    if (req.query.brand_id && /^\d+$/.test(String(req.query.brand_id))) {
      const bid = Number(req.query.brand_id);
      if (allowed.length > 0 && !allowed.includes(bid)) {
        conds.push('1 = 0');
      } else {
        conds.push(`${col} = ?`);
        params.push(bid);
      }
    } else if (allowed.length > 0) {
      conds.push(`${col} IN (${allowed.map(() => '?').join(',')})`);
      params.push(...allowed);
    }
  } else if (req.query.brand_id && /^\d+$/.test(String(req.query.brand_id))) {
    conds.push(`${col} = ?`);
    params.push(Number(req.query.brand_id));
  }
}

module.exports = { signToken, authRequired, requireAdmin, verifyAdminPassword, scopeBrand };
