import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 60

type ComposeBody = {
  prompt: string
  businessContext?: string | null
  companyBlock?: string | null
  processor?: 'lite' | 'base' | 'core' | 'pro' | 'ultra' | null
}

// Ordered model fallbacks for OpenRouter (DeepSeek first; then OpenAI; then Gemini)
const MODEL_ORDER = [
  'tngtech/deepseek-r1t2-chimera:free',
  'tngtech/deepseek-r1t-chimera:free',
  'deepseek/deepseek-chat-v3.1:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'openai/gpt-5-mini',
  'google/gemini-2.5-flash',
]

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

function buildMetaPrompt({ prompt, businessContext, companyBlock, processor }: ComposeBody): string {
  const bc = (businessContext || '').trim()
  const cb = (companyBlock || '').trim()
  const p = (processor || 'pro')
  const processorNotes: Record<string, { inputLimit: string; brief: string }> = {
    lite: {
      inputLimit: '~100–140 words max',
      brief: 'Factoid-level; keep schema minimal (direct answer, 2–3 key points, sources).',
    },
    base: {
      inputLimit: '~140–170 words max',
      brief: 'Short brief; include direct answer, 3–6 key points, sources.',
    },
    core: {
      inputLimit: '~170–200 words max',
      brief: 'Balanced synthesis; include executive summary, 4–8 key findings, sources; add next steps if useful.',
    },
    pro: {
      inputLimit: '~200–230 words max',
      brief: 'Thorough; include exec summary, 6–12 findings, next steps, uncertainties if any, sources.',
    },
    ultra: {
      inputLimit: '~230–260 words max',
      brief: 'Deep dive; allow thematic sections when relevant, rich findings, actions, uncertainties, sources.',
    },
  }
  const pn = processorNotes[p]
  // Generic, flexible, English-only for Parallel; downstream translation is separate
  return [
    'You design the optimal "input" and "output_schema" for a web-searching research model (Parallel).',
    'All content sent to Parallel must be English. If the provided fields are not in English, translate/normalize them to concise English first.',
    'Do NOT add any translation requirements to the output_schema; a separate system will translate the final English result into the target language afterward.',
  'Use only the minimum necessary details from the provided fields; omit irrelevant information that does not help answer the prompt.',
    '',
    `Processor context: ${p}. ${pn.brief}`,
    `- Match depth/length to processor. Input length budget: ${pn.inputLimit}.`,
    '',
    'Return ONLY valid JSON with keys:',
    '{',
    '  "input": "<string to send to Parallel>",',
    '  "output_schema": "<string describing how Parallel must structure its English answer>"',
    '}',
    '',
    'Data:',
    `- Prompt: ${prompt}`,
    `- Business context (about me): ${bc || '(none provided)'} `,
    `- Company block (about the target company): ${cb || '(none provided)'} `,
    '',
    'Rules for "input":',
    '- English only. Briefly normalize any non-English content into English while preserving meaning.',
  '- Compose clearly labeled blocks in this order:',
  '  1) Prompt: <restated, precise, one-sentence request>',
  '  2) Business context: <who the user/company is, why this matters, constraints/preferences>',
  '  3) Company: <use company block verbatim except minor normalization (URL formatting, whitespace)>',
  '  4) Role variants: <comma-separated synonyms/variants of the target role/title> (include only when the ask targets a person with a specific role/title)',
  '- Include only details necessary to fulfill the prompt. Do not copy everything from the inputs.',
  '- Retrieval guidance: prioritize official pages (company site/team/press), authoritative profiles (LinkedIn), recent news/press, and filings/registries. Avoid speculation. When searching for a person by role/title, include role/title variants and closely-related seniority variants to maximize recall.',
  `- Keep concise and decision-oriented; respect the processor input budget above.`,
  '',
  'Instructions for "Role variants" (only when person-by-role is requested):',
  '- Generate 6-12 compact variants that a company may use for the same role/title.',
  '- Include: common abbreviations, synonyms, and seniority alternatives (e.g., Head of X, VP of X, Director of X, Lead X).',
  '- Include locale/orthography variants when relevant (e.g., organisation/organization; marketing/marketin in Nordic contexts if appropriate).',
  '- Keep them short and comma-separated; no duplicates or speculation about names; titles only.',
  '- Example: Chief Financial Officer → CFO, Chief Financial Officer, VP Finance, Head of Finance, Finance Director, Director of Finance',
    '',
  'Rules for "output_schema" (flexible by question complexity & processor):',
    '- Always require the model to answer in English and use bracketed citation IDs [n] tied to a Sources list.',
    '- Pick the schema that best fits the prompt; keep sections only when useful.',
  `- If processor is ${p}, prioritize: ${pn.brief}`,
    '',
    'Complexity: simple (factoid / narrow ask)',
    '- Sections:',
    '  - Direct answer (2–4 sentences) with [n] where claims are made',
    '  - Key points (3–6 bullets) with [n]',
    '  - Sources: numbered list (1..n) with URL, title, accessed_at (YYYY-MM-DD)',
    '',
    'Complexity: moderate (single-topic research / brief synthesis)',
    '- Sections:',
    '  - Executive summary (2–4 sentences) with [n]',
    '  - Key findings (4–10 bullets) with [n]',
    '  - Actionable next steps (2–6 bullets) when applicable',
    '  - Uncertainties/gaps (bullets) if evidence is limited',
    '  - Sources (1..n) with URL, title, accessed_at',
    '',
    'Complexity: deep (multi-faceted / comparative / strategic)',
    '- Sections (include only those that fit the ask):',
    '  - Overview and context (2–4 sentences) with [n]',
    '  - Thematic analysis (subsections by theme; each with [n])',
    '  - If people-focused: a People block listing name, title, organization, region (optional), LinkedIn URL, reason for relevance, each with source_ids',
    '  - Metrics/data (units, ranges, recency; state assumptions)',
    '  - Risks/uncertainties',
    '  - Recommended actions/plan',
    '  - Sources (1..n) with URL, title, accessed_at',
    '',
    'General requirements (apply to all complexities):',
    '- Neutral, concise, business-friendly tone. Markdown allowed, no HTML.',
    '- Do not invent facts or emails; if unknown, state it and lower confidence.',
    '- For comparisons/lists: use consistent criteria; concise table-like bullets are acceptable.',
    '- Always reference sources via [n] in text and provide matching numbered entries in Sources.',
    '',
    'Validation:',
    '- Return strictly valid JSON containing only "input" and "output_schema".',
  ].join('\n')
}

