/**
 * Ingestion webhook (CONTEXT.md §5: "route handlers under /app/api/* for
 * webhooks, e.g. ingestion callbacks"). A sandbox provider (or your own
 * pipeline) POSTs normalized files here; we import them and run a sweep.
 *
 * Secured by the x-tideline-secret header when INGEST_WEBHOOK_SECRET is set.
 * Body: { userId, kind: "records"|"wearable"|"lab", filename?, content }
 */
import { NextRequest } from "next/server";
import { config } from "@/lib/config";
import { importFile, ingestLab, runMonitoringSweep } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (config.webhookSecret) {
    if (req.headers.get("x-tideline-secret") !== config.webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: { userId?: string; kind?: string; filename?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { userId, kind, filename, content } = body;
  if (!userId || !kind || !content) {
    return new Response("Missing userId, kind, or content", { status: 400 });
  }

  try {
    if (kind === "lab") {
      await ingestLab(userId, { kind: "file", filename: filename ?? "lab.json", content });
    } else if (kind === "records" || kind === "wearable") {
      await importFile(userId, kind, { filename: filename ?? `${kind}.data`, content });
    } else {
      return new Response(`Unsupported kind: ${kind}`, { status: 400 });
    }
    await runMonitoringSweep(userId);
  } catch (e) {
    return new Response(`Ingestion failed: ${String(e)}`, { status: 422 });
  }

  return Response.json({ ok: true });
}
