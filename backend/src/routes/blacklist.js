const express = require('express');
const pool = require('../db');
const { authRequired, requireAdmin, verifyAdminPassword } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Helper to normalize phone number for matching
function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/[^0-9]/g, '');
}

// GET /api/blacklist/check?phone=...
router.get('/check', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.json({ is_blacklisted: false, refusal_count: 0, delivered_count: 0, orders: [] });

  const clean = normalizePhone(phone);
  if (clean.length < 7) {
    return res.json({ is_blacklisted: false, refusal_count: 0, delivered_count: 0, orders: [] });
  }

  // 1. Check manual blacklist table
  const [[manual]] = await pool.query(
    'SELECT * FROM blacklist WHERE (REPLACE(REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", ""), "/", "") LIKE ? OR phone LIKE ?) AND is_blocked = TRUE',
    [`%${clean}%`, `%${phone}%`]
  );

  // 2. Check orders history for returns and refusals
  const [orders] = await pool.query(
    `SELECT o.id, o.customer_name, o.phone, o.city, o.address, o.product_name, o.quantity, o.price, o.delivery_fee,
            o.call_status, o.shipping_status, o.source, o.shipping_company, o.tracking_number, o.created_at,
            b.name AS brand_name
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     WHERE (REPLACE(REPLACE(REPLACE(REPLACE(o.phone, " ", ""), "-", ""), "+", ""), "/", "") LIKE ? OR o.phone LIKE ?)
     ORDER BY o.created_at DESC LIMIT 20`,
    [`%${clean}%`, `%${phone}%`]
  );

  const refusalCount = orders.filter(
    (o) => ['Retourné', 'Refusé'].includes(o.shipping_status) || ['Fake order', 'Pas sérieux'].includes(o.call_status)
  ).length;

  const deliveredCount = orders.filter((o) => o.shipping_status === 'Livré').length;
  const isBlacklisted = Boolean(manual) || refusalCount >= 3;

  res.json({
    is_blacklisted: isBlacklisted,
    is_manual: Boolean(manual),
    refusal_count: refusalCount,
    delivered_count: deliveredCount,
    total_orders: orders.length,
    manual_entry: manual || null,
    orders,
  });
});

// GET /api/blacklist — List all blacklisted customers (manual + auto-detected >= 3 refusals)
router.get('/', async (req, res) => {
  // 1. Manual blacklist entries
  const [manualList] = await pool.query('SELECT * FROM blacklist WHERE is_blocked = TRUE ORDER BY created_at DESC');

  // 2. Auto-detected customers with >= 3 returned / refused orders
  const [autoDetected] = await pool.query(`
    SELECT 
      o.phone,
      MAX(o.customer_name) AS customer_name,
      MAX(o.city) AS city,
      COUNT(*) AS total_orders,
      SUM(CASE WHEN o.shipping_status IN ('Retourné', 'Refusé') OR o.call_status IN ('Fake order', 'Pas sérieux') THEN 1 ELSE 0 END) AS refusal_count,
      SUM(CASE WHEN o.shipping_status = 'Livré' THEN 1 ELSE 0 END) AS delivered_count,
      MAX(o.created_at) AS last_order_date
    FROM orders o
    GROUP BY o.phone
    HAVING refusal_count >= 3
    ORDER BY refusal_count DESC, last_order_date DESC
  `);

  res.json({
    manual_blacklist: manualList,
    auto_blacklisted: autoDetected,
  });
});

// POST /api/blacklist — Add/Block phone number manually (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { phone, customer_name, reason } = req.body;
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Le numéro de téléphone est requis' });
  }

  const cleanPhone = phone.trim();
  try {
    await pool.query(
      `INSERT INTO blacklist (phone, customer_name, reason, is_blocked, created_by)
       VALUES (?, ?, ?, TRUE, ?)
       ON DUPLICATE KEY UPDATE customer_name = VALUES(customer_name), reason = VALUES(reason), is_blocked = TRUE`,
      [cleanPhone, customer_name ? customer_name.trim() : null, reason ? reason.trim() : 'Ajouté manuellement par administrateur', req.user.email || 'admin']
    );

    const [[entry]] = await pool.query('SELECT * FROM blacklist WHERE phone = ?', [cleanPhone]);
    res.status(201).json({ ok: true, entry });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/blacklist/:id — Unblock / remove from blacklist (Admin + Password)
router.delete('/:id', verifyAdminPassword, async (req, res) => {
  const idOrPhone = req.params.id;
  const isNumeric = /^\d+$/.test(idOrPhone);

  if (isNumeric) {
    await pool.query('DELETE FROM blacklist WHERE id = ?', [idOrPhone]);
  } else {
    await pool.query('DELETE FROM blacklist WHERE phone = ?', [idOrPhone]);
  }

  res.json({ ok: true, message: 'Client débloqué de la liste noire avec succès' });
});

module.exports = router;
