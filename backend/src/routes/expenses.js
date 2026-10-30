const express = require('express');
const pool = require('../db');
const { authRequired, scopeBrand, verifyAdminPassword } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const conds = [], params = [];
  scopeBrand('e', req, conds, params);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const [expenses] = await pool.query(
    `SELECT e.*, b.name AS brand_name FROM expenses e
     JOIN brands b ON b.id = e.brand_id ${where} ORDER BY e.date DESC, e.id DESC`,
    params
  );
  res.json({ expenses });
});

router.post('/', async (req, res) => {
  const { type = 'ads', amount, label, date, brand_id } = req.body;
  if (!['ads', 'charge'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (amount === undefined || Number(amount) < 0) return res.status(400).json({ error: 'amount is required' });
  const bid = req.brandId || Number(brand_id);
  if (!bid) return res.status(400).json({ error: 'brand_id is required' });
  const [r] = await pool.query(
    'INSERT INTO expenses (brand_id, type, amount, label, date) VALUES (?,?,?,?,?)',
    [bid, type, Number(amount), label || null, date || new Date().toISOString().slice(0, 10)]
  );
  const [[expense]] = await pool.query('SELECT * FROM expenses WHERE id = ?', [r.insertId]);
  res.status(201).json({ expense });
});

router.delete('/:id', verifyAdminPassword, async (req, res) => {
  const [[existing]] = await pool.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Expense deleted successfully' });
});

module.exports = router;
