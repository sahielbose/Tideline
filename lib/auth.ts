/**
 * Lightweight, dependency-free auth: scrypt password hashing + an HMAC-signed
 * session cookie. Kept behind this module so it could be swapped for Auth.js
 * without touching callers. For a frictionless local demo, when no session
 * cookie is present we fall back to the seeded demo user (DEMO_AUTOLOGIN).
 */
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users, type User } from "./db/schema";
import { config } from "./config";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword } from "./password";

const COOKIE = "tideline_session";
const DEMO_EMAIL = "demo@tideline.app";
const autologin = process.env.DEMO_AUTOLOGIN !== "false";

// ---- signed session token -------------------------------------------------
function sign(payload: string): string {
  return createHmac("sha256", config.authSecret).update(payload).digest("base64url");
}

function makeToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const { userId } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof userId === "string" ? userId : null;
  } catch {
    return null;
  }
}

// ---- session API ----------------------------------------------------------
export async function createSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({ email: email.toLowerCase().trim(), name: name.trim() || "New user", passwordHash: hashPassword(password) })
    .returning();
  await createSession(user.id);
  return user;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  await createSession(user.id);
  return user;
}

/** The current user, or the demo user as a dev fallback, or null. */
export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const userId = readToken(jar.get(COOKIE)?.value);
  if (userId) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (user) return user;
  }
  if (autologin) {
    const [demo] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
    if (demo) return demo;
  }
  return null;
}

export { DEMO_EMAIL };
