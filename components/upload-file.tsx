"use client";

import { Upload } from "lucide-react";
import { showToast } from "@/components/toast";

/** Generic file-import button: auto-submits the bound server action on select. */
export function UploadFile({
  action,
  accept,
  label = "Choose a file",
  toast = "Importing…",
}: {
  action: (fd: FormData) => Promise<void> | void;
  accept: string;
  label?: string;
  toast?: string;
}) {
  return (
    <form action={action} onSubmit={() => showToast(toast)} className="upload-lab">
      <label className="btn btn-light" style={{ cursor: "pointer" }}>
        <Upload /> {label}
        <input
          type="file"
          name="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
    </form>
  );
}
