import path from "node:path";
import { fileURLToPath } from "node:url";

// Load apps/server/.env if present (Node ≥20.12)
try {
  process.loadEnvFile();
} catch {
  /* no .env file — fine */
}

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  /** Postgres (PGlite) data directory — back up this folder. */
  dataDir: process.env.MIZAN_DATA_DIR ?? path.join(here, "..", "data"),
  /** Optional fixed JWT secret; otherwise generated once into dataDir/jwt.secret. */
  jwtSecret: process.env.MIZAN_JWT_SECRET ?? "",
  /** CORS: "*" (default) or comma-separated origins. */
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  version: "0.1.0",
};
