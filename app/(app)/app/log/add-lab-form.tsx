"use client";

/**
 * Manual lab panel entry. Type a panel name + date and one row per marker
 * (name, value, unit, optional reference range). Submits to addManualLabAction,
 * which stores the panel and runs the marker-by-marker explainer.
 */
import { useState, useTransition } from "react";
import { FlaskConical, Plus, X } from "lucide-react";
import { showToast } from "@/components/toast";
import { addManualLabAction } from "@/app/actions";

interface MarkerRow {
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

const emptyRow = (): MarkerRow => ({ name: "", value: "", unit: "", refLow: "", refHigh: "" });

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 14.5,
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

function today(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function AddLabForm() {
  const [panelName, setPanelName] = useState("");
  const [collectedAt, setCollectedAt] = useState(today);
  const [rows, setRows] = useState<MarkerRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<MarkerRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const filled = rows.filter((r) => r.name.trim() && r.value.trim() !== "" && Number.isFinite(Number(r.value)));
  const canSubmit = filled.length > 0;

  const submit = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("panelName", panelName.trim() || "Lab panel");
      fd.set("collectedAt", collectedAt);
      for (const r of filled) {
        fd.append("mname", r.name.trim());
        fd.append("mvalue", r.value);
        fd.append("munit", r.unit.trim());
        fd.append("mreflow", r.refLow);
        fd.append("mrefhigh", r.refHigh);
      }
      await addManualLabAction(fd);
      setPanelName("");
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      showToast(`Saved ${filled.length} marker${filled.length === 1 ? "" : "s"}`);
    });

  return (
    <div className="box" style={{ marginBottom: 20 }}>
      <div className="bhead">
        <span>
          <FlaskConical style={{ verticalAlign: "-3px", marginRight: 8 }} size={16} />
          Add a lab panel
        </span>
      </div>
      <div className="ins" style={{ borderBottom: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label style={labelStyle}>
            Panel name
            <input
              style={inputStyle}
              placeholder="e.g. Lipid panel, CMP, CBC"
              value={panelName}
              onChange={(e) => setPanelName(e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Collected
            <input
              style={inputStyle}
              type="date"
              value={collectedAt}
              onChange={(e) => setCollectedAt(e.target.value)}
            />
          </label>
        </div>

        <div style={{ marginTop: 18, fontSize: 13.5, fontWeight: 550, marginBottom: 8 }}>Markers</div>
        <div
          className="muted"
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 28px", gap: 8, fontSize: 11.5, marginBottom: 6 }}
        >
          <span>Marker</span>
          <span>Value</span>
          <span>Unit</span>
          <span>Ref low</span>
          <span>Ref high</span>
          <span />
        </div>

        {rows.map((r, i) => (
          <div
            key={i}
            style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 28px", gap: 8, marginBottom: 8, alignItems: "center" }}
          >
            <input style={inputStyle} placeholder="LDL cholesterol" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
            <input style={inputStyle} type="number" inputMode="decimal" step="any" placeholder="130" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
            <input style={inputStyle} placeholder="mg/dL" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} />
            <input style={inputStyle} type="number" inputMode="decimal" step="any" placeholder="0" value={r.refLow} onChange={(e) => update(i, { refLow: e.target.value })} />
            <input style={inputStyle} type="number" inputMode="decimal" step="any" placeholder="100" value={r.refHigh} onChange={(e) => update(i, { refHigh: e.target.value })} />
            <button
              type="button"
              aria-label="Remove marker"
              onClick={() => removeRow(i)}
              className="btn btn-light"
              style={{ padding: 6, minWidth: 0, height: 34, width: 28, display: "grid", placeItems: "center" }}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <div className="acts" style={{ gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="btn btn-light" onClick={addRow}>
            <Plus size={15} /> Add marker
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={pending || !canSubmit}>
            {pending ? "Saving…" : "Save panel"}
          </button>
        </div>

        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
          Reference ranges are optional — leave them blank and Tideline uses its built-in ranges
          where it knows the marker.
        </p>
      </div>
    </div>
  );
}
