# Tideline

**Your always-on health companion.** Tideline turns your scattered health data
(medical records, wearables, lab results) into a single continuous timeline,
watches that timeline for concerning trends, and explains in plain English
whether something matters and what to do next.

> ⚕️ **Tideline is informational and is _not_ a licensed medical provider,
> doctor, or diagnostic service. It does not diagnose, treat, or prescribe.**
> For anything urgent or life-threatening, call your local emergency number.

Open source, MIT licensed, and **fully demoable with zero external accounts and
zero API keys** — mock adapters plus a seed script create a complete demo
account, and a deterministic rule-based AI path runs when no LLM key is present.

---

## The demo in 30 seconds

1. Open the seeded dashboard — most metrics sit near their baselines.
2. One card (**resting heart rate**) shows an **Elevated** chip and a rising
   sparkline. A hero insight explains it in plain English: RHR has drifted from
   ~58 to 71 bpm over two weeks, with falling HRV and short sleep corroborating.
3. Click into the metric for the full time-series with the personal-baseline and
   reference-range bands.
4. Open **Chat** and type a symptom — the agent reads your data, triages, and
   offers to flag for review.
5. Type an emergency symptom ("chest pain") — the **red-flag banner fires
   immediately** and the agent leads with "seek emergency care now."

This is the whole loop: continuous data → caught drift → plain-English
explanation → a path to action → responsible safety behavior.

---

## Features

- **AI doctor chat** — structured symptom intake, data-aware triage in four
  bands (self-care / clinician-soon / urgent / emergency), and a "flag for
  review" action. Streamed to the UI via a route handler.
- **Red-flag classifier** runs on *every* message, independent of the agent. It
  surfaces an emergency banner and routes self-harm to crisis resources (988).
- **Continuous monitoring / drift engine** — trend, reference-crossing,
  personal-anomaly, and cross-signal detection over your metric series, scored
  into four severity bands.
- **Insights** — each signal becomes an explained, hedged, non-diagnostic
  insight with a recommended action; elevated+ auto-opens a review flag.
- **Lab explainer** — per-marker plain-English read, out-of-range flags, and a
  hedged trend, with no invented markers.
- **Unified timeline**, metric detail charts, medication tracking + general info
  (tracking only), connection management, and a **simulated** clinician review queue.
- **Optimal / longevity ranges** on labs (the "optimal vs normal" distinction),
  an illustrative **health-index + health-age** card, a daily **readiness /
  recovery** score, **body-system rollups**, and **risk & screening** (metabolic-
  syndrome criteria, cardiometabolic band, age/sex preventive-care gaps).
- **Longitudinal biomarkers** trended across draws, a trackable **care plan**
  (tasks that auto-complete when a metric returns to baseline), **habit tags**
  with metric-impact correlation, and a printable **health report** (PDF).
- **More surfaces**: structured **symptom intake** → simulated review, a durable
  care-team **inbox**, multi-week **programs**, **trends** (rolling aggregates),
  a symptom **journal**, medication **adherence** + mock refill/appointment,
  a structured health **profile**, a **longevity** panel (illustrative CV-risk,
  percentiles, health-age methodology), and saved **report snapshots**.
- **File imports**: FHIR R4 bundles, Apple Health exports / CSV, and lab PDFs.
- **Retrieval-grounded, tool-calling chat**: the agent fetches your data and
  cites a curated reference corpus — keyword search by default, or **pgvector**
  cosine search when the optional embeddings index is built (works with zero keys).
- **Confirm-gates** on every real-world action; **data export & delete**; an
  append-only audit log; per-user ownership checks on all mutations.

---

## Architecture

A single Next.js (App Router) + TypeScript app in three layers.

```
[ Browser / UI — App Router, ported design system, Recharts ]
                 |
        server actions  +  route handlers (chat stream, webhooks)
                 |
        [ Service layer  (lib/services) ]   <- the only thing the UI calls
        /          |             |              \
[ Adapters ]  [ Drift engine ]  [ AI layer ]   [ Notifications ]
   |               (pure)         (provider       (Resend / console)
[ Records ]                        seam)
[ Wearables ]   reads/writes Postgres (Drizzle)
[ Labs ]
   |
[ Inngest jobs: monitoring sweep, ingestion, weekly digest, baselines ]
```

Key decisions:

- **Adapter seam** (`lib/adapters`) — every external data source goes behind
  `RecordsAdapter` / `BiometricsAdapter` / `LabsAdapter`, with `mock`, `file`,
  and (Phase 2) `sandbox` implementations. The UI never calls a vendor directly.
  The downstream pipeline depends only on the normalized `observations` table.
