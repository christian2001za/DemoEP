import { NextRequest, NextResponse } from 'next/server'
import { hybridSearch, keywordSearch } from '@/lib/search'
import { rerankResults } from '@/lib/reranker'
import type { SearchResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, limit = 5, mode = 'semantic' } = body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const trimmedQuery = query.trim()

    // Fetch more candidates than needed so the reranker has room to reorder
    const fetchLimit = mode === 'keyword' ? limit : Math.min(limit + 5, 10)

    const raw = mode === 'keyword'
      ? await keywordSearch(trimmedQuery, fetchLimit)
      : await hybridSearch(trimmedQuery, fetchLimit)

    // Rerank (best-effort, falls back to original order on error)
    const reranked = mode === 'keyword'
      ? raw
      : await rerankResults(trimmedQuery, raw)

    const response: SearchResponse = {
      results: reranked.slice(0, limit),
      query: trimmedQuery,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    )
  }
}
