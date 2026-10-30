const pool = require('../src/db');

async function migrate() {
  try {
    console.log('🔄 Migrating database for delivery fee support...');

    // 1. Add delivery_fee column to products table
    try {
      await pool.query('ALTER TABLE products ADD COLUMN delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER cost');
      console.log('✅ Added delivery_fee column to products table');
    } catch (e) {
      if (!e.message.includes('Duplicate column')) {
        console.log('Notice (products.delivery_fee):', e.message);
      } else {
        console.log('ℹ️ products.delivery_fee column already exists');
      }
    }

    // 2. Add delivery_fee column to orders table
    try {
      await pool.query('ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER cost');
      console.log('✅ Added delivery_fee column to orders table');
    } catch (e) {
      if (!e.message.includes('Duplicate column')) {
        console.log('Notice (orders.delivery_fee):', e.message);
      } else {
        console.log('ℹ️ orders.delivery_fee column already exists');
      }
    }

    // 3. Set delivery_fee for all products: 0 for all landing pages, 35 for Shampoo Cafeine
    await pool.query('UPDATE products SET delivery_fee = 0.00');
    await pool.query('UPDATE products SET price = 199.00, delivery_fee = 35.00 WHERE name LIKE ? OR name LIKE ?', ['%Cafeine%', '%Caffeine%']);
    
    // Also update existing orders for Shampoo Cafeine to have price = 199 and delivery_fee = 35
    await pool.query('UPDATE orders SET delivery_fee = 0.00 WHERE delivery_fee IS NULL');
    await pool.query('UPDATE orders SET price = 199.00, delivery_fee = 35.00 WHERE product_name LIKE ? OR product_name LIKE ?', ['%Cafeine%', '%Caffeine%']);

    const [products] = await pool.query('SELECT id, name, price, cost, delivery_fee, stock FROM products');
    console.log('\n🛍️ Products with Delivery Fees:');
    console.table(products);

    const [sampleOrders] = await pool.query('SELECT id, product_name, price, delivery_fee, quantity, call_status FROM orders LIMIT 8');
    console.log('\n📦 Sample Orders:');
    console.table(sampleOrders);

    console.log('✅ Delivery Fee Migration Completed Successfully!');
  } catch (err) {
    console.error('❌ Migration Error:', err);
  } finally {
    await pool.end();
  }
}

migrate();
