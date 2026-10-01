import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config.js";

function scryptAsync(password: string, salt: string, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const key = await scryptAsync(password, salt, expected.length);
  return expected.length === key.length && timingSafeEqual(expected, key);
}

let secret: Uint8Array | null = null;

async function getSecret(): Promise<Uint8Array> {
  if (secret) return secret;
  if (config.jwtSecret) {
    secret = new TextEncoder().encode(config.jwtSecret);
    return secret;
  }
  const file = path.join(config.dataDir, "jwt.secret");
  try {
    const existing = await fs.readFile(file, "utf8");
    secret = new TextEncoder().encode(existing.trim());
  } catch {
    const generated = randomBytes(48).toString("base64url");
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.writeFile(file, generated, { mode: 0o600 });
    secret = new TextEncoder().encode(generated);
  }
  return secret;
}

export interface TokenPayload {
  sub: string;
  email: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(await getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, await getSecret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
