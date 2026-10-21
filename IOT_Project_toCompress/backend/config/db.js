const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'iot_ptit',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  timezone: '+07:00'
});

pool.getConnection()
  .then(conn => {
    console.log('✓ Kết nối MySQL Database thành công!');
    conn.release();
  })
  .catch(err => {
    console.error('✗ Lỗi kết nối MySQL:', err.message);
  });

module.exports = pool;