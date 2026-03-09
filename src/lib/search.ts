import { createAdminClient } from './supabase'
import { generateEmbedding } from './embeddings'
import type { SearchResult } from '@/types'

// Common English + Dutch function/question words to strip before FTS keyword search.
// Keeping only meaningful content words avoids AND-of-everything queries that match nothing.
const STOPWORDS = new Set([
  // English
  'what', 'who', 'how', 'when', 'where', 'which', 'does', 'did', 'do',
  'is', 'are', 'was', 'were', 'will', 'would', 'could', 'should', 'must',
  'can', 'may', 'have', 'has', 'had', 'been', 'being', 'be',
  'the', 'and', 'but', 'for', 'nor', 'yet', 'that', 'this', 'these',
  'those', 'its', 'not', 'from', 'with', 'into', 'onto', 'upon',
  'also', 'more', 'most', 'than', 'then', 'such', 'each', 'both',
  'they', 'them', 'their', 'there', 'here', 'any', 'all', 'some',
  // Dutch
  'wat', 'wie', 'hoe', 'wanneer', 'waar', 'welke', 'welk', 'welks',
  'heeft', 'hebben', 'had', 'zijn', 'was', 'waren', 'wordt', 'worden',
  'kan', 'kunnen', 'zou', 'zouden', 'moet', 'moeten', 'mogen', 'mag',
  'zal', 'zullen', 'wil', 'willen',
  'het', 'een', 'dat', 'die', 'deze', 'dit', 'zijn', 'naar', 'niet',
  'ook', 'nog', 'maar', 'als', 'dan', 'bij', 'uit', 'voor', 'door',
  'over', 'onder', 'met', 'van', 'aan', 'tot', 'per', 'hun', 'hem',
])

/**
 * Extracts the most specific content words from a query for FTS.
 * Returns them joined with " OR " so PostgreSQL's websearch_to_tsquery
 * uses OR-logic instead of AND-of-every-word, giving much better recall.
 */
function extractFtsKeywords(query: string, maxTerms = 4): string {
  const words = query
    .toLowerCase()
    .replace(/[?.,!;:'"\-()/]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))

  if (words.length === 0) return query

  // Deduplicate and prefer longer words (more domain-specific)
  const unique = [...new Set(words)]
  unique.sort((a, b) => b.length - a.length)

  return unique.slice(0, maxTerms).join(' OR ')
}

// Hybrid search: Reciprocal Rank Fusion of semantic (pgvector) + keyword (FTS)
// This is the primary search function.
export async function hybridSearch(
  query: string,
  matchCount = 5,
  rrfK = 60
): Promise<SearchResult[]> {
  const [queryEmbedding] = await Promise.all([generateEmbedding(query)])
  const ftsQuery = extractFtsKeywords(query)
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text: ftsQuery,
    query_embedding: queryEmbedding,
    match_count: matchCount,
    rrf_k: rrfK,
  })

  if (error) {
    throw new Error(`Hybrid search failed: ${error.message}`)
  }

  return (data ?? []) as SearchResult[]
}

// Pure keyword search — uses PostgreSQL FTS without semantic understanding.
// Intentionally "dumb": no stemming (simple config), no synonyms, no embeddings.
// Used for demo contrast to show where semantic search adds value.
export async function keywordSearch(
  query: string,
  matchCount = 5
): Promise<SearchResult[]> {
  const supabase = createAdminClient()

  const terms = query
    .toLowerCase()
    .replace(/[?.,!;:'"\-()/]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .join(' | ')

  if (!terms) return []

  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, document_id, content, chunk_index, metadata, documents!inner(id, title, filename, metadata)')
    .textSearch('content', terms, { type: 'plain', config: 'simple' })
    .limit(matchCount)

  if (error) {
    throw new Error(`Keyword search failed: ${error.message}`)
  }

  return (data ?? []).map((row, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = row.documents as any
    return {
      chunk_id: row.id,
      document_id: row.document_id,
      title: doc.title,
      filename: doc.filename,
      chunk_content: row.content,
      chunk_index: row.chunk_index,
      similarity: Math.max(0.1, 1 - idx * 0.12),
      doc_metadata: doc.metadata,
      chunk_metadata: row.metadata,
    }
  })
}

// Pure semantic search — kept for comparison / fallback
export async function semanticSearch(
  query: string,
  matchCount = 5,
  matchThreshold = 0.2
): Promise<SearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })

  if (error) {
    throw new Error(`Semantic search failed: ${error.message}`)
  }

  return (data ?? []) as SearchResult[]
}
