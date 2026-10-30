const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authRequired, scopeBrand, verifyAdminPassword } = require('../middleware/auth');
const { addParcelToOzon, isOzonCompany } = require('../services/ozon');

const router = express.Router();
router.use(authRequired);

const CALL_STATUSES = ['Nouveau', 'Confirmé', 'Appel 1', 'Appel 2', 'Appel 3', 'WhatsApp / SMS',
  'Pas de réponse', 'Reporté', 'Injoignable', 'Boîte Vocal', 'Annulé', 'Pas sérieux',
  'Fake order', 'Double'];
const SHIP_STATUSES = ['En attente', 'Annulé', 'Livré', 'Refusé', 'Retourné',
  'Mise En Distribution', 'Injoignable', 'Reporté', 'Pas de réponse'];

router.get('/', async (req, res) => {
  const { q, call_status, shipping_status, product_id, source, confirmer_id, blacklist, from, to, page = 1, limit = 25 } = req.query;
  const conds = [], params = [];
  scopeBrand('o', req, conds, params);
  
  // If user is a confirmer, strictly scope to orders assigned to them
  if (req.user.role === 'confirmer') {
    conds.push('o.confirmer_id = ?');
    params.push(req.user.confirmer_id);
  } else if (confirmer_id) {
    conds.push('o.confirmer_id = ?');
    params.push(confirmer_id);
  }

  if (q) {
    conds.push('(o.customer_name LIKE ? OR o.phone LIKE ? OR o.product_name LIKE ? OR o.note LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (call_status) { conds.push('o.call_status = ?'); params.push(call_status); }
  if (shipping_status) { conds.push('o.shipping_status = ?'); params.push(shipping_status); }
  if (product_id) { conds.push('o.product_id = ?'); params.push(product_id); }
  if (source) { conds.push('o.source = ?'); params.push(source); }
  if (blacklist === '1') {
    conds.push(`((SELECT COUNT(*) FROM orders o_ref WHERE o_ref.phone = o.phone AND (o_ref.shipping_status IN ('Retourné', 'Refusé') OR o_ref.call_status IN ('Fake order', 'Pas sérieux'))) >= 3 OR EXISTS (SELECT 1 FROM blacklist bl WHERE (bl.phone = o.phone OR REPLACE(REPLACE(REPLACE(REPLACE(bl.phone, " ", ""), "-", ""), "+", ""), "/", "") = REPLACE(REPLACE(REPLACE(REPLACE(o.phone, " ", ""), "-", ""), "+", ""), "/", "")) AND bl.is_blocked = TRUE))`);
  }
  if (from) { conds.push('DATE(o.created_at) >= ?'); params.push(from); }
  if (to) { conds.push('DATE(o.created_at) <= ?'); params.push(to); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);
  const [rows] = await pool.query(
    `SELECT o.*, b.name AS brand_name, c.name AS confirmer_name,
            EXISTS(SELECT 1 FROM blacklist bl WHERE (bl.phone = o.phone OR REPLACE(REPLACE(REPLACE(REPLACE(bl.phone, " ", ""), "-", ""), "+", ""), "/", "") = REPLACE(REPLACE(REPLACE(REPLACE(o.phone, " ", ""), "-", ""), "+", ""), "/", "")) AND bl.is_blocked = TRUE) AS manual_blacklisted,
            (
              SELECT COUNT(*) FROM orders o_ref 
              WHERE o_ref.phone = o.phone 
                AND (o_ref.shipping_status IN ('Retourné', 'Refusé') OR o_ref.call_status IN ('Fake order', 'Pas sérieux'))
            ) AS refusal_count,
            (
              SELECT COUNT(*) FROM orders o_del 
              WHERE o_del.phone = o.phone 
                AND o_del.shipping_status = 'Livré'
            ) AS delivered_count
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     LEFT JOIN confirmers c ON c.id = o.confirmer_id
     ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), (Number(page) - 1) * Number(limit)]
  );

  const enriched = rows.map((r) => ({
    ...r,
    manual_blacklisted: Boolean(r.manual_blacklisted),
    refusal_count: Number(r.refusal_count || 0),
    delivered_count: Number(r.delivered_count || 0),
    is_blacklisted: Boolean(r.manual_blacklisted) || Number(r.refusal_count || 0) >= 3,
  }));

  res.json({ orders: enriched, total, page: Number(page), limit: Number(limit) });
});

router.get('/:id', async (req, res, next) => {
  if (['check-duplicate', 'meta'].includes(req.params.id)) return next();
  const [[order]] = await pool.query(
    `SELECT o.*, b.name AS brand_name, c.name AS confirmer_name,
            EXISTS(SELECT 1 FROM blacklist bl WHERE (bl.phone = o.phone OR REPLACE(REPLACE(REPLACE(REPLACE(bl.phone, " ", ""), "-", ""), "+", ""), "/", "") = REPLACE(REPLACE(REPLACE(REPLACE(o.phone, " ", ""), "-", ""), "+", ""), "/", "")) AND bl.is_blocked = TRUE) AS manual_blacklisted,
            (
              SELECT COUNT(*) FROM orders o_ref 
              WHERE o_ref.phone = o.phone 
                AND (o_ref.shipping_status IN ('Retourné', 'Refusé') OR o_ref.call_status IN ('Fake order', 'Pas sérieux'))
            ) AS refusal_count,
            (
              SELECT COUNT(*) FROM orders o_del 
              WHERE o_del.phone = o.phone 
                AND o_del.shipping_status = 'Livré'
            ) AS delivered_count
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     LEFT JOIN confirmers c ON c.id = o.confirmer_id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role === 'confirmer' && order.confirmer_id !== req.user.confirmer_id) {
    return res.status(403).json({ error: 'Action non autorisée' });
  }
  if (req.user.role === 'brand' && order.brand_id !== req.user.brand.id) {
    return res.status(403).json({ error: 'Action non autorisée' });
  }

  order.manual_blacklisted = Boolean(order.manual_blacklisted);
  order.refusal_count = Number(order.refusal_count || 0);
  order.delivered_count = Number(order.delivered_count || 0);
  order.is_blacklisted = Boolean(order.manual_blacklisted) || Number(order.refusal_count || 0) >= 3;

  res.json({ order });
});

router.post('/', async (req, res) => {
  const { product_id, product_name, quantity = 1, price, cost, delivery_fee, customer_name, phone,
    city, address, note, call_status = 'Nouveau', shipping_status = 'En attente',
    confirmer_id = null, brand_id, source = 'WhatsApp', shipping_company = null, tracking_number = null } = req.body;
    
  if (!customer_name || !phone) return res.status(400).json({ error: 'Nom du client et numéro de téléphone requis' });

  const bid = req.brandId || Number(brand_id);
  if (!bid) return res.status(400).json({ error: 'Marque (brand_id) requise' });
  if (!CALL_STATUSES.includes(call_status)) return res.status(400).json({ error: 'Statut d\'appel invalide' });
  if (!SHIP_STATUSES.includes(shipping_status)) return res.status(400).json({ error: 'Statut de livraison invalide' });

  let pId = product_id ? Number(product_id) : null, pName = product_name ? String(product_name).trim() : null;
  let pPrice = (price !== undefined && price !== null && price !== '' && !isNaN(Number(price))) ? Number(price) : null;
  let pCost = (cost !== undefined && cost !== null && cost !== '' && !isNaN(Number(cost))) ? Number(cost) : null;
  let pDeliveryFee = (delivery_fee !== undefined && delivery_fee !== null && delivery_fee !== '' && !isNaN(Number(delivery_fee))) ? Number(delivery_fee) : 0;

  if (pId) {
    const [[p]] = await pool.query('SELECT * FROM products WHERE id = ? AND brand_id = ?', [pId, bid]);
    if (!p) return res.status(400).json({ error: 'Produit introuvable dans cette marque' });
    pName = p.name;
    if (pPrice === null || pPrice <= 0) pPrice = Number(p.price) || 0;
    if (pCost === null || pCost <= 0) pCost = Number(p.cost) || 0;
  } else if (!pName || pPrice === null || pPrice <= 0) {
    // If no product ID was chosen or price was 0, fallback to brand's primary product if one exists
    const [brandProducts] = await pool.query('SELECT * FROM products WHERE brand_id = ? ORDER BY id ASC LIMIT 1', [bid]);
    if (brandProducts.length > 0) {
      const p = brandProducts[0];
      if (!pId) pId = p.id;
      if (!pName) pName = p.name;
      if (pPrice === null || pPrice <= 0) pPrice = Number(p.price) || 0;
      if (pCost === null || pCost <= 0) pCost = Number(p.cost) || 0;
    }
  }

  if (pPrice === null) pPrice = 0;
  if (pCost === null) pCost = 0;

  // When confirmer creates order, automatically assign to herself
  let finalConfirmerId = confirmer_id;
  if (req.user.role === 'confirmer') {
    finalConfirmerId = req.user.confirmer_id;
    if (req.confirmerBrands && req.confirmerBrands.length > 0 && !req.confirmerBrands.includes(bid)) {
      return res.status(403).json({ error: 'Action non autorisée. Vous n\'avez pas accès à cette marque.' });
    }
  }
  if (finalConfirmerId) {
    const [[c]] = await pool.query(
      `SELECT c.id FROM confirmers c
       LEFT JOIN confirmer_brands cb ON cb.confirmer_id = c.id
       WHERE c.id = ? AND (cb.brand_id = ? OR c.brand_id = ?)`,
      [finalConfirmerId, bid, bid]
    );
    if (!c) return res.status(400).json({ error: 'Confirmateur introuvable pour cette marque' });
  }

  const cleanSource = source ? String(source).trim() : 'WhatsApp';

  const [r] = await pool.query(
    `INSERT INTO orders (brand_id, product_id, product_name, quantity, price, cost, delivery_fee,
      customer_name, phone, city, address, note, call_status, shipping_status, confirmer_id, source, shipping_company, tracking_number)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [bid, pId, pName, Number(quantity) || 1, pPrice, pCost, pDeliveryFee, customer_name, phone,
     city || null, address || null, note || null, call_status, shipping_status, finalConfirmerId || null, cleanSource,
     shipping_company ? shipping_company.trim() : null, tracking_number ? tracking_number.trim() : null]
  );
  const [[order]] = await pool.query(
    `SELECT o.*, b.name AS brand_name, c.name AS confirmer_name
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     LEFT JOIN confirmers c ON c.id = o.confirmer_id
     WHERE o.id = ?`,
    [r.insertId]
  );

  // Automatic Ozon Express parcel creation if confirmed on creation with Ozon Express
  let ozonSync = null;
  if (order.call_status === 'Confirmé' && isOzonCompany(order.shipping_company)) {
    try {
      const ozonRes = await addParcelToOzon(order);
      ozonSync = ozonRes;
      if (ozonRes.success && ozonRes.tracking && ozonRes.tracking !== order.tracking_number) {
        await pool.query('UPDATE orders SET tracking_number = ? WHERE id = ?', [ozonRes.tracking, order.id]);
        order.tracking_number = ozonRes.tracking;
      }
    } catch (ozonErr) {
      console.error(`[Ozon Sync Exception] Order #${order.id}:`, ozonErr);
      ozonSync = { success: false, error: ozonErr.message };
    }
  }

  res.status(201).json({ order, ozon_sync: ozonSync });
});

router.put('/:id', async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Commande introuvable' });
  if (req.brandId && existing.brand_id !== req.brandId) return res.status(403).json({ error: 'Forbidden' });

  // If user is a confirmer, ensure the order is assigned to her
  if (req.user.role === 'confirmer' && existing.confirmer_id !== req.user.confirmer_id) {
    return res.status(403).json({ error: 'Action non autorisée. Cette commande ne vous est pas assignée.' });
  }

  const allowed = req.user.role === 'confirmer'
    ? ['customer_name', 'phone', 'city', 'address', 'note', 'quantity', 'price', 'delivery_fee', 'call_status', 'shipping_status', 'product_id', 'source', 'shipping_company', 'tracking_number']
    : ['customer_name', 'phone', 'city', 'address', 'note', 'quantity', 'price', 'cost', 'delivery_fee', 'call_status', 'shipping_status', 'confirmer_id', 'product_id', 'source', 'shipping_company', 'tracking_number'];

  const sets = [], params = [];
  for (const k of allowed) {
    if (req.body[k] === undefined) continue;
    if (k === 'call_status' && !CALL_STATUSES.includes(req.body[k])) {
      return res.status(400).json({ error: 'Statut d\'appel invalide' });
    }
    if (k === 'shipping_status' && !SHIP_STATUSES.includes(req.body[k])) {
      return res.status(400).json({ error: 'Statut de livraison invalide' });
    }
    if (k === 'product_id' && req.body[k]) {
      const [[p]] = await pool.query('SELECT * FROM products WHERE id = ? AND brand_id = ?',
        [req.body[k], existing.brand_id]);
      if (!p) return res.status(400).json({ error: 'Produit introuvable dans cette marque' });
      sets.push('product_name = ?'); params.push(p.name);
      sets.push('price = ?'); params.push(p.price);
      sets.push('cost = ?'); params.push(p.cost);
    }
    if (k === 'confirmer_id') {
      if (req.body[k]) {
        const [[c]] = await pool.query(
          `SELECT c.id FROM confirmers c
           LEFT JOIN confirmer_brands cb ON cb.confirmer_id = c.id
           WHERE c.id = ? AND (cb.brand_id = ? OR c.brand_id = ?)`,
          [req.body[k], existing.brand_id, existing.brand_id]
        );
        if (!c) return res.status(400).json({ error: 'Confirmateur introuvable dans cette marque' });
      }
    }
    sets.push(`${k} = ?`);
    params.push(req.body[k] === '' ? null : req.body[k]);
  }
  if (sets.length) {
    params.push(req.params.id);
    await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  const [[order]] = await pool.query(
    `SELECT o.*, b.name AS brand_name, c.name AS confirmer_name
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     LEFT JOIN confirmers c ON c.id = o.confirmer_id
     WHERE o.id = ?`,
    [req.params.id]
  );

  // Automatic Ozon Express parcel creation when order is confirmed and shipping company is Ozon Express
  let ozonSync = null;
  const isNowConfirmed = order.call_status === 'Confirmé';
  const isOzon = isOzonCompany(order.shipping_company);
  const wasAlreadyConfirmedWithOzon = existing.call_status === 'Confirmé' && isOzonCompany(existing.shipping_company) && existing.tracking_number;

  if (isNowConfirmed && isOzon && (!wasAlreadyConfirmedWithOzon || req.body.force_ozon_sync)) {
    try {
      const ozonRes = await addParcelToOzon(order);
      ozonSync = ozonRes;
      if (ozonRes.success && ozonRes.tracking && ozonRes.tracking !== order.tracking_number) {
        await pool.query('UPDATE orders SET tracking_number = ? WHERE id = ?', [ozonRes.tracking, order.id]);
        order.tracking_number = ozonRes.tracking;
      }
    } catch (ozonErr) {
      console.error(`[Ozon Sync Exception] Order #${order.id}:`, ozonErr);
      ozonSync = { success: false, error: ozonErr.message };
    }
  }

  res.json({ order, ozon_sync: ozonSync });
});

// Manual / Retry dispatch to Ozon Express
router.post('/:id/send-ozon', async (req, res) => {
  const [[order]] = await pool.query(
    `SELECT o.*, b.name AS brand_name, c.name AS confirmer_name
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     LEFT JOIN confirmers c ON c.id = o.confirmer_id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (req.brandId && order.brand_id !== req.brandId) return res.status(403).json({ error: 'Forbidden' });
  if (req.user.role === 'confirmer' && order.confirmer_id !== req.user.confirmer_id) {
    return res.status(403).json({ error: 'Action non autorisée' });
  }

  const ozonRes = await addParcelToOzon(order);
  if (ozonRes.success && ozonRes.tracking && ozonRes.tracking !== order.tracking_number) {
    await pool.query('UPDATE orders SET tracking_number = ?, shipping_company = ? WHERE id = ?', [
      ozonRes.tracking,
      order.shipping_company || 'Ozon Express',
      order.id,
    ]);
    order.tracking_number = ozonRes.tracking;
    order.shipping_company = order.shipping_company || 'Ozon Express';
  }

  res.json({ ok: ozonRes.success, ozon_sync: ozonRes, order });
});

// DELETE ORDER: Restricted to Admin only + Verified with Admin password
router.delete('/:id', verifyAdminPassword, async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Order deleted successfully' });
});

// Check for existing orders by phone number (Intelligent Duplicate & Product Detection)
router.get('/check-duplicate', async (req, res) => {
  const { phone, brand_id, product_id, product_name, customer_name } = req.query;
  if (!phone) return res.json({ found: false, count: 0, has_exact_duplicate: false, orders: [] });
  
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7) {
    return res.json({ found: false, count: 0, has_exact_duplicate: false, orders: [] });
  }

  const bid = req.brandId || (brand_id ? Number(brand_id) : null);
  const conds = ['(REPLACE(REPLACE(REPLACE(REPLACE(o.phone, " ", ""), "-", ""), "+", ""), "/", "") LIKE ? OR o.phone LIKE ?)'];
  const params = [`%${cleanPhone}%`, `%${phone}%`];
  
  if (bid) {
    conds.push('o.brand_id = ?');
    params.push(bid);
  }

  const [rows] = await pool.query(
    `SELECT o.id, o.brand_id, o.product_id, o.customer_name, o.phone, o.city, o.address, o.product_name,
            o.quantity, o.price, o.delivery_fee, o.call_status, o.shipping_status, o.source,
            o.note, o.created_at, b.name AS brand_name, c.name AS confirmer_name
     FROM orders o
     LEFT JOIN brands b ON b.id = o.brand_id
     LEFT JOIN confirmers c ON c.id = o.confirmer_id
     WHERE ${conds.join(' AND ')}
     ORDER BY o.created_at DESC LIMIT 10`,
    params
  );

  const now = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  const targetProdId = product_id ? Number(product_id) : null;
  const targetProdName = product_name ? String(product_name).toLowerCase().trim() : '';
  const targetCustName = customer_name ? String(customer_name).toLowerCase().trim() : '';

  const enrichedOrders = rows.map((order) => {
    const orderDate = new Date(order.created_at);
    const diffMs = now - orderDate.getTime();
    const isRecent = diffMs <= fortyEightHoursMs;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo = '';
    if (diffMinutes < 1) timeAgo = "À l'instant";
    else if (diffMinutes < 60) timeAgo = `Il y a ${diffMinutes} min`;
    else if (diffHours < 24) timeAgo = `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    else if (diffDays === 1) timeAgo = 'Hier';
    else timeAgo = `Il y a ${diffDays} jours`;

    // Check if it's the SAME product
    const oProdName = String(order.product_name || '').toLowerCase().trim();
    const isSameProduct = (targetProdId && order.product_id && Number(order.product_id) === targetProdId) ||
                          (targetProdName && oProdName && (targetProdName === oProdName || oProdName.includes(targetProdName) || targetProdName.includes(oProdName)));

    // Check if it's a DIFFERENT customer name
    const oCustName = String(order.customer_name || '').toLowerCase().trim();
    let isSameCustomerName = true;
    if (targetCustName && oCustName) {
      const wordsTarget = targetCustName.split(/\s+/).filter((w) => w.length > 2);
      const wordsOrder = oCustName.split(/\s+/).filter((w) => w.length > 2);
      if (wordsTarget.length > 0 && wordsOrder.length > 0) {
        const hasOverlap = wordsTarget.some((w) => oCustName.includes(w)) || wordsOrder.some((w) => targetCustName.includes(w));
        isSameCustomerName = hasOverlap;
      }
    }

    // Exact duplicate condition: recent AND same product AND (same customer name or name not specified yet)
    const isExactDuplicate = isRecent && isSameProduct && isSameCustomerName;
    const isDifferentProduct = isRecent && !isSameProduct;

    return {
      ...order,
      is_recent: isRecent,
      is_same_product: isSameProduct,
      is_same_customer_name: isSameCustomerName,
      is_exact_duplicate: isExactDuplicate,
      is_different_product: isDifferentProduct,
      time_ago: timeAgo,
    };
  });

  const exactDuplicates = enrichedOrders.filter((o) => o.is_exact_duplicate);
  const differentProductOrders = enrichedOrders.filter((o) => o.is_different_product);
  const olderOrders = enrichedOrders.filter((o) => !o.is_recent);

  // Blacklist & Refusal analysis
  const [[manualBl]] = await pool.query(
    'SELECT * FROM blacklist WHERE (REPLACE(REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", ""), "/", "") LIKE ? OR phone LIKE ?) AND is_blocked = TRUE',
    [`%${cleanPhone}%`, `%${phone}%`]
  );
  const refusalOrders = enrichedOrders.filter((o) =>
    ['Retourné', 'Refusé'].includes(o.shipping_status) || ['Fake order', 'Pas sérieux'].includes(o.call_status)
  );
  const deliveredOrders = enrichedOrders.filter((o) => o.shipping_status === 'Livré');
  const refusalCount = refusalOrders.length;
  const isBlacklisted = Boolean(manualBl) || refusalCount >= 3;

  res.json({
    found: enrichedOrders.length > 0,
    count: enrichedOrders.length,
    has_exact_duplicate: exactDuplicates.length > 0,
    exact_duplicates: exactDuplicates,
    has_different_product: differentProductOrders.length > 0 && exactDuplicates.length === 0,
    different_products: differentProductOrders,
    older_orders: olderOrders,
    is_blacklisted: isBlacklisted,
    manual_blacklist: manualBl || null,
    refusal_count: refusalCount,
    refusal_orders: refusalOrders,
    delivered_count: deliveredOrders.length,
    orders: enrichedOrders,
  });
});

router.get('/meta/statuses', async (req, res) => {
  res.json({ call_statuses: CALL_STATUSES, shipping_statuses: SHIP_STATUSES });
});

module.exports = router;

