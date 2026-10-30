const express = require('express');
const pool = require('../db');
const { authRequired, scopeBrand } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Dashboard KPIs + tables, mirroring the Google Sheet.
// Brand users are auto-scoped to their brand; admin can pass ?brand_id=.
router.get('/', async (req, res) => {
  const { from, to } = req.query;

  // ---- order-level scoping (KPIs, monthly, status breakdowns) ----
  const oConds = [], oParams = [];
  scopeBrand('o', req, oConds, oParams);
  if (req.user.role === 'confirmer') {
    oConds.push('o.confirmer_id = ?');
    oParams.push(req.user.confirmer_id);
  }
  if (from) { oConds.push('DATE(o.created_at) >= ?'); oParams.push(from); }
  if (to) { oConds.push('DATE(o.created_at) <= ?'); oParams.push(to); }
  const oWhere = oConds.length ? 'WHERE ' + oConds.join(' AND ') : '';

  // ---- expense scoping ----
  const eConds = [], eParams = [];
  scopeBrand('e', req, eConds, eParams);
  if (from) { eConds.push('e.date >= ?'); eParams.push(from); }
  if (to) { eConds.push('e.date <= ?'); eParams.push(to); }
  const eWhere = eConds.length ? 'WHERE ' + eConds.join(' AND ') : '';

  // ---- date filter for JOINs (keeps zero-order rows) ----
  const joinDate = [];
  if (from) joinDate.push(`DATE(o.created_at) >= '${from.replace(/'/g, '')}'`);
  if (to) joinDate.push(`DATE(o.created_at) <= '${to.replace(/'/g, '')}'`);
  const joinExtra = joinDate.length ? ' AND ' + joinDate.join(' AND ') : '';

  // ---- brand scoping for confirmers / products tables ----
  const cConds = [], cParams = [];
  scopeBrand('c', req, cConds, cParams);
  if (req.user.role === 'confirmer') {
    cConds.push('c.id = ?');
    cParams.push(req.user.confirmer_id);
  }
  const cWhere = cConds.length ? 'WHERE ' + cConds.join(' AND ') : '';

  const pConds = [], pParams = [];
  scopeBrand('p', req, pConds, pParams);
  const pWhere = pConds.length ? 'WHERE ' + pConds.join(' AND ') : '';

  // ---- KPIs ----
  const [[k]] = await pool.query(`
    SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN DATE(o.created_at) = CURDATE() THEN 1 ELSE 0 END) AS orders_today,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN (o.price * o.quantity) + COALESCE(o.delivery_fee, 0) ELSE 0 END) AS revenus,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN o.cost * o.quantity ELSE 0 END) AS total_cost,
      SUM(CASE WHEN o.shipping_status = 'Livré' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN o.shipping_status IN ('Retourné','Refusé') THEN 1 ELSE 0 END) AS returned,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN o.call_status NOT IN ('Annulé','Fake order','Double') THEN 1 ELSE 0 END) AS callable
    FROM orders o ${oWhere}`, oParams);

  const [[ads]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS ads_spend FROM expenses e ${eWhere ? eWhere + ' AND' : 'WHERE'} e.type = 'ads'`,
    eParams);
  const [[chargesRow]] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS charges FROM expenses e ${eWhere ? eWhere + ' AND' : 'WHERE'} e.type = 'charge'`,
    eParams);

  const totalOrders = Number(k.total_orders) || 0;
  const revenus = Number(k.revenus) || 0;
  const totalCost = Number(k.total_cost) || 0;
  const adsSpend = Number(ads.ads_spend) || 0;
  const charges = Number(chargesRow.charges) || 0;
  const profit = revenus - totalCost - adsSpend - charges;

  // ---- per confirmer ----
  const [confirmers] = await pool.query(`
    SELECT c.id, c.name,
      COUNT(o.id) AS total_orders,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN o.shipping_status = 'Livré' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN o.shipping_status IN ('Retourné','Refusé') THEN 1 ELSE 0 END) AS returned,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN o.cost * o.quantity ELSE 0 END) AS total_cost,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN (o.price * o.quantity) + COALESCE(o.delivery_fee, 0) ELSE 0 END) AS revenus
    FROM confirmers c
    LEFT JOIN orders o ON o.confirmer_id = c.id ${joinExtra}
    ${cWhere}
    GROUP BY c.id, c.name
    ORDER BY total_orders DESC`, cParams);

  // ---- per product (each product = one landing page) ----
  let confirmerJoinExtra = '';
  if (req.user.role === 'confirmer') {
    confirmerJoinExtra = ` AND o.confirmer_id = ${Number(req.user.confirmer_id)}`;
  }

  const [products] = await pool.query(`
    SELECT p.id, p.name, p.price,
      COUNT(o.id) AS total_orders,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN o.shipping_status = 'Livré' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN (o.price * o.quantity) + COALESCE(o.delivery_fee, 0) ELSE 0 END) AS revenus
    FROM products p
    LEFT JOIN orders o ON o.product_id = p.id ${joinExtra}${confirmerJoinExtra}
    ${pWhere}
    GROUP BY p.id, p.name, p.price
    ORDER BY total_orders DESC`, pParams);

  // ---- monthly ----
  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS month,
      COUNT(*) AS total_orders,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN o.shipping_status = 'Livré' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN o.call_status = 'Confirmé' THEN (o.price * o.quantity) + COALESCE(o.delivery_fee, 0) ELSE 0 END) AS revenus
    FROM orders o ${oWhere}
    GROUP BY month ORDER BY month DESC LIMIT 12`, oParams);

  // ---- call statuses ----
  const [callStatuses] = await pool.query(
    `SELECT o.call_status AS status, COUNT(*) AS count FROM orders o ${oWhere} GROUP BY o.call_status ORDER BY count DESC`,
    oParams);

  // ---- shipping statuses ----
  const [shipStatuses] = await pool.query(
    `SELECT o.shipping_status AS status, COUNT(*) AS count FROM orders o ${oWhere} GROUP BY o.shipping_status ORDER BY count DESC`,
    oParams);

  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const isConfirmer = req.user.role === 'confirmer';

  res.json({
    kpis: {
      orders_today: Number(k.orders_today) || 0,
      total_orders: totalOrders,
      confirmed: Number(k.confirmed) || 0,
      delivered: Number(k.delivered) || 0,
      returned: Number(k.returned) || 0,
      pending_to_call: Math.max(0, totalOrders - (Number(k.confirmed) || 0) - (Number(k.returned) || 0)),
      confirmation_rate: pct(Number(k.confirmed), Number(k.callable)),
      delivery_rate: pct(Number(k.delivered), Number(k.confirmed)),
      return_rate: pct(Number(k.returned), totalOrders),
      // Financials (omitted for confirmers)
      revenus: isConfirmer ? 0 : revenus,
      profit: isConfirmer ? 0 : profit,
      ads_spend: isConfirmer ? 0 : adsSpend,
      charges: isConfirmer ? 0 : charges,
      total_expedition: isConfirmer ? 0 : totalCost,
    },
    confirmers: confirmers.map((c) => ({
      ...c,
      total_orders: Number(c.total_orders),
      confirmed: Number(c.confirmed),
      delivered: Number(c.delivered),
      returned: Number(c.returned),
      total_cost: isConfirmer ? 0 : (Number(c.total_cost) || 0),
      revenus: isConfirmer ? 0 : (Number(c.revenus) || 0),
      confirmation_rate: pct(Number(c.confirmed), Number(c.total_orders)),
      delivery_rate: pct(Number(c.delivered), Number(c.confirmed)),
      return_rate: pct(Number(c.returned), Number(c.total_orders)),
    })),
    products: products.map((p) => ({
      ...p,
      total_orders: Number(p.total_orders),
      confirmed: Number(p.confirmed),
      delivered: Number(p.delivered),
      revenus: isConfirmer ? 0 : (Number(p.revenus) || 0),
    })),
    monthly: monthly.map((m) => ({
      ...m,
      total_orders: Number(m.total_orders),
      confirmed: Number(m.confirmed),
      delivered: Number(m.delivered),
      revenus: isConfirmer ? 0 : (Number(m.revenus) || 0),
    })),
    call_statuses: callStatuses.map((s) => ({ status: s.status, count: Number(s.count) })),
    shipping_statuses: shipStatuses.map((s) => ({ status: s.status, count: Number(s.count) })),
  });
});

module.exports = router;