async function callOpenRouter(model: string, metaPrompt: string, referer?: string) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      ...(referer ? { 'HTTP-Referer': referer } : {}),
      'X-Title': 'Hugin Compose',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // Some providers support JSON mode; ignored by others
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system',
          content:
            'You are a careful prompt and schema designer. Output only strict JSON with keys input and output_schema. No explanations.',
        },
        { role: 'user', content: metaPrompt },
      ],
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${model} error ${res.status}: ${text}`)
  }
  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('No content returned from model')
  }
  // Attempt strict JSON parse; if it fails, try to extract JSON object
  try {
    return JSON.parse(content)
  } catch {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const maybe = content.slice(start, end + 1)
      return JSON.parse(maybe)
    }
    throw new Error('Model did not return valid JSON')
  }
}

export async function POST(req: Request) {
  try {
    const accessError = await checkApiAccess()
    if (accessError) return accessError

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
    }

    const body = (await req.json()) as ComposeBody
    const prompt = (body.prompt || '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }
    const meta = buildMetaPrompt(body)
    try {
      console.log('=== [compose] DeepSeek meta-prompt start ===')
      console.log(meta)
      console.log('=== [compose] DeepSeek meta-prompt end ===')
    } catch {}

    const referer = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined

    let lastErr: unknown = null
    for (const model of MODEL_ORDER) {
      try {
        console.log(`[compose] Trying model: ${model}`)
      } catch {}
      try {
        const json = await callOpenRouter(model, meta, referer)
        const input: unknown = json?.input
        const outputSchema: unknown = json?.output_schema || json?.outputSchema
        if (typeof input !== 'string' || typeof outputSchema !== 'string') {
          throw new Error('Invalid JSON shape: expected string input and output_schema')
        }
        try {
          console.log(`[compose] Model succeeded: ${model}`)
          console.log('=== [compose] DeepSeek output: input start ===')
          console.log(input)
          console.log('=== [compose] DeepSeek output: input end ===')
          console.log('=== [compose] DeepSeek output: output_schema start ===')
          console.log(outputSchema)
          console.log('=== [compose] DeepSeek output: output_schema end ===')
        } catch {}
        return NextResponse.json({ input, outputSchema, model })
      } catch (e) {
        lastErr = e
        try {
          console.warn(`[compose] Model failed: ${model}: ${String(e)}`)
        } catch {}
        // try next model
      }
    }

    return NextResponse.json(
      { error: 'All models failed', details: String(lastErr) },
      { status: 502 }
    )
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
