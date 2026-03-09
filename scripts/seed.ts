/**
 * Seed script: reads all .txt files from documents/, generates embeddings, and
 * inserts everything into Supabase.
 *
 * Usage:  npm run seed
 * Requires: .env.local with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'
import { chunkText } from '../src/lib/chunker'

// Load .env.local
config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiApiKey = process.env.OPENAI_API_KEY!

if (!supabaseUrl || !serviceRoleKey || !openaiApiKey) {
  console.error('Missing required environment variables. Check your .env.local file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const openai = new OpenAI({ apiKey: openaiApiKey })

// ─── Document metadata map ─────────────────────────────────────────────────

const DOCUMENT_METADATA: Record<string, {
  title: string
  document_type: string
  jurisdiction: string
  language: string
  date: string
}> = {
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

// ─── Embedding generation (batched) ─────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 100
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.trim())
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
      dimensions: 1536,
    })
    results.push(...response.data.map((d) => d.embedding))
  }

  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const docsDir = path.join(process.cwd(), 'documents')
  const files = await readdir(docsDir)
  const txtFiles = files.filter((f) => f.endsWith('.txt'))

  console.log(`Found ${txtFiles.length} document(s) in documents/\n`)

  let totalDocs = 0
  let totalChunks = 0
  const errors: string[] = []

  for (const filename of txtFiles) {
    try {
      // Skip if already ingested
      const { data: existing } = await supabase
        .from('documents')
        .select('id')
        .eq('filename', filename)
        .single()

      if (existing) {
        console.log(`  [skip] ${filename} — already ingested`)
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

      process.stdout.write(`  [+] ${filename}`)

      // Insert document
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({ title: meta.title, filename, file_type: 'text', content, metadata: meta })
        .select('id')
        .single()

      if (docError || !doc) {
        throw new Error(`DB insert failed: ${docError?.message}`)
      }

      // Chunk + embed
      const chunks = chunkText(content)
      const embeddings = await generateEmbeddings(chunks)

      const chunkRows = chunks.map((chunk, index) => {
        const start = content.indexOf(chunk.slice(0, 50))
        return {
          document_id: doc.id,
          content: chunk,
          chunk_index: index,
          embedding: embeddings[index],
          metadata: {
            word_count: chunk.split(/\s+/).length,
            char_start: start,
            char_end: start === -1 ? -1 : start + chunk.length,
          },
        }
      })

      const { error: chunkError } = await supabase.from('document_chunks').insert(chunkRows)
      if (chunkError) throw new Error(`Chunk insert failed: ${chunkError.message}`)

      totalDocs++
      totalChunks += chunks.length
      console.log(` → ${chunks.length} chunks`)
    } catch (err) {
      const msg = `${filename}: ${String(err)}`
      errors.push(msg)
      console.log(` → ERROR: ${msg}`)
    }
  }

  console.log(`\nDone! Ingested ${totalDocs} document(s), ${totalChunks} chunk(s).`)
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`)
    errors.forEach((e) => console.log(`  - ${e}`))
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
