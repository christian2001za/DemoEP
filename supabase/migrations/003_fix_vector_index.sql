-- ============================================================
-- Migration 003: Replace broken IVFFlat index with HNSW
-- Run this in the Supabase SQL Editor AFTER migration 001
-- ============================================================
-- IVFFlat with lists=100 is broken for small datasets.
-- With ~50 chunks and probes=1, it searches only 1 cluster
-- and misses ~99% of the data. HNSW has no such limitation
-- and delivers excellent recall at any scale.
-- ============================================================

drop index if exists document_chunks_embedding_idx;

create index if not exists document_chunks_embedding_hnsw_idx
  on document_chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
