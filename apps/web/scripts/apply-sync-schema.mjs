import pg from "pg";

const sql = `
CREATE TABLE IF NOT EXISTS "GoogleSheetSyncMeta" (
  "spreadsheetId" TEXT NOT NULL,
  "contentFingerprint" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleSheetSyncMeta_pkey" PRIMARY KEY ("spreadsheetId")
);

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "lastSheetSyncAt" TIMESTAMP(3);
`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log("Applied GoogleSheetSyncMeta + Profile.lastSheetSyncAt.");
} finally {
  await client.end();
}
