import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { hybridSearch } from '@/lib/search'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const sources = await hybridSearch(query.trim(), 3)

    if (sources.length === 0) {
      return NextResponse.json({
        answer: 'Ik kon geen relevante informatie vinden in de documenten om uw vraag te beantwoorden.',
        sources: [],
      })
    }

    const context = sources
      .map((s, i) => `[Bron ${i + 1}: ${s.title} – ${s.filename}]\n${s.chunk_content}`)
      .join('\n\n---\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      temperature: 0,
      system: `Je bent een hulpvaardige assistent die vragen beantwoordt op basis van de meegeleverde documenten.
Regels:
- Antwoord UITSLUITEND op basis van de meegeleverde documentfragmenten.
- Verzin niets en voeg geen externe kennis toe.
- Als het antwoord niet in de documenten staat, zeg dat dan duidelijk.
- Antwoord in dezelfde taal als de vraag (NL of EN).
- Wees bondig en direct. Geen opsommingen tenzij noodzakelijk.`,
      messages: [
        {
          role: 'user',
          content: `Vraag: ${query}\n\nDocumentfragmenten:\n\n${context}`,
        },
      ],
    })

    const answer = message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ answer, sources })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
