/**
 * Splits document text into chunks for embedding.
 *
 * Primary strategy: structural — split on "---" section separators, which all
 * documents in this corpus use. Each section is a natural semantic unit and
 * stays as one chunk (typically 50–250 words). Sections that exceed
 * MAX_SECTION_WORDS are split further at paragraph boundaries.
 *
 * Fallback for unstructured documents: paragraph-based grouping up to
 * MAX_SECTION_WORDS words per chunk.
 *
 * Newlines and document structure are preserved in stored chunk text so
 * the UI can render them cleanly.
 */

const MAX_SECTION_WORDS = 400
const SECTION_SEPARATOR = /\n---+\s*\n/

export function chunkText(text: string): string[] {
  const normalised = text.replace(/\r\n/g, '\n').trim()

  // Split on --- separators (structural sections)
  const rawSections = normalised
    .split(SECTION_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length > 5) // skip near-empty fragments

  // If no meaningful --- structure, fall back to paragraph grouping
  if (rawSections.length <= 1) {
    return paragraphChunk(normalised, MAX_SECTION_WORDS)
  }

  const chunks: string[] = []
  for (const section of rawSections) {
    const wordCount = section.split(/\s+/).length
    if (wordCount <= MAX_SECTION_WORDS) {
      chunks.push(section)
    } else {
      chunks.push(...paragraphChunk(section, MAX_SECTION_WORDS))
    }
  }

  return chunks
}

function paragraphChunk(text: string, maxWords: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const chunks: string[] = []
  const current: string[] = []
  let currentWords = 0

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length
    if (currentWords + paraWords > maxWords && current.length > 0) {
      chunks.push(current.join('\n\n'))
      current.length = 0
      currentWords = 0
    }
    current.push(para)
    currentWords += paraWords
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'))
  }

  return chunks
}

export function getChunkMetadata(
  text: string,
  chunk: string,
  chunkIndex: number
): { word_count: number; char_start: number; char_end: number } {
  const charStart = text.indexOf(chunk.slice(0, 50))
  const charEnd = charStart === -1 ? -1 : charStart + chunk.length
  return {
    word_count: chunk.split(/\s+/).length,
    char_start: charStart,
    char_end: charEnd,
  }
}
