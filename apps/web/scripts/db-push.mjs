import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing. Run via: dotenv -e .env.local -- node scripts/db-push.mjs");
  }
  return url;
}

function generateSql() {
  const schemaPath = join(root, "..", "prisma", "schema.prisma");
  const prismaBin = join(
    root,
    "..",
    "..",
    "..",
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );

  return execFileSync(
    process.execPath,
    [prismaBin, "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"],
    { encoding: "utf8", cwd: join(root, ".."), env: process.env },
  );
}

async function main() {
  const connectionString = loadDatabaseUrl();
  const sql = generateSql();

  if (!sql.trim()) {
    throw new Error("No SQL generated from Prisma schema.");
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("Database schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
