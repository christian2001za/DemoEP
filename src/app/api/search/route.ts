import { NextRequest, NextResponse } from 'next/server'
import { hybridSearch, keywordSearch } from '@/lib/search'
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

    const results = mode === 'keyword'
      ? await keywordSearch(query.trim(), limit)
      : await hybridSearch(query.trim(), limit)

    const response: SearchResponse = {
      results,
      query: query.trim(),
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
