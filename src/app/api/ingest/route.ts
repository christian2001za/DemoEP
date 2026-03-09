import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { createAdminClient } from '@/lib/supabase'
import { generateEmbeddings } from '@/lib/embeddings'
import { chunkText, getChunkMetadata } from '@/lib/chunker'
import type { IngestResponse } from '@/types'

// Map filenames to document metadata for richer search results
const DOCUMENT_METADATA: Record<string, { title: string; document_type: string; jurisdiction: string; language: string; date: string }> = {
  'trust-deed-steenkamp.txt': {
    title: 'Trust Deed — Steenkamp Family Trust (Namibia)',
    document_type: 'Trust Deed',
    jurisdiction: 'Namibia',
    language: 'English',
    date: '2019-03-14',
  },
  'EP-BM-2023-022.txt': {
    title: 'Notulen Bestuursvergadering — Van der Berg Holdings B.V.',
    document_type: 'Board Minutes',
    jurisdiction: 'Netherlands',
    language: 'Dutch',
    date: '2023-11-22',
  },
  'EP-DD-2024-003.txt': {
    title: 'Due Diligence Report — Cape Vineyards (Pty) Ltd',
    document_type: 'Due Diligence Report',
    jurisdiction: 'South Africa',
    language: 'English',
    date: '2024-01-18',
  },
  'EP-CM-2024-007.txt': {
    title: 'Compliance Memo — CRS Reporting Obligations (South Africa)',
    document_type: 'Compliance Memo',
    jurisdiction: 'South Africa',
    language: 'English',
    date: '2024-02-07',
  },
  'EP-SA-2023-010.txt': {
    title: 'Structuuradvies — NL-ZA Holding Structure (Brink Family)',
    document_type: 'Structure Advice',
    jurisdiction: 'Netherlands / South Africa / Namibia',
    language: 'Dutch/English',
    date: '2023-10-03',
  },
  'service-level-agreement.txt': {
    title: 'Service Level Agreement — Edgepoint & Hartenberg Capital',
    document_type: 'Service Level Agreement',
    jurisdiction: 'Netherlands',
    language: 'English',
    date: '2024-02-01',
  },
  'EP-RM-2024-006.txt': {
    title: 'Memo — UBO Register Update Nederland 2024',
    document_type: 'Regulatory Memo',
    jurisdiction: 'Netherlands',
    language: 'Dutch',
    date: '2024-01-15',
  },
  'EP-TA-2023-012.txt': {
    title: 'Trust Amendment — Addition of Beneficiary (Steenkamp Family Trust)',
    document_type: 'Trust Amendment',
    jurisdiction: 'Namibia',
    language: 'English',
    date: '2023-09-12',
  },
  'EP-TO-2023-019.txt': {
    title: 'Tax Opinion — Dividend Withholding Tax NL-Namibia Treaty',
    document_type: 'Tax Opinion',
    jurisdiction: 'Netherlands / Namibia',
    language: 'English',
    date: '2023-12-19',
  },
  'board-resolution-vdb-2024.txt': {
    title: 'Board Resolution — Appointment of Directors, VdB African Holdings (Namibia)',
    document_type: 'Board Resolution',
    jurisdiction: 'Namibia',
    language: 'English',
    date: '2024-03-15',
  },
  'compliance-checklist-aml.txt': {
    title: 'Compliance Checklist — AML/KYC Client Onboarding',
    document_type: 'Compliance Checklist',
    jurisdiction: 'Netherlands / South Africa / Namibia',
    language: 'English',
    date: '2024-01-01',
  },
  'EP-RM-2024-008.txt': {
    title: 'Memo — Amendments to the Namibian Companies Act 2024',
    document_type: 'Regulatory Memo',
    jurisdiction: 'Namibia',
    language: 'English',
    date: '2024-02-08',
  },
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const docsDir = path.join(process.cwd(), 'documents')
  const errors: string[] = []
  let documentsProcessed = 0
  let chunksCreated = 0

  try {
    const files = await readdir(docsDir)
    const txtFiles = files.filter((f) => f.endsWith('.txt'))

    for (const filename of txtFiles) {
      try {
        // Check if already ingested
        const { data: existing } = await supabase
          .from('documents')
          .select('id')
          .eq('filename', filename)
          .single()

        if (existing) {
          console.log(`Skipping ${filename} — already ingested`)
          continue
        }

        const filePath = path.join(docsDir, filename)
        const content = await readFile(filePath, 'utf-8')
        const meta = DOCUMENT_METADATA[filename] ?? {
          title: filename.replace('.txt', '').replace(/-/g, ' '),
          document_type: 'Document',
          jurisdiction: 'Unknown',
          language: 'Unknown',
          date: new Date().toISOString().split('T')[0],
        }

        // Insert document record
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .insert({
            title: meta.title,
            filename,
            file_type: 'text',
            content,
            metadata: meta,
          })
          .select('id')
          .single()

        if (docError || !doc) {
          errors.push(`Failed to insert document ${filename}: ${docError?.message}`)
          continue
        }

        // Chunk the document
        const chunks = chunkText(content)

        // Prepend document title to each chunk before embedding so the vector
        // carries document context. The raw chunk text is stored in the DB.
        const textsForEmbedding = chunks.map((c) => `[Document: ${meta.title}]\n\n${c}`)
        const embeddings = await generateEmbeddings(textsForEmbedding)

        // Insert chunks
        const chunkRows = chunks.map((chunk, index) => ({
          document_id: doc.id,
          content: chunk,
          chunk_index: index,
          embedding: embeddings[index],
          metadata: getChunkMetadata(content, chunk, index),
        }))

        const { error: chunkError } = await supabase
          .from('document_chunks')
          .insert(chunkRows)

        if (chunkError) {
          errors.push(`Failed to insert chunks for ${filename}: ${chunkError.message}`)
          continue
        }

        documentsProcessed++
        chunksCreated += chunks.length
        console.log(`Ingested: ${filename} (${chunks.length} chunks)`)
      } catch (fileError) {
        errors.push(`Error processing ${filename}: ${String(fileError)}`)
      }
    }

    const response: IngestResponse = {
      success: errors.length === 0,
      documents_processed: documentsProcessed,
      chunks_created: chunksCreated,
      errors,
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
