const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '134.65.27.178',
  user: 'grupo3',
  password: '123456',
  database: 'grupo3',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

module.exports = pool;

