import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const tables = await client.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
    AND (tablename ILIKE '%sheet%' OR tablename ILIKE '%sync%' OR tablename = 'Profile')
  ORDER BY tablename
`);
console.log("Tables:", tables.rows);

const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Profile'
  ORDER BY column_name
`);
console.log("Profile columns:", cols.rows.map((r) => r.column_name));

await client.end();
