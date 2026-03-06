'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SearchBar } from '@/components/SearchBar'
import { SearchResults } from '@/components/SearchResults'
import type { SearchResult } from '@/types'

const EXAMPLE_QUERIES = [
  'Who has final say in deciding who receives money from the trust?',
  'Hoe hoog is de bronbelasting op dividenden van Namibië naar Nederland?',
  'Welke documenten moet ik aanleveren als nieuwe klant?',
  'What must a Dutch holding company demonstrate to qualify for zero withholding tax?',
  'What are the risks that could block the vineyard acquisition from completing?',
  'Which Namibian company law changes affect foreign-owned businesses in 2024?',
]

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch(query: string) {
    setIsLoading(true)
    setError(null)
    setCurrentQuery(query)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 5 }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Search failed')
      }

      const data = await response.json()
      setResults(data.results)
      setHasSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-700 rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight">Edgepoint</span>
              <span className="text-slate-400 text-base font-light ml-1.5">Document Intelligence</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md"
            >
              Search
            </Link>
            <Link
              href="/documents"
              className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Documents
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero */}
        {!hasSearched && (
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-slate-900 mb-3">
              Find exactly what you need
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Search your documents by meaning — not just keywords. Get the exact passage that answers your question, with source attribution.
            </p>
          </div>
        )}

        {/* Search bar */}
        <div className={hasSearched ? 'mb-6' : 'mb-8'}>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>

        {/* Example queries — only shown before first search */}
        {!hasSearched && (
          <div className="mb-10">
            <p className="text-center text-xs text-slate-400 uppercase tracking-wider font-medium mb-3">Try these examples</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSearch(q)}
                  className="text-sm px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !isLoading && (
          <SearchResults results={results} query={currentQuery} />
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-24 bg-slate-200 rounded-full" />
                  <div className="h-5 w-16 bg-slate-200 rounded-full" />
                </div>
                <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-full bg-slate-100 rounded mb-1.5" />
                <div className="h-3 w-5/6 bg-slate-100 rounded mb-1.5" />
                <div className="h-3 w-4/5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-6 mt-10 border-t border-slate-200 text-center text-xs text-slate-400">
        Edgepoint Document Intelligence — Demo build · Hybrid search: OpenAI embeddings + Supabase pgvector + FTS (RRF)
      </footer>
    </div>
  )
}
