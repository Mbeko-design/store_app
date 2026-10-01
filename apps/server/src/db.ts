import { PGlite } from "@electric-sql/pglite";
import { config } from "./config.js";

let db: PGlite | null = null;

async function migrate(database: PGlite): Promise<void> {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS events (
      seq        BIGSERIAL PRIMARY KEY,
      uuid       TEXT NOT NULL UNIQUE,
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id  TEXT NOT NULL,
      kind       TEXT NOT NULL,
      payload    JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS events_user_seq ON events (user_id, seq);
    CREATE INDEX IF NOT EXISTS events_user_device ON events (user_id, device_id);
  `);
}

/** Lazily open the database and ensure the schema exists. */
export async function getDb(): Promise<PGlite> {
  if (!db) {
    db = new PGlite(config.dataDir);
    await migrate(db);
  }
  return db;
}
