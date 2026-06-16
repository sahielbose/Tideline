"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { exportDataAction } from "@/app/actions";
import { showToast } from "@/components/toast";

export function ExportButton() {
  const [pending, start] = useTransition();
  const onClick = () =>
    start(async () => {
      const json = await exportDataAction();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tideline-export.json";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported your data");
    });
  return (
    <button className="btn btn-light" onClick={onClick} disabled={pending}>
      <Download /> {pending ? "Exporting…" : "Export my data"}
    </button>
  );
}
