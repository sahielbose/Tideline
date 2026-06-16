/**
 * Optional: build the pgvector embeddings index for retrieval-grounded chat
 * (CONTEXT.md §9 searchReference, §18 Phase 3).
 *
 *   npm run db:embeddings
 *
 * Safe to skip — when the `embeddings` table is absent the app falls back to
 * keyword retrieval. Requires the pgvector extension to be installable.
 */
import "./env";
import { sql } from "../lib/db/client";
import { REFERENCE_CORPUS } from "../lib/services/reference";
import { embed, EMBEDDING_DIM } from "../lib/services/embedder";

async function main() {
  const avail = await sql`select 1 from pg_available_extensions where name = 'vector'`;
  if (!avail.length) {
    console.log("pgvector is not available on this Postgres — skipping. (Keyword retrieval is used.)");
    await sql.end();
    return;
  }
  await sql`create extension if not exists vector`;
  await sql.unsafe(`
    create table if not exists embeddings (
      id uuid primary key default gen_random_uuid(),
      kind text not null,
      ref_id text not null,
      title text not null,
      content text not null,
      embedding vector(${EMBEDDING_DIM}) not null,
      created_at timestamptz not null default now()
    )
  `);
  await sql`delete from embeddings where kind = 'reference'`;
  for (const d of REFERENCE_CORPUS) {
    const e = JSON.stringify(await embed(`${d.title}. ${d.tags.join(" ")}. ${d.text}`));
    await sql`insert into embeddings (kind, ref_id, title, content, embedding)
      values ('reference', ${d.id}, ${d.title}, ${d.text}, ${e}::vector)`;
  }
  await sql`create index if not exists embeddings_vec_idx on embeddings using hnsw (embedding vector_cosine_ops)`;
  console.log(`Embedded ${REFERENCE_CORPUS.length} reference docs into pgvector (dim ${EMBEDDING_DIM}).`);
  await sql.end();
}

main().catch((err) => {
  console.error("Embeddings build failed:", err);
  process.exit(1);
});
