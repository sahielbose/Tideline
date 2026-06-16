"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn btn-primary no-print" onClick={() => window.print()}>
      <Printer /> Print / Save as PDF
    </button>
  );
}
