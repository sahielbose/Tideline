/**
 * Minimal, dependency-free .env loader for standalone scripts (migrate, seed).
 * Next.js loads .env.local automatically for the app; scripts do not, so we
 * import this module first. Existing process.env values always win.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function load(file: string) {
  const p = resolve(process.cwd(), file);
  if (!existsSync(p)) return;
  const txt = readFileSync(p, "utf8");
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

load(".env.local");
load(".env");
