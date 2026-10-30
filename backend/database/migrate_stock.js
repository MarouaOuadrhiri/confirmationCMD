const pool = require('../src/db');

async function migrate() {
  try {
    console.log('Migrating products table for stock support...');
    
    // Add stock column
    try {
      await pool.query('ALTER TABLE products ADD COLUMN stock INT NOT NULL DEFAULT 100');
      console.log('✅ Added stock column');
    } catch (e) {
      if (!e.message.includes('Duplicate column')) console.log('Notice:', e.message);
    }

    // Add min_stock_alert column
    try {
      await pool.query('ALTER TABLE products ADD COLUMN min_stock_alert INT NOT NULL DEFAULT 15');
      console.log('✅ Added min_stock_alert column');
    } catch (e) {
      if (!e.message.includes('Duplicate column')) console.log('Notice:', e.message);
    }

    // Set demo realistic stock
    await pool.query('UPDATE products SET stock = 120 WHERE name LIKE ?', ['%Rose%']);
    await pool.query('UPDATE products SET stock = 85 WHERE name LIKE ?', ['%Mauve%']);
    await pool.query('UPDATE products SET stock = 150 WHERE name LIKE ?', ['%VitaSilk%']);
    await pool.query('UPDATE products SET stock = 45 WHERE name LIKE ?', ['%Keratin%']);
    await pool.query('UPDATE products SET stock = 90 WHERE name LIKE ?', ['%Cafeine%']);
    await pool.query('UPDATE products SET stock = 80 WHERE name LIKE ?', ['%PanOxyl%']);

    const [rows] = await pool.query('SELECT id, name, price, cost, stock, min_stock_alert FROM products');
    console.log('📦 Products with Stock:');
    console.table(rows);
    console.log('✅ Stock Migration Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
