"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/** Fire a toast from anywhere (client). Mirrors the prototype's showToast(). */
export function showToast(message: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tideline:toast", { detail: message }));
  }
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2200);
    };
    window.addEventListener("tideline:toast", handler);
    return () => {
      window.removeEventListener("tideline:toast", handler);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`toast ${msg ? "show" : ""}`} role="status" aria-live="polite">
      <Check />
      <span>{msg}</span>
    </div>
  );
}
