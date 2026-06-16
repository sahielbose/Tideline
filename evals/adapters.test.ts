import { describe, it, expect } from "vitest";
import { parseFhirBundle, parseWearableFile } from "../lib/adapters/file";
import { heuristicLabFromText } from "../lib/adapters/pdf";
import { markerStatus, optimalFor } from "../lib/lab-reference";
import { explainLab, type LabPanelInput } from "../lib/services/ai";

const FHIR = JSON.stringify({
  resourceType: "Bundle",
  entry: [
    { resource: { resourceType: "Condition", code: { text: "Asthma" }, clinicalStatus: { coding: [{ code: "active" }] }, onsetDateTime: "2020-01-01" } },
    { resource: { resourceType: "Encounter", type: [{ text: "Checkup" }], period: { start: "2025-01-01" } } },
    { resource: { resourceType: "Observation", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ code: "8480-6", display: "Systolic" }] }, valueQuantity: { value: 130, unit: "mmHg" }, effectiveDateTime: "2025-01-01" } },
  ],
});

describe("FHIR bundle parser", () => {
  it("maps resources to normalized records and LOINC vitals to metric codes", () => {
    const out = parseFhirBundle(FHIR);
    expect(out.find((r) => r.category === "condition")?.display).toBe("Asthma");
    expect(out.find((r) => r.category === "encounter")).toBeTruthy();
    const bp = out.find((r) => r.code === "bp_systolic");
    expect(bp?.value).toBe(130);
  });
});

describe("wearable CSV parser", () => {
  it("parses date,metric,value rows into metric points and skips unknown metrics", () => {
    const csv = "date,metric,value\n2026-06-01,rhr,60\n2026-06-02,rhr,62\n2026-06-02,bogus,99";
    const pts = parseWearableFile("w.csv", csv);
    expect(pts.length).toBe(2);
    expect(pts.every((p) => p.code === "rhr")).toBe(true);
  });

  it("parses Apple Health export XML records into mapped metric points", () => {
    const xml =
      '<HealthData><Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" value="61" startDate="2026-06-01 08:00:00 -0700"/>' +
      '<Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="8000" startDate="2026-06-01 23:00:00 -0700"/>' +
      '<Record type="HKQuantityTypeIdentifierUnknownThing" unit="x" value="1" startDate="2026-06-01 08:00:00 -0700"/></HealthData>';
    const pts = parseWearableFile("export.xml", xml);
    const codes = pts.map((p) => p.code).sort();
    expect(codes).toEqual(["rhr", "steps"]);
    expect(pts.find((p) => p.code === "rhr")?.value).toBe(61);
  });
});

describe("lab PDF heuristic parser", () => {
  it("extracts markers from tabular text", () => {
    const text = "Comprehensive panel\nLDL cholesterol 132 mg/dL 0-100\nHDL cholesterol 58 mg/dL 40-120\nGlucose 96 mg/dL 70-99\nPage 1 of 2";
    const panel = heuristicLabFromText("report.pdf", text);
    const ldl = panel.markers.find((m) => /ldl/i.test(m.display));
    expect(ldl?.value).toBe(132);
    expect(panel.markers.length).toBeGreaterThanOrEqual(3);
    // page footer is not a marker
    expect(panel.markers.some((m) => /page/i.test(m.display))).toBe(false);
  });
});

describe("optimal range status", () => {
  it("distinguishes optimal vs in-range-suboptimal vs out-of-range", () => {
    const ldl = optimalFor("ldl", "LDL cholesterol");
    expect(markerStatus(70, 0, 100, ldl?.low, ldl?.high)).toBe("optimal");
    const g = optimalFor("glucose-fasting", "Fasting glucose");
    expect(markerStatus(96, 70, 99, g?.low, g?.high)).toBe("suboptimal");
    expect(markerStatus(132, 0, 100, ldl?.low, ldl?.high)).toBe("high");
  });
});

describe("lab explainer — optimal awareness (keyless)", () => {
  it("notes a suboptimal marker", async () => {
    const panel: LabPanelInput = {
      panelName: "Metabolic",
      collectedAt: "2026-06-14",
      markers: [{ code: "glucose-fasting", display: "Fasting glucose", value: 96, unit: "mg/dL", refLow: 70, refHigh: 99 }],
    };
    const md = await explainLab(panel);
    expect(md.toLowerCase()).toMatch(/optimal/);
    expect(md.toLowerCase()).toContain("not a diagnosis");
  });
});
