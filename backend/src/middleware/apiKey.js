const pool = require('../db');

// Authenticates a landing page via its BRAND api key.
// Key can be sent as header "x-api-key" or query param "?api_key=".
// All landing pages of one brand share the brand's key;
// the order payload's product_id says which landing page it came from.
async function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'Missing api_key' });
  const [[brand]] = await pool.query(
    'SELECT id, name, slug FROM brands WHERE api_key = ?',
    [String(key).trim()]
  );
  if (!brand) return res.status(401).json({ error: 'Invalid api_key' });
  req.brand = brand;
  next();
}

module.exports = { apiKeyAuth };
