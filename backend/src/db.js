require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool is lazy: no connection is opened until the first query runs,
// so the server can boot even if MySQL is briefly unreachable.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestionCmdMdiast',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
