require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../src/db');

async function migrate() {
  console.log('🔄 Starting shipping companies migration...');

  try {
    // 1. Create shipping_companies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipping_companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        phone VARCHAR(40) DEFAULT NULL,
        tracking_url_template VARCHAR(255) DEFAULT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Created shipping_companies table');

    try {
      await pool.query('ALTER TABLE shipping_companies ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER tracking_url_template');
      console.log('✅ Added is_active column to shipping_companies table');
    } catch (e) {
      console.log('Notice (shipping_companies.is_active):', e.message);
    }

    // 2. Add shipping_company and tracking_number columns to orders table
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN shipping_company VARCHAR(100) NULL AFTER shipping_status');
      console.log('✅ Added shipping_company column to orders table');
    } catch (e) {
      console.log('Notice (orders.shipping_company):', e.message);
    }

    try {
      await pool.query('ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100) NULL AFTER shipping_company');
      console.log('✅ Added tracking_number column to orders table');
    } catch (e) {
      console.log('Notice (orders.tracking_number):', e.message);
    }

    // 3. Seed default shipping companies
    const defaults = [
      { name: 'Ozon Express', phone: '0522000000' },
      { name: 'Sendit', phone: '0522111111' },
      { name: 'Cathedis', phone: '0522222222' },
      { name: 'Amana Express', phone: '0800000000' },
      { name: 'Yalidine', phone: '0522333333' },
    ];

    for (const comp of defaults) {
      await pool.query(
        'INSERT IGNORE INTO shipping_companies (name, phone) VALUES (?,?)',
        [comp.name, comp.phone]
      );
    }
    console.log('✅ Seeded default shipping companies (Ozon Express, Sendit, Cathedis, etc.)');

    console.log('🎉 Shipping companies migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
