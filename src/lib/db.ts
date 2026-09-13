import { Pool } from 'pg';
let pool: Pool | undefined;
// A raw connectionString with "sslmode=require" makes pg enforce full CA verification,
// which fails against TigerData's cert chain. Strip the query string and pass our own
// ssl option instead — the connection stays encrypted, we just skip CA verification.
function poolConfig() {
  const url = new URL(process.env.DATABASE_URL!);
  return { host: url.hostname, port: Number(url.port), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), ssl: { rejectUnauthorized: false }, max: 5 };
}
export function db(): Pool { if (!pool) pool = new Pool(poolConfig()); return pool; }
