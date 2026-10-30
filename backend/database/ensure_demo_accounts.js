/** Add missing demo accounts without resetting existing application data. */
require('dotenv').config({ path: __dirname + '/../.env' });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../src/db');
async function main() {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const ids = [];
    for (const [name, slug] of [['Lumera', 'lumera'], ['Noria', 'noria'], ['Atlas Studio', 'atlas-studio']]) {
      const email = `${slug}@dashboard.local`;
      let [[brand]] = await db.query('SELECT id FROM brands WHERE slug = ?', [slug]);
      if (!brand) {
        const [result] = await db.query('INSERT INTO brands (name, slug, login_email, api_key) VALUES (?,?,?,?)', [name, slug, email, crypto.randomBytes(32).toString('hex')]);
        brand = { id: result.insertId };
      }
      ids.push(brand.id);
      const [[user]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (!user) await db.query('INSERT INTO users (email, password_hash, role, brand_id) VALUES (?,?,?,?)', [email, await bcrypt.hash('Brand123!', 10), 'brand', brand.id]);
    }
    const email = 'confirmer1@dashboard.local';
    const [[user]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      const [result] = await db.query('INSERT INTO confirmers (brand_id, name, login_email) VALUES (?,?,?)', [ids[0], 'Sarah Démo', email]);
      for (const brandId of ids) await db.query('INSERT INTO confirmer_brands (confirmer_id, brand_id) VALUES (?,?)', [result.insertId, brandId]);
      await db.query('INSERT INTO users (email, password_hash, role, confirmer_id, brand_id) VALUES (?,?,?,?,?)', [email, await bcrypt.hash('Confirmer123!', 10), 'confirmer', result.insertId, ids[0]]);
    }
    await db.commit();
    console.log('Missing demo accounts created; existing accounts and data preserved.');
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
