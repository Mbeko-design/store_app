import { appOrigin, newOAuthState } from "../../_lib/session";

export function GET(): Response {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response("Google Drive backup is not configured.", { status: 503 });

  const { state, setCookie } = newOAuthState();
  const redirectUri = `${appOrigin()}/api/google/auth/callback`;
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "openid email https://www.googleapis.com/auth/drive.file",
    state,
  }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizationUrl.toString(),
      "set-cookie": setCookie,
      "cache-control": "no-store",
    },
  });
}
