/**
 * Structured health profile (informational only). Reads and writes the
 * `users.profile` jsonb blob — conditions, allergies, family history, goals,
 * and an optional height. Nothing here is diagnostic: it is plain context the
 * user chooses to record about themselves. Every function is scoped by userId
 * and mutations verify ownership before writing.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { logAction } from "./audit";

/** The structured shape stored under `users.profile`. */
export interface HealthProfile {
  conditions: string[];
  allergies: string[];
  familyHistory: string[];
  goals: string[];
  heightCm?: number;
}

/** Coerce an unknown jsonb value into a defined string[] (drops blanks). */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter((s) => s.length > 0);
}

/** Normalize the raw jsonb blob into a complete, well-typed HealthProfile. */
export function normalizeProfile(raw: Record<string, unknown> | null | undefined): HealthProfile {
  const r = raw ?? {};
  const heightRaw = r.heightCm;
  const heightCm =
    typeof heightRaw === "number" && Number.isFinite(heightRaw) && heightRaw > 0
      ? heightRaw
      : undefined;
  return {
    conditions: toStringList(r.conditions),
    allergies: toStringList(r.allergies),
    familyHistory: toStringList(r.familyHistory),
    goals: toStringList(r.goals),
    ...(heightCm !== undefined ? { heightCm } : {}),
  };
}

/** Current structured profile for the user (empty-safe). */
export async function getProfile(userId: string): Promise<HealthProfile> {
  const [row] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, userId));
  if (!row) return normalizeProfile(null);
  return normalizeProfile(row.profile);
}

/** Merge `patch` into the stored profile and persist. Ownership-scoped. */
export async function updateProfile(
  userId: string,
  patch: Partial<HealthProfile>,
): Promise<HealthProfile> {
  // Verify ownership and read the current blob before writing.
  const [row] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, userId));
  if (!row) throw new Error("User not found");

  const current = normalizeProfile(row.profile);
  const merged = normalizeProfile({ ...current, ...patch });

  const blob: Record<string, unknown> = {
    conditions: merged.conditions,
    allergies: merged.allergies,
    familyHistory: merged.familyHistory,
    goals: merged.goals,
    ...(merged.heightCm !== undefined ? { heightCm: merged.heightCm } : {}),
  };

  await db.update(users).set({ profile: blob }).where(eq(users.id, userId));
  await logAction(userId, "profile.update", { keys: Object.keys(patch) });
  return merged;
}
