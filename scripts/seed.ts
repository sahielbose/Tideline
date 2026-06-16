/**
 * Seed a fully populated demo account so Tideline is demoable with zero external
 * accounts and zero API keys (CONTEXT.md §0.10, §18 Phase 0). Idempotent: it
 * resets the demo user each run.
 *
 *   npm run seed
 */
import "./env";
import { eq } from "drizzle-orm";
import { db, sql } from "../lib/db/client";
import { users, referenceRanges, habitTags } from "../lib/db/schema";
import { hashPassword } from "../lib/password";
import { METRICS } from "../lib/metrics";
import { MOCK_MEDICATIONS } from "../lib/adapters/mock";
import {
  connectSource,
  ingestLab,
  addMedication,
  runMonitoringSweep,
  startChat,
  getHeroInsight,
  listInsights,
  listReviewFlags,
} from "../lib/services";

const DEMO_EMAIL = "demo@tideline.app";
const DEMO_PASSWORD = "tideline";

async function seedReferenceRanges() {
  await db.delete(referenceRanges);
  const rows = Object.values(METRICS).map((m) => ({
    metric: m.key,
    low: m.refLow,
    high: m.refHigh,
    unit: m.unit,
    context: { concern: m.concern },
  }));
  await db.insert(referenceRanges).values(rows);
}

export async function seed() {
  console.log("Seeding Tideline demo account…");
  await seedReferenceRanges();

  // Reset the demo user (FK cascade clears all dependent rows).
  await db.delete(users).where(eq(users.email, DEMO_EMAIL));
  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      name: "Devon Hale",
      passwordHash: hashPassword(DEMO_PASSWORD),
      dob: "1987-04-12",
      sexAssigned: "female",
      unitsPref: "imperial",
      notifyOptIn: false,
    })
    .returning();
  console.log(`  • user ${user.email}`);

  // Ingest data through the mock adapters.
  await connectSource(user.id, "records", "mock");
  console.log("  • connected medical records (mock)");
  await connectSource(user.id, "wearable", "mock");
  console.log("  • connected wearable + biometric series (mock)");
  const labs = await ingestLab(user.id, { kind: "mock" });
  console.log(`  • ingested ${labs.length} lab panels`);

  for (const m of MOCK_MEDICATIONS) {
    await addMedication(user.id, {
      name: m.name,
      dose: m.dose,
      schedule: m.schedule,
      startedAt: new Date(Date.now() - m.startedDaysAgo * 864e5),
      notes: m.notes,
    });
  }
  console.log(`  • added ${MOCK_MEDICATIONS.length} medications`);

  // Habit tags: a recent poor-sleep stretch (tracks with the RHR/HRV drift)
  // and older workout days, so correlations have signal.
  const day = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  const tagRows: { userId: string; tag: string; day: string }[] = [];
  for (const d of [0, 1, 3, 4, 6, 8, 10, 12, 13]) tagRows.push({ userId: user.id, tag: "Poor sleep", day: day(d) });
  for (const d of [2, 5, 9]) tagRows.push({ userId: user.id, tag: "Alcohol", day: day(d) });
  for (const d of [1, 4, 7]) tagRows.push({ userId: user.id, tag: "Late caffeine", day: day(d) });
  for (const d of [40, 43, 46, 49, 52, 55]) tagRows.push({ userId: user.id, tag: "Workout", day: day(d) });
  await db.insert(habitTags).values(tagRows);
  console.log(`  • logged ${tagRows.length} habit tags`);

  // Run the monitoring sweep → drift signals, insights, review flag, notification.
  const sweep = await runMonitoringSweep(user.id, { autoEscalate: true });
  console.log(
    `  • monitoring sweep: ${sweep.signals} signals, ${sweep.insightsCreated} insights, ${sweep.reviewFlags} review flag(s)`,
  );

  await startChat(user.id);

  const hero = await getHeroInsight(user.id);
  const insights = await listInsights(user.id);
  const flags = await listReviewFlags(user.id);
  console.log("\nDemo account ready:");
  console.log(`  login:    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  insights: ${insights.length} (hero: ${hero?.title ?? "none"} [${hero?.severity ?? "-"}])`);
  console.log(`  reviews:  ${flags.length} open`);
  console.log(`  digest:   ${sweep.digest}`);
}

seed()
  .then(async () => {
    await sql.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await sql.end().catch(() => {});
    process.exit(1);
  });
