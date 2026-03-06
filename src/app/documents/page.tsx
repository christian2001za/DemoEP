'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { DocumentMetadata } from '@/types'

interface DocSummary {
  id: string
  title: string
  filename: string
  file_type: string
  metadata: DocumentMetadata
  created_at: string
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

const LANGUAGE_FLAGS: Record<string, string> = {
  English: '🇬🇧',
  Dutch: '🇳🇱',
  'Dutch/English': '🇳🇱🇬🇧',
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')

  useEffect(() => {
    fetch('/api/documents')
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? []))
      .finally(() => setLoading(false))
  }, [])

  const allTypes = ['All', ...Array.from(new Set(docs.map((d) => d.metadata?.document_type ?? 'Document'))).sort()]
  const filtered = filter === 'All' ? docs : docs.filter((d) => d.metadata?.document_type === filter)

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

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Search
            </Link>
            <Link
              href="/documents"
              className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md"
            >
              Documents
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Document Library</h1>
          <p className="text-slate-500 text-sm">
            {loading ? 'Loading...' : `${docs.length} documents indexed and searchable`}
          </p>
        </div>

        {/* Type filter pills */}
        {!loading && (
          <div className="flex flex-wrap gap-2 mb-6">
            {allTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  filter === type
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-700'
                }`}
              >
                {type}
                {type !== 'All' && (
                  <span className="ml-1.5 opacity-60">
                    {docs.filter((d) => d.metadata?.document_type === type).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 animate-pulse">
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-28 bg-slate-200 rounded-full" />
                  <div className="h-5 w-16 bg-slate-200 rounded-full" />
                </div>
                <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Document grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((doc) => {
              const docType = doc.metadata?.document_type ?? 'Document'
              const jurisdiction = doc.metadata?.jurisdiction
              const date = doc.metadata?.date
              const language = doc.metadata?.language
              const flag = language ? LANGUAGE_FLAGS[language] : null

              return (
                <Link key={doc.id} href={`/documents/${doc.id}`} className="group block">
                  <Card className="border border-slate-200 bg-white shadow-sm group-hover:shadow-md group-hover:border-blue-200 transition-all h-full">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap gap-1.5">
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
                        </div>
                        {flag && <span className="text-base leading-none mt-0.5">{flag}</span>}
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-blue-700 transition-colors">
                        {doc.title}
                      </h3>
                    </CardHeader>

                    <CardContent className="px-5 pb-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                        <span className="font-mono truncate max-w-[180px]">{doc.filename}</span>
                        {date && (
                          <span>
                            {new Date(date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Open document →
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-center text-slate-400 py-12">No documents found for this filter.</p>
        )}
      </main>
    </div>
  )
}
