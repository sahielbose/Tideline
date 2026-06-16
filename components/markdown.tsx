/**
 * Minimal, safe markdown renderer for AI-generated explanations + reviewer
 * notes. Escapes HTML first, then applies a tiny subset (bold, italic, headings,
 * bullet lists). Content is server-side (our templates or the LLM behind our
 * prompts), and escaping guards against injected markup.
 */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

export function Markdown({ content, className = "md" }: { content: string; className?: string }) {
  const blocks = content.trim().split(/\n{2,}/);
  const html = blocks
    .map((b) => {
      const lines = b.split("\n");
      if (lines.length && lines.every((l) => l.startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
      }
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
      if (b.startsWith("### ")) return `<h3>${inline(b.slice(4))}</h3>`;
      return `<p>${lines.map(inline).join("<br/>")}</p>`;
    })
    .join("");
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
