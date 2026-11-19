import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "basata_drive_session";
const OAUTH_STATE_COOKIE = "basata_drive_oauth_state";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

export function appOrigin(): string {
  const value = requiredEnv("APP_ORIGIN").replace(/\/+$/, "");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("app_origin_must_use_https");
  }
  return url.origin;
}

function secret(): string {
  const value = requiredEnv("APP_SESSION_SECRET");
  if (Buffer.byteLength(value) < 32) throw new Error("app_session_secret_too_short");
  return value;
}

function secureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

function cookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${value}`,
    "Path=/api",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secureCookie() ? ["Secure"] : []),
  ].join("; ");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry?.slice(name.length + 1);
}

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newOAuthState(): { state: string; setCookie: string } {
  const state = randomBytes(32).toString("base64url");
  return { state, setCookie: cookie(OAUTH_STATE_COOKIE, state, 10 * 60) };
}

export function verifyOAuthState(request: Request, state: string): boolean {
  const stored = readCookie(request, OAUTH_STATE_COOKIE);
  return Boolean(stored && secureEqual(stored, state));
}

export function clearOAuthStateCookie(): string {
  return cookie(OAUTH_STATE_COOKIE, "", 0);
}

export function createSessionCookie(email: string): string {
  const payload = Buffer.from(JSON.stringify({
    email,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString("base64url");
  return cookie(SESSION_COOKIE, `${payload}.${sign(payload)}`, SESSION_SECONDS);
}

export function readSessionEmail(request: Request): string | null {
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !secureEqual(sign(payload), signature)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" || parsed === null ||
    !("email" in parsed) || typeof parsed.email !== "string" ||
    !("expiresAt" in parsed) || typeof parsed.expiresAt !== "number" ||
    parsed.expiresAt <= Math.floor(Date.now() / 1000)
  ) return null;
  return parsed.email;
}

export function clearSessionCookie(): string {
  return cookie(SESSION_COOKIE, "", 0);
}

export function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
