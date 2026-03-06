-- Enable pgvector extension
create extension if not exists vector;

-- Documents table: one row per source file
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null unique,
  file_type text not null default 'text',
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Document chunks table: embeddable pieces of each document
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- IVFFlat index for fast approximate cosine similarity search
create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- match_documents: returns top-N chunks by cosine similarity to a query embedding
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.4,
  match_count int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  filename text,
  chunk_content text,
  chunk_index integer,
  similarity float,
  doc_metadata jsonb,
  chunk_metadata jsonb
)
language sql stable
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    d.title,
    d.filename,
    dc.content as chunk_content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity,
    d.metadata as doc_metadata,
    dc.metadata as chunk_metadata
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
