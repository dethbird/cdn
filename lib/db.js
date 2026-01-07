import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'cdn',
  password: process.env.DB_PASSWORD || 'P1zzaP4rty!!!',
  database: process.env.DB_NAME || 'cdn',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { status: 'connected', error: null };
  } catch (error) {
    return { status: 'disconnected', error: error.message };
  }
}

export default pool;
