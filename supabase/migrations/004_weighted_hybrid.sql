-- ============================================================
-- Migration 004: Gewogen Hybrid Search (semantic-first RRF)
-- Run this in the Supabase SQL Editor AFTER migration 003
--
-- Wijziging t.o.v. 002: De hybride RRF-score gebruikt nu
-- asymmetrische k-waarden zodat semantic ~3x zwaarder weegt:
--   semantic_k = 20  → hogere scores per rank
--   keyword_k  = 60  → lagere scores per rank
--
-- Bovendien worden beide raw similarity-scores teruggegeven
-- zodat de TypeScript-laag een semantic-first drempel kan
-- toepassen (semantic_score >= threshold → skip keyword mix).
-- ============================================================

create or replace function hybrid_search(
  query_text        text,
  query_embedding   vector(1536),
  match_count       int   default 5,
  rrf_k             int   default 60,
  semantic_rrf_k    int   default 20   -- lager = semantic zwaarder
)
returns table (
  chunk_id          uuid,
  document_id       uuid,
  title             text,
  filename          text,
  chunk_content     text,
  chunk_index       integer,
  similarity        float,
  semantic_score    float,   -- ruwe cosine similarity (0-1)
  doc_metadata      jsonb,
  chunk_metadata    jsonb
)
language sql stable
as $$
with

-- ── Semantic kandidaten (top-30 voor betere dekking) ──────
sem_raw as (
  select
    dc.id,
    1 - (dc.embedding <=> query_embedding) as score
  from document_chunks dc
  where dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit 30
),
sem as (
  select id, score, row_number() over (order by score desc) as rn
  from sem_raw
),

-- ── Full-text kandidaten (top-30) ─────────────────────────
fts_raw as (
  select
    dc.id,
    ts_rank_cd(dc.fts, websearch_to_tsquery('simple', query_text)) as score
  from document_chunks dc
  where dc.fts is not null
    and dc.fts @@ websearch_to_tsquery('simple', query_text)
  order by score desc
  limit 30
),
fts as (
  select id, row_number() over (order by score desc) as rn
  from fts_raw
),

-- ── Gewogen RRF: semantic_rrf_k < rrf_k → semantic zwaarder ──
rrf as (
  select
    coalesce(sem.id, fts.id) as id,
    -- Semantic bijdrage: lage k = hogere score = meer gewicht
    coalesce(1.0 / (semantic_rrf_k + sem.rn), 0.0)
    -- Keyword bijdrage: standaard k = minder gewicht
    + coalesce(1.0 / (rrf_k + fts.rn), 0.0)        as rrf_score,
    coalesce(sem.score, 0.0)                         as sem_score
  from sem
  full outer join fts on sem.id = fts.id
)

select
  dc.id           as chunk_id,
  dc.document_id,
  d.title,
  d.filename,
  dc.content      as chunk_content,
  dc.chunk_index,
  rrf.rrf_score   as similarity,
  rrf.sem_score   as semantic_score,
  d.metadata      as doc_metadata,
  dc.metadata     as chunk_metadata
from rrf
join document_chunks dc on dc.id = rrf.id
join documents       d  on d.id  = dc.document_id
order by rrf.rrf_score desc
limit match_count;
$$;
