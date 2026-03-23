const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'tank_game',
  waitForConnections: true,
  connectionLimit: 10,
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function getToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return '';
  return auth.slice(7);
}

function verifyToken(event) {
  const token = getToken(event);
  if (!token) throw new Error('未登录');
  return jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
}

module.exports = {
  pool,
  json,
  verifyToken,
};
