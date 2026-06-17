/**
 * Multi-week lifestyle program definitions (illustrative, non-prescriptive).
 *
 * These are general wellness protocols — gentle lifestyle steps only. They are
 * NOT medical advice, NOT a treatment plan, and NOT personalized to you. Talk to
 * a qualified clinician before changing anything about your health routine.
 */

export interface ProgramStep {
  title: string;
  detail: string;
}

export interface ProgramDef {
  key: string;
  title: string;
  /** Suggested duration in weeks (illustrative pacing only). */
  weeks: number;
  goal: string;
  steps: ProgramStep[];
}

export const PROGRAMS: ProgramDef[] = [
  {
    key: "lower-resting-hr",
    title: "Ease your resting heart rate",
    weeks: 4,
    goal:
      "Explore everyday habits that are commonly associated with a calmer resting heart rate — for general wellness only.",
    steps: [
      {
        title: "Add a daily gentle walk",
        detail:
          "Aim for an easy 10–20 minute walk on most days. Move at a pace where you can still hold a conversation.",
      },
      {
        title: "Wind down before bed",
        detail:
          "Try a screen-light, calm hour before sleep — dim lights, a book, or some slow breathing.",
      },
      {
        title: "Notice your caffeine timing",
        detail:
          "Some people find that earlier-in-the-day caffeine sits more comfortably. Observe what feels right for you.",
      },
      {
        title: "Stay gently hydrated",
        detail:
          "Sip water through the day. Dehydration is often linked with a higher resting heart rate.",
      },
      {
        title: "Reflect on the month",
        detail:
          "Look back at how the routine felt. There is no target number — this is about gentle habits, not a score.",
      },
    ],
  },
  {
    key: "better-sleep",
    title: "Build a steadier sleep routine",
    weeks: 4,
    goal:
      "Try small, consistent habits that many people associate with more restful sleep — general wellness, not treatment.",
    steps: [
      {
        title: "Pick a consistent wake time",
        detail:
          "Waking around the same time each day, including weekends, can help a routine settle in.",
      },
      {
        title: "Get morning daylight",
        detail:
          "A few minutes of natural light soon after waking is commonly linked with a steadier rhythm.",
      },
      {
        title: "Create a calm pre-sleep ritual",
        detail:
          "A short, repeatable wind-down — stretching, reading, or quiet music — can cue your body toward rest.",
      },
      {
        title: "Make the room sleep-friendly",
        detail:
          "Cool, dark, and quiet tends to help. Adjust gently to what feels comfortable for you.",
      },
      {
        title: "Review what helped",
        detail:
          "Reflect on which small changes felt good. Keep the ones that fit your life and let go of the rest.",
      },
    ],
  },
  {
    key: "metabolic-reset",
    title: "Gentle metabolic habits",
    weeks: 6,
    goal:
      "Explore balanced, sustainable everyday habits often associated with general metabolic wellbeing — not a diet or medical plan.",
    steps: [
      {
        title: "Add color to one meal",
        detail:
          "Try including more vegetables or fruit in a meal you already enjoy. Small additions, not restrictions.",
      },
      {
        title: "Take a short post-meal walk",
        detail:
          "A relaxed 5–10 minute walk after a meal is a gentle habit many people enjoy.",
      },
      {
        title: "Build a balanced plate",
        detail:
          "Combining protein, fiber, and healthy fats can help meals feel more satisfying. Adapt to your tastes.",
      },
      {
        title: "Hydrate before reaching for snacks",
        detail:
          "A glass of water and a pause can help you check in with how hungry you actually feel.",
      },
      {
        title: "Keep a steady meal rhythm",
        detail:
          "Eating at roughly consistent times can help some people feel more even through the day.",
      },
      {
        title: "Reflect without judgment",
        detail:
          "Notice what felt sustainable. Lasting habits are kind and flexible, never punishing.",
      },
    ],
  },
];

/** Lookup helper used by the service layer. */
export function getProgramDef(key: string): ProgramDef | undefined {
  return PROGRAMS.find((p) => p.key === key);
}
