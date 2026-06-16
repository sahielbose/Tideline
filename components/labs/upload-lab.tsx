"use client";

import { Upload } from "lucide-react";
import { importLabAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { showToast } from "@/components/toast";

/** Lab file import (JSON/CSV in Phase 1; PDF parsing arrives in Phase 2). */
export function UploadLab() {
  return (
    <form
      action={importLabAction}
      onSubmit={() => showToast("Importing lab…")}
      className="upload-lab"
    >
      <label className="btn btn-light" style={{ cursor: "pointer" }}>
        <Upload /> Choose a file
        <input
          type="file"
          name="file"
          accept=".json,.csv,.pdf,application/json,text/csv,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
      <SubmitButton className="btn btn-primary" pendingLabel="Importing…">
        Import
      </SubmitButton>
    </form>
  );
}
