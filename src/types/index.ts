export interface Document {
  id: string
  title: string
  filename: string
  file_type: string
  content: string
  metadata: DocumentMetadata
  created_at: string
}

export interface DocumentMetadata {
  document_type?: string
  jurisdiction?: string
  language?: string
  date?: string
  parties?: string[]
  [key: string]: unknown
}

export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  embedding?: number[]
  metadata: ChunkMetadata
  created_at: string
}

export interface ChunkMetadata {
  word_count?: number
  char_start?: number
  char_end?: number
  [key: string]: unknown
}

export interface SearchResult {
  chunk_id: string
  document_id: string
  title: string
  filename: string
  chunk_content: string
  chunk_index: number
  similarity: number
  doc_metadata: DocumentMetadata
  chunk_metadata: ChunkMetadata
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
}

export interface IngestResponse {
  success: boolean
  documents_processed: number
  chunks_created: number
  errors: string[]
}
