/**
 * Medication tracking (CONTEXT.md §4.7). Tracking + information ONLY. Never
 * prescribe, never recommend dosage changes as instructions.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { medications, type Medication } from "../db/schema";
import { hasLLM } from "../config";
import { getProvider } from "./ai/provider";
import { logAction } from "./audit";

export async function listMedications(userId: string): Promise<Medication[]> {
  return db
    .select()
    .from(medications)
    .where(eq(medications.userId, userId))
    .orderBy(desc(medications.active), medications.name);
}

export async function addMedication(
  userId: string,
  input: { name: string; dose?: string; schedule?: string; startedAt?: Date; notes?: string },
): Promise<Medication> {
  const [row] = await db
    .insert(medications)
    .values({
      userId,
      name: input.name,
      dose: input.dose,
      schedule: input.schedule,
      startedAt: input.startedAt,
      notes: input.notes,
      active: true,
    })
    .returning();
  await logAction(userId, "medication.add", { name: input.name });
  return row;
}

export async function updateMedication(
  id: string,
  patch: Partial<{ dose: string; schedule: string; active: boolean; notes: string }>,
): Promise<void> {
  const [med] = await db.select().from(medications).where(eq(medications.id, id));
  if (!med) throw new Error("Medication not found");
  await db.update(medications).set(patch).where(eq(medications.id, id));
  await logAction(med.userId, "medication.update", { id });
}

/** Informational only — general info + a reference, never dosing instructions. */
export async function medicationInfo(name: string): Promise<string> {
  const safety =
    "This is general information, not medical advice. Always follow the directions on your label and from the clinician who prescribed it, and ask a pharmacist about interactions with your other medications.";
  if (!hasLLM) {
    return `**${name}** — general information.\n\nMedications can interact with other drugs, supplements, food, and existing conditions. ${safety}`;
  }
  try {
    const out = await getProvider().complete({
      system:
        "You provide brief, general, non-prescriptive medication information for a layperson. Never give dosing instructions or tell the user to start/stop/change a medication. Always recommend confirming with a pharmacist or clinician. Be honest about uncertainty.",
      messages: [
        { role: "user", content: `Give a short, general overview of ${name}: what it's commonly used for and common interaction categories to be aware of. Do not give dosing.` },
      ],
      maxTokens: 400,
    });
    return `${out.trim()}\n\n${safety}`;
  } catch {
    return `**${name}** — general information.\n\n${safety}`;
  }
}
