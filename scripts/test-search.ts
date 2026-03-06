/**
 * Search quality test harness
 * Tests hybrid vs. semantic-only search across a curated set of queries.
 *
 * Usage:  npm run test:search
 *
 * Output: ranked results for each query, with scores and source docs.
 *         At the end, a summary of which queries work best.
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

async function embed(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  })
  return r.data[0].embedding
}

// ── Test queries ──────────────────────────────────────────────────────────────
// Each query includes:
//   - the search string
//   - the language of the query
//   - which document(s) should ideally appear in the top results
//   - why this query is interesting for the demo
// ─────────────────────────────────────────────────────────────────────────────

const TEST_QUERIES = [
  // ── SEMANTIC WINS: query wording ≠ document wording ──────────────────────
  {
    query: 'Who has the final say in deciding who receives money from the trust?',
    lang: 'EN',
    expect: ['trust-deed-namibian-family-trust.txt'],
    note: 'Semantic: "trustees have full and unfettered discretion" — exact phrase not in query',
  },
  {
    query: 'What protection is in place for very young beneficiaries who cannot manage money?',
    lang: 'EN',
    expect: ['trust-deed-namibian-family-trust.txt'],
    note: 'Semantic: maps "very young" → "minor", "cannot manage money" → clause 5.4',
  },
  {
    query: 'What happens to a daughter-in-law\'s trust rights if the marriage ends?',
    lang: 'EN',
    expect: ['trust-amendment-beneficiary.txt'],
    note: 'Semantic: "marriage ends" → "dissolution by divorce", "daughter-in-law" → Lerato Steenkamp',
  },

  // ── CROSS-LINGUAL: Dutch query on English document ────────────────────────
  {
    query: 'Welke documenten moet ik aanleveren als nieuwe klant?',
    lang: 'NL',
    expect: ['compliance-checklist-aml-kyc.txt'],
    note: 'Cross-lingual: Dutch question → English AML/KYC checklist',
  },
  {
    query: 'Wanneer moet de UBO registratie worden bijgewerkt na een wijziging?',
    lang: 'NL',
    expect: ['memo-ubo-register-update-2024.txt'],
    note: 'Cross-lingual: Dutch query on Dutch memo — should be strong match',
  },
  {
    query: 'Hoe hoog is de bronbelasting op dividenden van Namibië naar Nederland?',
    lang: 'NL',
    expect: ['tax-opinion-dividend-withholding.txt', 'structuuradvies-nl-za-holding.txt'],
    note: 'Cross-lingual: NL question on mixed NL/EN docs — tests multilingual RAG',
  },

  // ── HYBRID WINS: keyword match + context ─────────────────────────────────
  {
    query: 'BIPA registration deadline director appointment',
    lang: 'EN',
    expect: ['memo-namibian-companies-act-2024.txt', 'board-resolution-director-appointment.txt'],
    note: 'Hybrid: "BIPA" is rare exact keyword + context needed for deadline',
  },
  {
    query: 'CRS self-certification reportable account holder',
    lang: 'EN',
    expect: ['compliance-memo-crs-south-africa.txt'],
    note: 'Hybrid: "CRS" + "self-certification" are exact terms — FTS boosts semantic',
  },
  {
    query: 'PEP enhanced due diligence senior management approval required',
    lang: 'EN',
    expect: ['compliance-checklist-aml-kyc.txt'],
    note: 'Hybrid: PEP/EDD acronyms + semantic context of approval workflow',
  },

  // ── COMPLEX CONCEPT QUERIES ───────────────────────────────────────────────
  {
    query: 'What must a Dutch holding company demonstrate to qualify for zero withholding tax?',
    lang: 'EN',
    expect: ['tax-opinion-dividend-withholding.txt'],
    note: 'Semantic: "substance requirements" → "demonstrate", "0%" → "zero withholding"',
  },
  {
    query: 'What are the risks that could block the vineyard acquisition from completing?',
    lang: 'EN',
    expect: ['due-diligence-cape-vineyards.txt'],
    note: 'Semantic: "risks that could block" → "material findings", "conditions precedent"',
  },
  {
    query: 'Which Namibian company law changes affect foreign-owned businesses in 2024?',
    lang: 'EN',
    expect: ['memo-namibian-companies-act-2024.txt'],
    note: 'Semantic: broad question → specific sections on resident director + UBO threshold',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function score(rrf: number): string {
  // RRF scores for small datasets are typically 0.01–0.03
  return rrf.toFixed(4)
}

async function runHybrid(query: string, limit = 3) {
  const emb = await embed(query)
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_text: query,
    query_embedding: emb,
    match_count: limit,
    rrf_k: 60,
  })
  if (error) throw new Error(`hybrid_search error: ${error.message}`)
  return data ?? []
}

async function runSemantic(query: string, limit = 3) {
  const emb = await embed(query)
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: emb,
    match_threshold: 0.0,  // No threshold — show all scores for comparison
    match_count: limit,
  })
  if (error) throw new Error(`match_documents error: ${error.message}`)
  return data ?? []
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(80))
  console.log('  EDGEPOINT SEARCH QUALITY TEST')
  console.log('  Hybrid (RRF) vs Semantic-only — top-3 results per query')
  console.log('═'.repeat(80))

  // Verify we have data
  const { count } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .not('fts', 'is', null)

  if (!count || count === 0) {
    console.error('\n❌ No chunks with FTS data found.')
    console.error('   Make sure you ran migration 002 in Supabase SQL Editor.')
    process.exit(1)
  }
  console.log(`\n✓ ${count} chunks with FTS ready\n`)

  const goodDemoQueries: string[] = []
  const weakQueries: string[] = []

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const { query, lang, expect, note } = TEST_QUERIES[i]

    console.log(`\n${'─'.repeat(80)}`)
    console.log(`Q${i + 1} [${lang}] ${query}`)
    console.log(`     Note: ${note}`)
    console.log(`     Expected: ${expect.join(', ')}`)

    let hybridResults: any[] = []
    let semanticResults: any[] = []

    try {
      ;[hybridResults, semanticResults] = await Promise.all([
        runHybrid(query, 3),
        runSemantic(query, 3),
      ])
    } catch (err) {
      console.log(`     ⚠️  Error: ${err}`)
      weakQueries.push(query)
      continue
    }

    // Check if expected docs appear in top hybrid results
    const hybridFilenames = hybridResults.map((r: any) => r.filename)
    const hit = expect.some((e) => hybridFilenames.includes(e))

    console.log(`\n     HYBRID (RRF)  ${hit ? '✅ HIT' : '❌ MISS'}`)
    hybridResults.forEach((r: any, idx: number) => {
      const isExpected = expect.includes(r.filename)
      console.log(`       ${idx + 1}. [${score(r.similarity)}] ${r.title} ${isExpected ? '←' : ''}`)
      console.log(`          "${truncate(r.chunk_content)}"`)
    })

    const semFilenames = semanticResults.map((r: any) => r.filename)
    const semHit = expect.some((e) => semFilenames.includes(e))
    console.log(`\n     SEMANTIC ONLY  ${semHit ? '✅ HIT' : '❌ MISS'}`)
    semanticResults.forEach((r: any, idx: number) => {
      const isExpected = expect.includes(r.filename)
      console.log(`       ${idx + 1}. [${(r.similarity as number).toFixed(4)}] ${r.title} ${isExpected ? '←' : ''}`)
    })

    if (hit) {
      goodDemoQueries.push(`"${query}"`)
    } else {
      weakQueries.push(`"${query}"`)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80))
  console.log('  SUMMARY')
  console.log('═'.repeat(80))
  console.log(`\n✅ Good demo queries (${goodDemoQueries.length}/${TEST_QUERIES.length}):`)
  goodDemoQueries.forEach((q) => console.log(`   ${q}`))

  if (weakQueries.length > 0) {
    console.log(`\n⚠️  Weak queries (${weakQueries.length}):`)
    weakQueries.forEach((q) => console.log(`   ${q}`))
    console.log('\n   Possible reasons:')
    console.log('   - Chunk covers a different part of the document')
    console.log('   - Try rephrasing to be closer to the document language')
    console.log('   - Check that migration 002 ran successfully (fts column populated)')
  }

  console.log('\n')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
