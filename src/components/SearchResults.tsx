'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SearchResult } from '@/types'

interface SearchResultsProps {
  results: SearchResult[]
  query: string
}

const TYPE_COLORS: Record<string, string> = {
  'Trust Deed': 'bg-purple-100 text-purple-800 border-purple-200',
  'Trust Amendment': 'bg-purple-100 text-purple-800 border-purple-200',
  'Board Minutes': 'bg-blue-100 text-blue-800 border-blue-200',
  'Board Resolution': 'bg-blue-100 text-blue-800 border-blue-200',
  'Due Diligence Report': 'bg-orange-100 text-orange-800 border-orange-200',
  'Compliance Memo': 'bg-red-100 text-red-800 border-red-200',
  'Compliance Checklist': 'bg-red-100 text-red-800 border-red-200',
  'Regulatory Memo': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Structure Advice': 'bg-green-100 text-green-800 border-green-200',
  'Tax Opinion': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Service Level Agreement': 'bg-slate-100 text-slate-800 border-slate-200',
}

function getTypeColor(docType: string): string {
  return TYPE_COLORS[docType] ?? 'bg-slate-100 text-slate-700 border-slate-200'
}

function highlightText(text: string, query: string): string {
  if (!query) return text
  const terms = query.split(/\s+/).filter((t) => t.length > 2)
  if (terms.length === 0) return text
  const regex = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200 rounded-sm px-0.5">$1</mark>')
}

function RelevanceBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = Math.round((score / maxScore) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{pct}% match</span>
    </div>
  )
}

export function SearchResults({ results, query }: SearchResultsProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="font-medium">No results found</p>
        <p className="text-sm mt-1">Try different search terms or a broader query.</p>
      </div>
    )
  }

  const maxScore = Math.max(...results.map((r) => r.similarity), 0.001)

  return (
    <div className="space-y-4 w-full max-w-3xl mx-auto">
      <p className="text-sm text-slate-500">
        {results.length} result{results.length !== 1 ? 's' : ''} for <span className="font-medium text-slate-700">"{query}"</span>
      </p>

      {results.map((result, index) => {
        const docType = result.doc_metadata?.document_type ?? 'Document'
        const jurisdiction = result.doc_metadata?.jurisdiction
        const date = result.doc_metadata?.date
        const isExpanded = expanded === result.chunk_id
        const highlightedText = highlightText(result.chunk_content, query)

        return (
          <Card
            key={result.chunk_id}
            className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setExpanded(isExpanded ? null : result.chunk_id)}
          >
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium border ${getTypeColor(docType)}`}
                    >
                      {docType}
                    </Badge>
                    {jurisdiction && (
                      <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-500">
                        {jurisdiction}
                      </Badge>
                    )}
                    {date && (
                      <span className="text-xs text-slate-400">
                        {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm leading-snug">
                    {result.title}
                  </h3>
                </div>
                <RelevanceBar score={result.similarity} maxScore={maxScore} />
              </div>
            </CardHeader>

            <CardContent className="px-5 pb-4">
              <div className="text-sm text-slate-600 leading-relaxed">
                {isExpanded ? (
                  <p
                    className="whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: highlightedText }}
                  />
                ) : (
                  <p
                    className="line-clamp-3"
                    dangerouslySetInnerHTML={{
                      __html: highlightedText.slice(0, 400) + (highlightedText.length > 400 ? '...' : ''),
                    }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-mono">
                  {result.filename} · chunk {result.chunk_index + 1}
                </span>
                <div className="flex items-center gap-3">
                  <button className="text-xs text-slate-500 hover:text-slate-800 font-medium">
                    {isExpanded ? '↑ Collapse' : '↓ Show full passage'}
                  </button>
                  <Link
                    href={`/documents/${result.document_id}?highlight=${encodeURIComponent(result.chunk_content.slice(0, 120))}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Open document →
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
