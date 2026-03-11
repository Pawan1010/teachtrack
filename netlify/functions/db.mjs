import { neon } from "@neondatabase/serverless";

function getDb() {
  const databaseUrl =
    process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(databaseUrl);
}

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS classes (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      hourly_rate NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS lectures (
      id SERIAL PRIMARY KEY,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      duration NUMERIC(4,1) NOT NULL,
      topic TEXT DEFAULT '',
      paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export { getDb, ensureTables };
