import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Ưu tiên chuỗi kết nối từ Neon / Vercel (DATABASE_URL hoặc POSTGRES_URL)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Yêu cầu bảo mật SSL cho Neon Postgres trên Cloud
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'partner_ecom',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});
