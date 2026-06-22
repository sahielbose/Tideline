"use client";

/**
 * Manual reading entry. The user picks a metric, types a value (or a systolic/
 * diastolic pair for blood pressure) and a time, and it lands on the
 * observations spine via logReadingAction. No mock data involved.
 */
import { useMemo, useState, useTransition } from "react";
import { Activity } from "lucide-react";
import { showToast } from "@/components/toast";
import { logReadingAction } from "@/app/actions";

export interface MetricOption {
  key: string;
  display: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "11px 13px",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13.5,
  fontWeight: 550,
  color: "var(--ink)",
};

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const BP_OPTION: MetricOption = {
  key: "bp",
  display: "Blood pressure",
  unit: "mmHg",
  refLow: null,
  refHigh: null,
};

export function LogReadingForm({ metrics }: { metrics: MetricOption[] }) {
  const options = useMemo(() => {
    // Insert combined BP right after the heart-rate metrics for a natural order.
    const list = [...metrics];
    return [BP_OPTION, ...list];
  }, [metrics]);

  const [metric, setMetric] = useState(options[0]?.key ?? "rhr");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [at, setAt] = useState(nowLocal);
  const [pending, start] = useTransition();

  const selected = options.find((o) => o.key === metric);
  const isBp = metric === "bp";

  const refHint =
    selected && (selected.refLow != null || selected.refHigh != null)
      ? `typical ${selected.refLow ?? "–"}–${selected.refHigh ?? "–"} ${selected.unit}`
      : selected
        ? selected.unit
        : "";

  const canSubmit = isBp ? value.trim() !== "" || value2.trim() !== "" : value.trim() !== "";

  const submit = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("metric", metric);
      fd.set("value", value);
      if (isBp) fd.set("value2", value2);
      fd.set("at", at);
      await logReadingAction(fd);
      setValue("");
      setValue2("");
      showToast("Reading logged");
    });

  return (
    <div className="box" style={{ marginBottom: 20 }}>
      <div className="bhead">
        <span>
          <Activity style={{ verticalAlign: "-3px", marginRight: 8 }} size={16} />
          Log a reading
        </span>
      </div>
      <div className="ins" style={{ borderBottom: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label style={labelStyle}>
            Metric
            <select
              style={inputStyle}
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value);
                setValue("");
                setValue2("");
              }}
            >
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.display}
                </option>
              ))}
            </select>
          </label>

          {isBp ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={labelStyle}>
                Systolic
                <input
                  style={inputStyle}
                  type="number"
                  inputMode="decimal"
                  placeholder="120"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <label style={labelStyle}>
                Diastolic
                <input
                  style={inputStyle}
                  type="number"
                  inputMode="decimal"
                  placeholder="80"
                  value={value2}
                  onChange={(e) => setValue2(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <label style={labelStyle}>
              Value{selected ? ` (${selected.unit})` : ""}
              <input
                style={inputStyle}
                type="number"
                inputMode="decimal"
                step="any"
                placeholder={refHint}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <label style={labelStyle}>
            When
            <input
              style={inputStyle}
              type="datetime-local"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn btn-primary" onClick={submit} disabled={pending || !canSubmit}>
              {pending ? "Saving…" : "Log reading"}
            </button>
          </div>
        </div>

        {!isBp && refHint && selected && (selected.refLow != null || selected.refHigh != null) && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            {selected.display}: {refHint}.
          </p>
        )}
      </div>
    </div>
  );
}
