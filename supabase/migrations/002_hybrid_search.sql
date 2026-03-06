-- ============================================================
-- Migration 002: Hybrid Search (FTS + Vector via RRF)
-- Run this in the Supabase SQL Editor AFTER migration 001
-- ============================================================

-- 1. Add full-text search column to document_chunks
alter table document_chunks
  add column if not exists fts tsvector;

-- 2. Populate for existing rows
update document_chunks
  set fts = to_tsvector('simple', content)
  where fts is null;

-- 3. GIN index for fast FTS
create index if not exists document_chunks_fts_idx
  on document_chunks using gin(fts);

-- 4. Auto-update trigger so new chunks always have fts populated
create or replace function document_chunks_fts_trigger()
returns trigger language plpgsql as $$
begin
  new.fts := to_tsvector('simple', new.content);
  return new;
end;
$$;

drop trigger if exists tsvector_update on document_chunks;
create trigger tsvector_update
  before insert or update of content
  on document_chunks
  for each row
  execute function document_chunks_fts_trigger();

-- ============================================================
-- 5. hybrid_search: Reciprocal Rank Fusion of semantic + FTS
-- ============================================================
-- RRF score = 1/(k + rank_semantic) + 1/(k + rank_fts)
-- k=60 is the standard; higher k dampens outlier ranks.
-- Falls back gracefully: if query has no FTS matches, only
-- semantic ranks contribute; if no semantic match, only FTS.
-- ============================================================

create or replace function hybrid_search(
  query_text    text,
  query_embedding vector(1536),
  match_count   int  default 5,
  rrf_k         int  default 60
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  title         text,
  filename      text,
  chunk_content text,
  chunk_index   integer,
  similarity    float,
  doc_metadata  jsonb,
  chunk_metadata jsonb
)
language sql stable
as $$
with

-- ── Semantic candidates (top-20) ──────────────────────────
sem_raw as (
  select
    dc.id,
    1 - (dc.embedding <=> query_embedding) as score
  from document_chunks dc
  where dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit 20
),
sem as (
  select id, row_number() over (order by score desc) as rn
  from sem_raw
),

-- ── Full-text candidates (top-20) ─────────────────────────
fts_raw as (
  select
    dc.id,
    ts_rank_cd(dc.fts, websearch_to_tsquery('simple', query_text)) as score
  from document_chunks dc
  where dc.fts is not null
    and dc.fts @@ websearch_to_tsquery('simple', query_text)
  order by score desc
  limit 20
),
fts as (
  select id, row_number() over (order by score desc) as rn
  from fts_raw
),

-- ── Reciprocal Rank Fusion ────────────────────────────────
rrf as (
  select
    coalesce(sem.id, fts.id) as id,
    coalesce(1.0 / (rrf_k + sem.rn), 0.0)
      + coalesce(1.0 / (rrf_k + fts.rn), 0.0) as rrf_score
  from sem
  full outer join fts on sem.id = fts.id
)

select
  dc.id         as chunk_id,
  dc.document_id,
  d.title,
  d.filename,
  dc.content    as chunk_content,
  dc.chunk_index,
  rrf.rrf_score as similarity,
  d.metadata    as doc_metadata,
  dc.metadata   as chunk_metadata
from rrf
join document_chunks dc on dc.id = rrf.id
join documents       d  on d.id  = dc.document_id
order by rrf.rrf_score desc
limit match_count;
$$;
