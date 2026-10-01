import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { validatePushEvent, type SyncEvent } from "@mizan/core";
import { config } from "./config.js";
import { getDb } from "./db.js";
import { hashPassword, signToken, verifyPassword, verifyToken, type TokenPayload } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: TokenPayload | null;
  }
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

interface EventRow {
  seq: number | string;
  uuid: string;
  device_id: string;
  kind: string;
  payload: SyncEvent["payload"];
  created_at: string;
}

const MAX_EVENTS_PER_PUSH = 500;
const MAX_PULL_PAGE = 500;

function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length >= 3 && value.length <= 254 && value.includes("@") && !value.includes(" ");
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    bodyLimit: 8 * 1024 * 1024,
  });

  const corsOrigin = config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((s) => s.trim());
  await app.register(cors, { origin: corsOrigin });

  app.decorateRequest("auth", null);

  async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const payload = await verifyToken(header.slice(7));
    if (!payload) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    req.auth = payload;
  }

  app.get("/api/health", async () => ({ ok: true, version: config.version }));

  // ---- Auth ----------------------------------------------------------------

  app.post<{ Body: { email?: unknown; password?: unknown } }>("/api/auth/register", async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!isEmail(email)) return reply.code(400).send({ error: "bad_email" });
    if (typeof password !== "string" || password.length < 6) return reply.code(400).send({ error: "weak_password" });

    const db = await getDb();
    const count = await db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
    if ((count.rows[0]?.n ?? 0) > 0) {
      return reply.code(403).send({ error: "registration_closed" });
    }

    const passwordHash = await hashPassword(password);
    const inserted = await db.query<UserRow>(
      "INSERT INTO users (email, password_hash) VALUES (LOWER($1), $2) RETURNING id, email, password_hash",
      [email.toLowerCase(), passwordHash],
    );
    const user = inserted.rows[0]!;
    const token = await signToken({ sub: user.id, email: user.email });
    return { token, email: user.email };
  });

  app.post<{ Body: { email?: unknown; password?: unknown } }>("/api/auth/login", async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!isEmail(email) || typeof password !== "string") return reply.code(400).send({ error: "bad_request" });

    const db = await getDb();
    const found = await db.query<UserRow>("SELECT id, email, password_hash FROM users WHERE email = LOWER($1)", [email]);
    const user = found.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const token = await signToken({ sub: user.id, email: user.email });
    return { token, email: user.email };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => ({ id: req.auth!.sub, email: req.auth!.email }));

  // ---- Sync ----------------------------------------------------------------

  app.post<{ Body: { deviceId?: unknown; events?: unknown } }>("/api/sync/push", { preHandler: requireAuth }, async (req, reply) => {
    const { deviceId, events } = req.body ?? {};
    if (typeof deviceId !== "string" || deviceId.length === 0 || deviceId.length > 128) {
      return reply.code(400).send({ error: "bad_device_id" });
    }
    if (!Array.isArray(events) || events.length === 0) return { inserted: 0 };
    if (events.length > MAX_EVENTS_PER_PUSH) return reply.code(400).send({ error: "too_many_events" });

    // Validate everything first — all-or-nothing push.
    for (let i = 0; i < events.length; i++) {
      try {
        validatePushEvent(events[i] as Record<string, unknown>, deviceId);
      } catch (err) {
        const code = err instanceof Error ? err.message : "invalid_event";
        return reply.code(400).send({ error: "invalid_event", index: i, code });
      }
    }

    const db = await getDb();
    let inserted = 0;
    for (const raw of events) {
      const ev = raw as { uuid: string; kind: string; deviceId: string; payload: unknown };
      const result = await db.query(
        `INSERT INTO events (uuid, user_id, device_id, kind, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (uuid) DO NOTHING`,
        [ev.uuid, req.auth!.sub, ev.deviceId, ev.kind, JSON.stringify(ev.payload)],
      );
      inserted += result.affectedRows ?? 0;
    }

    const max = await db.query<{ seq: number | string }>("SELECT COALESCE(MAX(seq), 0) AS seq FROM events WHERE user_id = $1", [
      req.auth!.sub,
    ]);
    return { inserted, serverSeq: Number(max.rows[0]?.seq ?? 0) };
  });

  app.get<{ Querystring: { since?: string; limit?: string } }>(
    "/api/sync/pull",
    { preHandler: requireAuth },
    async (req, reply) => {
      const since = Number(req.query.since ?? "0");
      const limit = Math.min(Number(req.query.limit ?? MAX_PULL_PAGE) || MAX_PULL_PAGE, MAX_PULL_PAGE);
      if (!Number.isFinite(since) || since < 0) return reply.code(400).send({ error: "bad_since" });

      const db = await getDb();
      const result = await db.query<EventRow>(
        `SELECT seq, uuid, device_id, kind, payload, created_at
         FROM events
         WHERE user_id = $1 AND seq > $2
         ORDER BY seq ASC
         LIMIT $3`,
        [req.auth!.sub, since, limit],
      );

      const events: SyncEvent[] = result.rows.map((row) => {
        const payload = row.payload as SyncEvent["payload"];
        const occurredAt =
          row.kind === "journal_entry" ? (payload as { occurredAt?: string }).occurredAt ?? row.created_at : row.created_at;
        return {
          uuid: row.uuid,
          kind: row.kind as SyncEvent["kind"],
          occurredAt,
          deviceId: row.device_id,
          payload,
          seq: Number(row.seq),
        };
      });

      const lastSeq = events.length > 0 ? events[events.length - 1]!.seq : since;
      return { events, serverSeq: lastSeq };
    },
  );

  // ---- Devices (diagnostics) -----------------------------------------------

  app.get("/api/devices", { preHandler: requireAuth }, async (req) => {
    const db = await getDb();
    const result = await db.query<{ device_id: string; last_seen: string }>(
      "SELECT device_id, MAX(created_at) AS last_seen FROM events WHERE user_id = $1 GROUP BY device_id ORDER BY last_seen DESC",
      [req.auth!.sub],
    );
    return {
      devices: result.rows.map((r) => ({ deviceId: r.device_id, lastSeen: r.last_seen })),
    };
  });

  return app;
}
