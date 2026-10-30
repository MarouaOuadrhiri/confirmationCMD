-- ============================================================================
-- Mediast COD Management & Real-Time Tracking Schema (MySQL 8+)
-- Production Ready & Seeded for 4 Dedicated Handover Accounts + Confirmers
-- ============================================================================

CREATE DATABASE IF NOT EXISTS gestionCmdMdiast
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestionCmdMdiast;

-- 1. Brands Table
CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  login_email VARCHAR(190) DEFAULT NULL UNIQUE,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Confirmers Table
CREATE TABLE IF NOT EXISTS confirmers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  login_email VARCHAR(190) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Multi-Brand Confirmers Association Table
CREATE TABLE IF NOT EXISTS confirmer_brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  confirmer_id INT NOT NULL,
  brand_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_confirmer_brand (confirmer_id, brand_id),
  FOREIGN KEY (confirmer_id) REFERENCES confirmers(id) ON DELETE CASCADE,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Users Table (Authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','brand','confirmer') NOT NULL DEFAULT 'brand',
  brand_id INT NULL,
  confirmer_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmer_id) REFERENCES confirmers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Products & Landing Pages Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 100,
  min_stock_alert INT NOT NULL DEFAULT 15,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  INDEX idx_products_brand (brand_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Shipping Companies Table
CREATE TABLE IF NOT EXISTS shipping_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  tracking_url_template VARCHAR(255) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(160) DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  customer_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  city VARCHAR(120) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  note TEXT DEFAULT NULL,
  call_status VARCHAR(40) NOT NULL DEFAULT 'Nouveau',
  shipping_status VARCHAR(40) NOT NULL DEFAULT 'En attente',
  shipping_company VARCHAR(120) DEFAULT NULL,
  tracking_number VARCHAR(120) DEFAULT NULL,
  shipping_company_id INT NULL,
  tracking_code VARCHAR(120) DEFAULT NULL,
  confirmer_id INT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'landing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (confirmer_id) REFERENCES confirmers(id) ON DELETE SET NULL,
  FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id) ON DELETE SET NULL,
  INDEX idx_orders_brand (brand_id),
  INDEX idx_orders_created (created_at),
  INDEX idx_orders_call (call_status),
  INDEX idx_orders_ship (shipping_status),
  INDEX idx_orders_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Expenses Table (Ads & Charges)
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand_id INT NOT NULL,
  type ENUM('ads','charge') NOT NULL DEFAULT 'ads',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  label VARCHAR(160) DEFAULT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
  INDEX idx_expenses_brand (brand_id),
  INDEX idx_expenses_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Blacklist Table
CREATE TABLE IF NOT EXISTS blacklist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(40) NOT NULL UNIQUE,
  customer_name VARCHAR(160) DEFAULT NULL,
  reason VARCHAR(255) DEFAULT 'Refus répétés ou faux numéros',
  is_blocked BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(120) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blacklist_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INITIAL SEED DATA FOR DOCKER CONTAINER
-- ============================================================================

-- 1. Main Admin Account (Email: admin@dashboard.local / Pass: Admin123!)
INSERT INTO users (id, email, password_hash, role) VALUES 
(1, 'admin@dashboard.local', '$2a$10$Ob02KlE8Xi17vqoGgLZ.pOBrN13euM7WjKZnlLc6.yh04puxa0u8G', 'admin')
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);

-- 2. Shipping Companies
INSERT INTO shipping_companies (id, name, phone, tracking_url_template) VALUES
(1, 'Ozon Express', '0522001122', 'https://ozon.ma/track?c={TRACKING_NUMBER}'),
(2, 'Sendit Delivery', '0522334455', 'https://sendit.ma/suivi/{TRACKING_NUMBER}'),
(3, 'Cathedis', '0522667788', 'https://cathedis.net/tracking/{TRACKING_NUMBER}'),
(4, 'Amana Express', '0802006060', 'https://barid.ma/suivi/{TRACKING_NUMBER}'),
(5, 'Yalidine Express', '0982400400', 'https://yalidine.app/track/{TRACKING_NUMBER}')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 3. Core Brands
INSERT INTO brands (id, name, slug, login_email, api_key) VALUES
(1, 'Okinso', 'okinso', 'okinso@dashboard.local', 'okinso_live_api_key_8f7b2a9e3d4c1b0a'),
(2, 'Vinillia', 'vinillia', 'vinillia@dashboard.local', 'vinillia_live_api_key_4e5d6c7b8a9f0e1d'),
(3, 'Marjad', 'marjad', 'marjad@dashboard.local', 'marjad_live_api_key_1a2b3c4d5e6f7a8b')
ON DUPLICATE KEY UPDATE login_email = VALUES(login_email);

-- 4. Brand Users (Pass: Brand123!)
INSERT INTO users (id, email, password_hash, role, brand_id) VALUES
(2, 'okinso@dashboard.local', '$2a$10$XKib93x6A3/g/KWKB31cuer3lBtXxwnqMlwOMU0E9bbJ/a8dtWSLK', 'brand', 1),
(3, 'vinillia@dashboard.local', '$2a$10$XKib93x6A3/g/KWKB31cuer3lBtXxwnqMlwOMU0E9bbJ/a8dtWSLK', 'brand', 2),
(4, 'marjad@dashboard.local', '$2a$10$XKib93x6A3/g/KWKB31cuer3lBtXxwnqMlwOMU0E9bbJ/a8dtWSLK', 'brand', 3)
ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), brand_id = VALUES(brand_id);

-- 5. Products Catalog
INSERT INTO products (id, brand_id, name, price, cost, delivery_fee, stock, min_stock_alert) VALUES
(1, 1, 'Crystal Rose', 649.00, 120.00, 0.00, 150, 15),
(2, 1, 'Crystal Mauve', 649.00, 120.00, 0.00, 120, 15),
(3, 1, 'VitaSilk', 299.00, 100.00, 0.00, 90, 15),
(4, 1, 'SOS Therapy', 249.00, 150.00, 0.00, 80, 15),
(5, 1, 'SOS Gold', 397.00, 160.00, 0.00, 110, 15),
(6, 1, 'SOS Rose Foncé', 347.00, 150.00, 0.00, 95, 15),
(7, 2, 'Keratin Complex', 399.00, 180.00, 0.00, 130, 15),
(8, 2, 'Shampoo Cafeine', 199.00, 80.00, 35.00, 200, 20)
ON DUPLICATE KEY UPDATE price = VALUES(price), cost = VALUES(cost);

-- 6. Confirmer 1 (Optional - uncomment if needed)
-- INSERT INTO confirmers (id, brand_id, name, phone, login_email) VALUES
-- (1, 1, 'Sarah Multi-Brand', '0611223344', 'confirmer1@dashboard.local')
-- ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Confirmer Brand Associations
-- INSERT INTO confirmer_brands (confirmer_id, brand_id) VALUES
-- (1, 1),
-- (1, 2),
-- (1, 3)
-- ON DUPLICATE KEY UPDATE confirmer_id = VALUES(confirmer_id);

-- Confirmer User Login
-- INSERT INTO users (id, email, password_hash, role, confirmer_id, brand_id) VALUES
-- (5, 'confirmer1@dashboard.local', '$2a$10$ZUN3EGQ6GVBjx.5MHTmpEu3ZmxszFNSZqbhLTXVxWqFhSrhZvEKdS', 'confirmer', 1, 1)
-- ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), confirmer_id = VALUES(confirmer_id);
