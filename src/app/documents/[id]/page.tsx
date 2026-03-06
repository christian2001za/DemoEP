'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { DocumentMetadata } from '@/types'

interface FullDocument {
  id: string
  title: string
  filename: string
  file_type: string
  content: string
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

const LANGUAGE_FLAGS: Record<string, string> = {
  English: '🇬🇧',
  Dutch: '🇳🇱',
  'Dutch/English': '🇳🇱🇬🇧',
}

function renderContent(content: string, highlight: string | null) {
  if (!highlight) {
    return (
      <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-[inherit] break-words">
        {content}
      </pre>
    )
  }

  const idx = content.indexOf(highlight)
  if (idx === -1) {
    // fallback: no exact match, just render plain
    return (
      <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-[inherit] break-words">
        {content}
      </pre>
    )
  }

  const before = content.slice(0, idx)
  const match = content.slice(idx, idx + highlight.length)
  const after = content.slice(idx + highlight.length)

  return (
    <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-[inherit] break-words">
      {before}
      <mark id="highlight-anchor" className="bg-yellow-200 rounded-sm px-0.5 text-slate-900">{match}</mark>
      {after}
    </pre>
  )
}

export default function DocumentDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const highlight = searchParams.get('highlight')

  const [doc, setDoc] = useState<FullDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Document not found')
        return r.json()
      })
      .then((data) => setDoc(data.document))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // Scroll to highlighted passage once document is rendered
  useEffect(() => {
    if (!loading && highlight) {
      document.getElementById('highlight-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, highlight])

  const docType = doc?.metadata?.document_type ?? 'Document'
  const typeColor = TYPE_COLORS[docType] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  const flag = doc?.metadata?.language ? LANGUAGE_FLAGS[doc.metadata.language] : null

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
            <Link href="/" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
              Search
            </Link>
            <Link href="/documents" className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
              Documents
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back link */}
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Document Library
        </Link>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 animate-pulse">
            <div className="flex gap-2 mb-4">
              <div className="h-6 w-32 bg-slate-200 rounded-full" />
              <div className="h-6 w-20 bg-slate-200 rounded-full" />
            </div>
            <div className="h-7 w-2/3 bg-slate-200 rounded mb-6" />
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`h-3 bg-slate-100 rounded ${i % 4 === 3 ? 'w-3/4' : 'w-full'}`} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
            {error}
          </div>
        )}

        {/* Document */}
        {doc && !loading && (
          <>
            {/* Meta card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`text-xs font-medium border ${typeColor}`}>
                    {docType}
                  </Badge>
                  {doc.metadata?.jurisdiction && (
                    <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-500">
                      {doc.metadata.jurisdiction}
                    </Badge>
                  )}
                  {doc.metadata?.language && (
                    <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-500">
                      {flag} {doc.metadata.language}
                    </Badge>
                  )}
                </div>
                {doc.metadata?.date && (
                  <span className="text-sm text-slate-400 whitespace-nowrap">
                    {new Date(doc.metadata.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 leading-snug">{doc.title}</h1>
              <p className="text-xs text-slate-400 font-mono mt-2">{doc.filename}</p>
            </div>

            {/* Document content */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Document Content</span>
                <div className="flex items-center gap-3">
                  {highlight && (
                    <span className="text-xs text-amber-600 font-medium">Passage highlighted</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {doc.content.split(/\s+/).length.toLocaleString()} words
                  </span>
                </div>
              </div>
              <div className="px-6 py-6 overflow-auto">
                {renderContent(doc.content, highlight)}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
