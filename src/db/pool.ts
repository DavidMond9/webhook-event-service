import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://webhook:webhook@localhost:5432/webhook',
});

pool.on('error', (err: Error) => {
  console.error('Unexpected Postgres error', err);
  process.exit(1);
});

export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}

export async function getClient() {
  return pool.connect();
}
