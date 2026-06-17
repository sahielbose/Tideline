import { NotebookPen, Info, Smile } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listEntries } from "@/lib/services/journal";
import { SubmitButton } from "@/components/submit-button";
import { MoodPicker } from "@/components/journal/mood-picker";
import { addEntryAction } from "@/app/(app)/app/journal/actions";
import { timeAgo } from "@/lib/utils";

const MOOD_LABEL: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

const MOOD_CHIP: Record<number, string> = {
  1: "urgent",
  2: "elev",
  3: "watch",
  4: "info",
  5: "ok",
};

export default async function JournalPage() {
  const user = await getSessionUser();
  const entries = await listEntries(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Symptom journal</h1>
          <p className="sub">A quick daily check-in for how you feel and any symptoms.</p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 4, marginBottom: 20 }}>
        <Info />
        <span>
          This is a personal log to help you notice patterns over time. It is not a diagnosis and is
          not a substitute for advice from your own healthcare provider.
        </span>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
        <div className="box">
          <div className="bhead">Today&apos;s check-in</div>
          <form action={addEntryAction} className="auth-form" style={{ padding: 18 }}>
            <label>
              How are you feeling?
              <MoodPicker />
            </label>
            <label>
              Symptoms
              <input name="symptoms" type="text" placeholder="e.g. headache, fatigue" />
            </label>
            <label>
              Note
              <input name="note" type="text" placeholder="Anything else worth noting" />
            </label>
            <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
              Save check-in
            </SubmitButton>
          </form>
        </div>

        <div className="box">
          <div className="bhead">Past check-ins</div>
          {entries.length === 0 ? (
            <div className="ins">
              <p>No check-ins yet. Save your first one to start tracking how you feel.</p>
            </div>
          ) : (
            entries.map((e) => {
              const moodCls = e.mood != null ? MOOD_CHIP[e.mood] ?? "info" : null;
              return (
                <div
                  className="conn-item"
                  key={e.id}
                  style={{ padding: "14px 18px", alignItems: "flex-start" }}
                >
                  <span className="ic">
                    {e.mood != null ? <Smile /> : <NotebookPen />}
                  </span>
                  <div className="body">
                    <div className="n">
                      {e.day}
                      {e.symptoms ? <span className="muted"> · {e.symptoms}</span> : null}
                    </div>
                    <div className="s">{e.note || (e.symptoms ? "" : "No details")}</div>
                  </div>
                  {moodCls ? (
                    <span className={`status ${moodCls}`}>
                      <span className="dot" />
                      {MOOD_LABEL[e.mood as number] ?? "Logged"}
                    </span>
                  ) : (
                    <span className="chip" title={timeAgo(e.createdAt)}>
                      Note
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
