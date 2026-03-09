import Anthropic from '@anthropic-ai/sdk'
import type { SearchResult } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Maximum number of candidates to send to the reranker.
// More candidates = better recall but more latency/cost.
const MAX_RERANK_CANDIDATES = 10

// Minimum number of results needed to bother reranking.
// With ≤2 results there's nothing meaningful to reorder.
const MIN_RESULTS_TO_RERANK = 3

/**
 * Reranks search results using Claude Haiku as a cross-encoder.
 *
 * Haiku reads the query and up to MAX_RERANK_CANDIDATES chunks and returns
 * them sorted by relevance. This catches cases where cosine similarity or
 * RRF rank diverge from true semantic relevance (e.g. topically adjacent
 * but not actually useful chunks ranking above precise answers).
 *
 * Falls back to original order on any error so search never breaks.
 */
export async function rerankResults(
  query: string,
  results: SearchResult[]
): Promise<SearchResult[]> {
  if (results.length < MIN_RESULTS_TO_RERANK) return results

  const candidates = results.slice(0, MAX_RERANK_CANDIDATES)

  const chunksText = candidates
    .map((r, i) =>
      `[${i}] Titel: ${r.title}\n${r.chunk_content.slice(0, 400)}`
    )
    .join('\n\n---\n\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system:
        'You are a relevance ranking assistant for a legal and financial document search system. ' +
        'Given a query and a numbered list of document chunks, return ONLY a JSON array of indices ' +
        'sorted from most relevant to least relevant. Example: [2,0,4,1,3]. ' +
        'No explanation, no markdown, just the JSON array.',
      messages: [
        {
          role: 'user',
          content: `Query: "${query}"\n\nDocument chunks:\n\n${chunksText}\n\nReturn sorted indices as JSON array:`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Extract JSON array from the response (guard against any stray whitespace/text)
    const match = text.match(/\[[\d,\s]+\]/)
    if (!match) return results

    const indices: number[] = JSON.parse(match[0])

    // Validate: indices must be a permutation of 0..candidates.length-1
    const valid =
      indices.length > 0 &&
      indices.every((i) => Number.isInteger(i) && i >= 0 && i < candidates.length)

    if (!valid) return results

    // Reorder candidates by reranker output; append any tail results unchanged
    const reranked = indices.map((i) => candidates[i])
    const tail = results.slice(MAX_RERANK_CANDIDATES)
    return [...reranked, ...tail]
  } catch {
    // Reranker is best-effort — never break search
    return results
  }
}
