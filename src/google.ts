import { randomBytes } from "node:crypto";
import { getStore, randomId, type User } from "./db.ts";

const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

export function googleConfigured(): boolean {
  return !!clientId && !!clientSecret;
}

export function randomState(): string {
  return randomBytes(18).toString("base64url");
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface GoogleProfile {
  email: string;
  sub: string;
  name?: string;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!token.access_token) {
    throw new Error(token.error_description ?? token.error ?? "Google token exchange failed");
  }
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    sub?: string;
    name?: string;
  };
  if (!info.email || !info.email_verified) {
    throw new Error("Google account has no verified email");
  }
  return {
    email: String(info.email).toLowerCase(),
    sub: String(info.sub),
    name: typeof info.name === "string" ? info.name : undefined,
  };
}

export async function findOrCreateGoogleUser(email: string, sub: string): Promise<User> {
  const store = await getStore();
  let user = await store.findUserByEmail(email);
  if (!user) {
    user = {
      id: randomId(),
      email,
      passwordHash: randomBytes(32).toString("hex"),
      salt: randomBytes(16).toString("hex"),
      googleSub: sub,
      createdAt: Date.now(),
    };
    await store.createUser(user);
  }
  return user;
}
