require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../src/db');

async function migrate() {
  console.log('🔄 Starting multi-brand confirmers migration...');

  try {
    // 1. Create confirmer_brands table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS confirmer_brands (
        confirmer_id INT NOT NULL,
        brand_id INT NOT NULL,
        PRIMARY KEY (confirmer_id, brand_id),
        FOREIGN KEY (confirmer_id) REFERENCES confirmers(id) ON DELETE CASCADE,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created confirmer_brands table');

    // 2. Make confirmers.brand_id nullable if not already
    try {
      await pool.query('ALTER TABLE confirmers MODIFY brand_id INT NULL');
      console.log('✅ Made confirmers.brand_id nullable');
    } catch (e) {
      console.log('Notice (confirmers.brand_id):', e.message);
    }

    // 3. Make users.brand_id nullable if not already
    try {
      await pool.query('ALTER TABLE users MODIFY brand_id INT NULL');
      console.log('✅ Made users.brand_id nullable');
    } catch (e) {
      console.log('Notice (users.brand_id):', e.message);
    }

    // 4. Populate confirmer_brands with existing relationships
    await pool.query(`
      INSERT IGNORE INTO confirmer_brands (confirmer_id, brand_id)
      SELECT id, brand_id FROM confirmers WHERE brand_id IS NOT NULL;
    `);
    console.log('✅ Populated confirmer_brands with existing data');

    console.log('🎉 Multi-brand confirmers migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
