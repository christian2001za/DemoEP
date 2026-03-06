import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createAdminClient()

  const [{ count: docCount }, { count: chunkCount }, { count: embeddedCount }] = await Promise.all([
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('document_chunks').select('*', { count: 'exact', head: true }),
    supabase.from('document_chunks').select('*', { count: 'exact', head: true }).not('embedding', 'is', null),
  ])

  return NextResponse.json({
    documents: docCount ?? 0,
    chunks: chunkCount ?? 0,
    chunks_with_embeddings: embeddedCount ?? 0,
    ready: (embeddedCount ?? 0) > 0,
  })
}
