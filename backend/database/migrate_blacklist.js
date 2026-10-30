const pool = require('../src/db');

async function migrate() {
  console.log('Running migration for Blacklist system...');

  // 1. Create blacklist table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(40) NOT NULL UNIQUE,
      customer_name VARCHAR(160) DEFAULT NULL,
      reason VARCHAR(255) DEFAULT NULL,
      is_blocked BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(120) DEFAULT 'system',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bl_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Created table blacklist');

  // 2. Add index on phone in orders if not exists
  try {
    await pool.query(`ALTER TABLE orders ADD INDEX idx_orders_phone (phone)`);
    console.log('✅ Added index idx_orders_phone on orders table');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') {
      console.log('ℹ️ Index idx_orders_phone already exists');
    } else {
      console.warn('Index note:', e.message);
    }
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
