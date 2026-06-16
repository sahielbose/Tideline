"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, ArrowUp } from "lucide-react";

/** Hero "start a free consult" box: routes into the chat with the prefilled ask. */
export function HeroConsult({
  placeholder = "Tell me about your symptoms or health concerns…",
  cta = "Start a free consult",
}: {
  placeholder?: string;
  cta?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = () => {
    const q = value.trim();
    router.push(q ? `/app/chat?ask=${encodeURIComponent(q)}` : "/app/chat");
  };

  return (
    <div className="consult">
      <div className="field">
        <Lock />
        <input
          type="text"
          placeholder={placeholder}
          aria-label="Describe your symptoms"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
      </div>
      <div className="row">
        <button className="btn btn-primary" onClick={go}>
          {cta}
          <ArrowUp />
        </button>
      </div>
    </div>
  );
}
