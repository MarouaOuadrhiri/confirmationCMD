require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../src/db');
const bcrypt = require('bcryptjs');

async function migrate() {
  console.log('--- Migrating Confirmer Accounts & Roles ---');
  
  try {
    // 1. Modify users.role enum
    await pool.query(`ALTER TABLE users MODIFY COLUMN role ENUM('admin','brand','confirmer') NOT NULL DEFAULT 'brand'`);
    console.log('✓ Updated users.role ENUM to include "confirmer"');
  } catch (e) {
    console.log('Note on users.role:', e.message);
  }

  try {
    // 2. Add confirmer_id to users table
    const [cols] = await pool.query(`SHOW COLUMNS FROM users LIKE 'confirmer_id'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN confirmer_id INT NULL, ADD FOREIGN KEY (confirmer_id) REFERENCES confirmers(id) ON DELETE SET NULL`);
      console.log('✓ Added confirmer_id to users table');
    }
  } catch (e) {
    console.log('Note on users.confirmer_id:', e.message);
  }

  try {
    // 3. Add login_email to confirmers table
    const [cols2] = await pool.query(`SHOW COLUMNS FROM confirmers LIKE 'login_email'`);
    if (cols2.length === 0) {
      await pool.query(`ALTER TABLE confirmers ADD COLUMN login_email VARCHAR(190) NULL`);
      console.log('✓ Added login_email to confirmers table');
    }
  } catch (e) {
    console.log('Note on confirmers.login_email:', e.message);
  }

  try {
    // 4. Ensure demo confirmers have accounts if seed ran
    const [confirmers] = await pool.query(`SELECT * FROM confirmers`);
    for (const c of confirmers) {
      const email = `confirmer${c.id}@dashboard.local`;
      const [[existingUser]] = await pool.query(`SELECT * FROM users WHERE email = ?`, [email]);
      if (!existingUser) {
        const hash = await bcrypt.hash('Confirmer123!', 10);
        await pool.query(`INSERT INTO users (email, password_hash, role, brand_id, confirmer_id) VALUES (?,?,?,?,?)`,
          [email, hash, 'confirmer', c.brand_id, c.id]);
        await pool.query(`UPDATE confirmers SET login_email = ? WHERE id = ?`, [email, c.id]);
        console.log(`✓ Created user account for confirmer ${c.name} (${email})`);
      }
    }
  } catch (e) {
    console.log('Note on demo confirmers:', e.message);
  }

  console.log('--- Migration Finished Successfully ---');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
