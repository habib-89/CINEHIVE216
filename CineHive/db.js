// db.js — Oracle connection pool for CineHive
require('dotenv').config();
const oracledb = require('oracledb');

// Return objects with plain field names (e.g. row.TITLE) instead of arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function initPool() {
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1
  });
  console.log('Oracle connection pool created');
}

async function closePool() {
  if (pool) {
    await pool.close(10); // wait up to 10s for connections to finish
    console.log('Oracle connection pool closed');
  }
}

// Run a query, always releasing the connection back to the pool
async function execute(sql, binds = {}, opts = {}) {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, {
      autoCommit: true,
      ...opts
    });
    return result;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error releasing connection:', err);
      }
    }
  }
}

// Get a raw connection for multi-statement transactions (caller must close it)
async function getRawConnection() {
  return pool.getConnection();
}

module.exports = { initPool, closePool, execute, getRawConnection, oracledb };