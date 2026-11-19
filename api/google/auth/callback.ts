import { saveOAuthConnection } from "../../_lib/googleDrive";
import {
  appOrigin,
  clearOAuthStateCookie,
  createSessionCookie,
  verifyOAuthState,
} from "../../_lib/session";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  if (!verifyOAuthState(request, state) || !code) {
    return new Response("Google Drive authorization failed. Return to settings and try again.", {
      status: 400,
      headers: { "set-cookie": clearOAuthStateCookie(), "cache-control": "no-store" },
    });
  }

  const origin = appOrigin();
  const redirectUri = `${origin}/api/google/auth/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) return redirectWithError(origin);

  const tokenPayload: unknown = await tokenResponse.json();
  if (!isRecord(tokenPayload) || typeof tokenPayload.access_token !== "string") {
    return redirectWithError(origin);
  }

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokenPayload.access_token}` },
  });
  if (!userResponse.ok) return redirectWithError(origin);
  const user: unknown = await userResponse.json();
  if (!isRecord(user) || typeof user.email !== "string" || user.verified_email !== true) {
    return redirectWithError(origin);
  }

  await saveOAuthConnection(user.email, typeof tokenPayload.refresh_token === "string" ? tokenPayload.refresh_token : undefined);
  const headers = new Headers({
    location: `${origin}/settings?drive=connected`,
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearOAuthStateCookie());
  headers.append("set-cookie", createSessionCookie(user.email));
  return new Response(null, { status: 303, headers });
}

function redirectWithError(origin: string): Response {
  const headers = new Headers({
    location: `${origin}/settings?drive=error`,
    "cache-control": "no-store",
    "set-cookie": clearOAuthStateCookie(),
  });
  return new Response(null, { status: 303, headers });
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
