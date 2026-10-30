const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../src/db');

async function addMarjadBrand() {
  console.log('Adding Marjad brand to database...');

  const name = 'Marjad';
  const slug = 'marjad';
  const loginEmail = 'marjad@dashboard.local';
  const loginPassword = 'Brand123!';

  // Check if brand exists
  const [[existing]] = await pool.query('SELECT * FROM brands WHERE slug = ? OR login_email = ?', [slug, loginEmail]);
  if (existing) {
    console.log('Brand Marjad already exists with ID:', existing.id);
    process.exit(0);
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  const [r] = await pool.query(
    'INSERT INTO brands (name, slug, login_email, api_key) VALUES (?,?,?,?)',
    [name, slug, loginEmail, apiKey]
  );
  const brandId = r.insertId;

  await pool.query(
    'INSERT INTO users (email, password_hash, role, brand_id) VALUES (?,?,?,?)',
    [loginEmail, bcrypt.hashSync(loginPassword, 10), 'brand', brandId]
  );

  console.log(`✅ Brand "${name}" created successfully with ID: ${brandId}`);
  console.log(`📧 Login Email: ${loginEmail}`);
  console.log(`🔑 API Key: ${apiKey}`);
  process.exit(0);
}

addMarjadBrand().catch((err) => {
  console.error('Error creating Marjad brand:', err);
  process.exit(1);
});
