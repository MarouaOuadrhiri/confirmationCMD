require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const authRouter = require('./routes/auth');
const brandsRouter = require('./routes/brands');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const confirmersRouter = require('./routes/confirmers');
const expensesRouter = require('./routes/expenses');
const statsRouter = require('./routes/stats');
const shippingCompaniesRouter = require('./routes/shipping_companies');
const blacklistRouter = require('./routes/blacklist');
const publicRouter = require('./routes/public');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Express 4 does not forward async errors to the error middleware —
// without this, a single DB failure would crash the whole process.
function catchAsync(router) {
  const wrap = (handle) =>
    function (req, res, next) {
      Promise.resolve(handle.call(this, req, res, next)).catch(next);
    };
  for (const layer of router.stack || []) {
    if (layer.route) {
      for (const s of layer.route.stack) s.handle = wrap(s.handle);
    } else if (typeof layer.handle === 'function' && layer.handle.length < 4) {
      layer.handle = wrap(layer.handle); // async middleware (e.g. apiKeyAuth)
    }
  }
  return router;
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'unreachable', hint: 'Check DB_* in .env and that MySQL is running' });
  }
});

app.use('/api/auth', catchAsync(authRouter));
app.use('/api/brands', catchAsync(brandsRouter));
app.use('/api/products', catchAsync(productsRouter));
app.use('/api/orders', catchAsync(ordersRouter));
app.use('/api/confirmers', catchAsync(confirmersRouter));
app.use('/api/expenses', catchAsync(expensesRouter));
app.use('/api/stats', catchAsync(statsRouter));
app.use('/api/shipping-companies', catchAsync(shippingCompaniesRouter));
app.use('/api/blacklist', catchAsync(blacklistRouter));
app.use('/api/public', catchAsync(publicRouter)); // landing pages (API-key auth)

// 404 + error handling
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Mediast API listening on http://localhost:${PORT}`);
});