- **Typed service layer** (`lib/services`) — all business logic as verbs. Routes,
  server actions, and jobs call services; components never touch the DB.
- **Pure drift engine** (`lib/services/drift`) — pure functions over time-series,
  fully unit-tested. Tuned against *false reassurance first*: a real decline must
  never be missed. Corroboration across metric clusters escalates severity.
- **LLM provider seam** (`lib/services/ai`) — one client adapter. With an
  `LLM_API_KEY` it uses Anthropic (Claude); without one it uses deterministic,
  on-spec rule-based implementations so the app is fully functional offline. The
  red-flag classifier always runs a high-recall keyword floor, OR-merged with the
  model so recall can never regress.
- **Safety is acceptance criteria, not a footer** — see [Safety](#safety).

### Data model (Postgres + Drizzle)

`users`, `connections`, `observations` (the normalized spine), `metric_baselines`,
`reference_ranges`, `drift_signals`, `insights`, `review_flags`, `labs` +
`lab_markers`, `medications`, `chat_sessions` + `chat_messages`, `notifications`,
`audit_log`. (pgvector embeddings for retrieval-grounded chat are scoped to
Phase 3 and intentionally omitted from the initial migration.)

### Tech stack

Next.js 15 · TypeScript · Tailwind + Radix + Recharts + lucide-react · Postgres +
Drizzle · Inngest · Anthropic (optional) · Resend (optional) · Vitest.

---

## Run it locally (end to end)

**Prerequisites:** Node 20+, a running Postgres 14+ (local or Docker).

```bash
# 1. clone
git clone https://github.com/sahielbose/Tideline.git
cd Tideline

# 2. install
npm install

# 3. create the database
createdb tideline            # or: psql -c 'create database tideline;'

# 4. configure env (zero external keys needed)
cp .env.example .env.local
#   edit DATABASE_URL if your Postgres user/host differ

# 5. migrate + seed the demo account (one command)
npm run setup                # = db:migrate + seed

# 6. start the app
npm run dev                  # http://localhost:3000
```

Then open <http://localhost:3000>:

- The demo account auto-loads in development (`DEMO_AUTOLOGIN`), so **/app** shows
  the populated dashboard immediately.
- Or sign in at **/login** with `demo@tideline.app` / `tideline` (prefilled).

Optional: run the background jobs runner with `npm run inngest` (no keys needed).
The app works without it — ingestion and the monitoring sweep also run inline.

**Production notes:** set a strong `AUTH_SECRET` (there is no production
fallback), serve over **HTTPS** (session cookies are `Secure`), and leave
`DEMO_AUTOLOGIN` unset (auto-login is dev-only and off in production). The
ingestion webhook is disabled unless `INGEST_WEBHOOK_SECRET` is set.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run setup` | Migrate the DB, then seed the demo account |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run seed` | (Re)seed the demo account |
| `npm run db:embeddings` | Optional: build the pgvector retrieval index (needs pgvector) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | All Vitest tests |
| `npm run eval` | The eval suite (drift + AI guardrails + advanced logic) |
| `npm run eval:judge` | Optional LLM-as-judge suite (needs `LLM_API_KEY`) |

---

## Environment variables

Only `DATABASE_URL` is required. Everything else is optional — leave it blank to
use the mock adapters, the rule-based LLM, and console "email".

> **No env edits needed for keys.** You can also add your Anthropic (and Resend)
> API key at runtime from **Settings → Integrations** in the app. Keys entered
> there are encrypted at rest, override the env defaults, take effect on the next
> request (no restart), and include a one-click "Test connection". The env vars
> below remain a valid alternative for headless / CI deployments.

| Variable | Required | Default / effect |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | – | Session cookie signing secret (dev fallback provided) |
| `DATA_ADAPTER_DEFAULT` | – | `mock` (or `file` / `sandbox`) |
| `LLM_API_KEY` | – | Blank → deterministic rule-based AI. Set → Anthropic |
| `LLM_MODEL_AGENT` | – | `claude-sonnet-4-6` |
| `LLM_MODEL_CLASSIFIER` | – | `claude-haiku-4-5-20251001` |
| `RESEND_API_KEY` | – | Blank → notifications logged to console |
| `RESEND_FROM` | – | From address for emails |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | – | Only for hosted Inngest |
| `DEMO_AUTOLOGIN` | – | `true` in dev: `/app` loads the demo user without login |
| `RECORDS_SANDBOX_KEY` / `WEARABLES_SANDBOX_KEY` | – | Phase 2 sandbox adapters |

---

## Evals

The risky parts — the drift engine and the AI agents — are locked with Vitest
fixtures in `/evals`, run with `npm run eval`.

- **Drift:** known-positive declines are caught (the false-reassurance gate),
  noisy-but-stable series do not over-alarm, sustained vs transient reference
  crossings, cross-signal combination scoring, and baseline activation.
- **AI:** red-flag recall on emergencies (recall is the priority) with a low
  false-positive rate, crisis (self-harm) handling, the chat agent's no-diagnosis
  / no-prescription scope + triage band + emergency lead-in, and the lab
  explainer flagging out-of-range markers without inventing any.
- **Parsers + retrieval:** FHIR / Apple Health / PDF parsing, optimal-range
  status, reference retrieval, and the health-index scorer.

### Benchmark

`npm run eval` gates against [`evals/thresholds.json`](evals/thresholds.json):

| Suite | Metric | Target | Current |
|---|---|---|---|
| Drift engine | Recall (declines caught) | 100% | **100%** |
| Drift engine | False-alarm (stable series) | 0% | **0%** |
| Red-flag classifier | Recall (emergencies) | 100% | **100%** |
| Red-flag classifier | False-positive (benign) | ≤ 20% | **0%** |

43 evals across 6 suites. A regression on the recall gates blocks merge.

---

## Safety

These are tested, required behaviors (not disclaimers):

1. A not-a-provider disclosure on every app surface and in chat.
2. No diagnosis, no prescriptions, no dosing instructions from the AI.
3. The red-flag classifier runs on every message; emergencies surface a banner
   ahead of any other content.
4. Self-harm / suicidal ideation leads with crisis resources and pauses triage.
5. The drift engine is tuned against false reassurance first.
6. Confirm-gates on email opt-in, the mocked visit booking, resolving a review,
   data export, and data delete.
7. Health data stays in your own database; export and delete are first-class.
8. The clinician network is **simulated** and clearly labeled as such.

---

## Project structure

```
app/
  (marketing)/        landing (AI Doctor), public ai-doctor chat, about/privacy/terms
  (app)/app/          dashboard, timeline, metrics, insights, labs, medications,
                      chat, connections, reviews, settings
  api/chat/           chat streaming route handler
  login, signup, onboarding
  actions.ts          server actions (the mutation surface)
components/           the ported design system as React components
lib/
  services/           business-logic verbs (drift/, ai/)
  adapters/           records, wearables, labs (mock | file | sandbox)
  db/                 Drizzle schema + client
  inngest/            background job definitions
  metrics.ts          the metric registry (drives dashboard + drift tuning)
evals/                Vitest fixtures + specs
scripts/              seed, migrate, setup
drizzle/              generated migrations
```

## Roadmap

- **Phase 0 + 1 — done:** scaffold, schema, mock adapters, seed; the full working
  app (marketing, dashboard, timeline, metrics, insights, labs + explainer, chat
  with the agent + red-flag classifier, connections, reviews, settings), the
  drift engine with passing evals, the monitoring sweep wired to Inngest, and all
  safety guardrails.
- **Phase 2 — done:** file-import adapters — FHIR R4 bundle (records), Apple
  Health export XML + CSV (wearables), and lab PDF parsing (LLM-structured with a
  heuristic fallback); the `/api/inngest` jobs endpoint and an ingestion webhook
  (`/api/webhooks/ingest`); email digests/alerts via Resend (console fallback);
  key-gated sandbox adapter stubs. Downloadable sample files under
  [`public/samples/`](public/samples) let you exercise every import.
- **Phase 3 — done:** optimal / longevity lab ranges; health-index + health-age,
  daily readiness, body-system rollups, risk & screening; longitudinal
  biomarkers; trackable auto-resolving care-plan tasks; habit-tag correlation;
  printable health report; agent tool-calling; retrieval-grounded chat with an
  optional **pgvector** index (keyword fallback otherwise); a richer cross-signal
  rubric; a follow-up loop; a drift/red-flag benchmark; and an optional,
  key-gated **LLM-as-judge** eval suite (`npm run eval:judge`).

Future (needs vendor accounts/keys): real sandbox adapters
(Fasten/Terra/Junction), live Resend email + hosted Inngest, and true semantic
embeddings (Ollama/hosted) behind the existing retrieval seam.

> **Optional pgvector retrieval:** the app uses keyword retrieval by default.
> To enable vector search, ensure the `vector` extension is installable, then
> run `npm run db:embeddings`. The retrieval layer auto-detects the embeddings
> table and falls back to keyword search when it is absent — so zero-setup is
> preserved either way.

## License

MIT — see [LICENSE](./LICENSE).
