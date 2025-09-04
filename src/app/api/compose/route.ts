import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'

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
  // Updated: Task Spec Authoring Rules (replaces prior prompt/schema guidance)
  return [
    'You must output strict JSON with exactly two top-level string keys: "input" and "output_schema". No extra text.',
    '',
    `Processor context: ${p}. ${pn.brief} (Input word budget: ${pn.inputLimit}).`,
    '',
    'TASK SPEC AUTHORING RULES (APPLY TO output_schema):',
    '1) Always define a JSON output schema. Root object with properties; additionalProperties:false everywhere; no anyOf/oneOf/allOf at root.',
    '2) Every field required. To make a field optional, its type must be a union with null (e.g., ["string","null"]).',
    '3) Unsupported keywords: contains, format, maxContains, maxItems, maxLength, maxProperties, maximum, minContains, minItems, minLength, minimum, minProperties, multipleOf, pattern, patternProperties, propertyNames, uniqueItems, unevaluatedItems, unevaluatedProperties.',
    '4) Limits: depth ≤5, total properties ≤100, full spec ≤10k chars (spec+input ≤15k). Keep schema as flat as practical.',
    '5) Field description prompt pattern: Entity → Action → Specifics → Error handling. Include formats (dates YYYY-MM-DD with fallback YYYY-MM or YYYY), units, ordering, truncation rules, when to return null.',
    '6) Do NOT add reasoning, confidence, citations, analysis, thought_process fields—these are auto-provided elsewhere.',
    '7) If lists: describe ordering, max length, truncation in description (never with maxItems).',
    '8) Missing/conflict handling: specify authoritative source precedence in description; return null only if unobtainable.',
    '9) Only include fields that are stable/reusable for the prompt; if no stable structure is possible, create a minimal schema with a single field like narrative (string) but prefer structured extraction when feasible.',
    '10) Monetary/date fields share consistent formatting rules; specify currency normalization if present.',
    '11) Security: treat provided identifiers literally—no speculative expansion.',
    '12) No translation directives; assume English output.',
    '',
    'INPUT STRING (key "input") RULES:',
  '- You MUST author the entire input; do NOT blindly copy provided text.',
  '- Include only information that materially changes retrieval strategy or answer quality. Apply the relevance test: "Would the search queries or synthesized answer change if this fact were removed?" If no → exclude.',
  '- Blocks (omit entirely if they add no value): Prompt:, Business context:, Company:, Role variants:. Maintain this order for included blocks.',
  '- Business context: may be omitted OR compressed. Extract at most the 1–4 most critical facts (goals, constraints, target audience) expressed as short phrases or one concise sentence. Drop internal/irrelevant chatter, boilerplate, marketing fluff, or sensitive details not needed for retrieval.',
  '- Company: selectively extract only disambiguating identifiers (legal/brand name variants, ticker, HQ country, core product category, a unique URL). Do NOT include the whole block if most content is redundant; compress to <= 25% of original tokens when possible.',
  '- Role variants: include only when the prompt targets a role/title and provide 6–12 concise variants (no personal names). Omit otherwise.',
  '- Never exceed the processor word budget; prefer brevity over completeness.',
  '- Retrieval guidance (inline in input): emphasize official sites, filings, authoritative profiles (LinkedIn), reputable recent news, and registries. Avoid speculation or unverifiable claims.',
  '- It is acceptable for the final input to have only a Prompt: block if all other data is superfluous.',
    '',
    'ROLE VARIANTS (only if searching by role): 6–12 comma-separated title synonyms (e.g., CFO, Chief Financial Officer, VP Finance, Head of Finance, Finance Director, Director of Finance). No personal names.',
    '',
    'OUTPUT_SCHEMA CONSTRUCTION STEPS:',
    'A) Identify the essential factual fields to satisfy the prompt (prefer explicit atomic fields: e.g., ceo_name, headquarters_address, founded_date, top_products).',
    'B) For each field write a precise description with format, source preference, disambiguation rules, null policy.',
    'C) Mark every property required; use nullable union type only if truly optional.',
    'D) Set additionalProperties:false at root (and any nested objects).',
    'E) Keep nested objects only if logically cohesive; avoid deep hierarchy.',
    'F) Validate schema against forbidden keywords mentally before returning.',
    '',
    'If the task is inherently narrative (no stable fields), fallback schema example you MAY adapt minimally:',
    '{"type":"object","description":"Synthesis","properties":{"narrative":{"type":"string","description":"Entity: research synthesis. Action: produce structured markdown narrative with bracketed source IDs [n]. Specifics: cover scope of user prompt; sections as needed. Error: if info absent, state unknown."}},"required":["narrative"],"additionalProperties":false}',
    '',
    'FINAL VALIDATION CHECKLIST (do NOT output this checklist—just ensure compliance): root object; properties listed; all required; optional via union with null; additionalProperties:false; no unsupported keywords; depth ≤5; field descriptions specify formatting + null rules; no reasoning/citation meta fields.',
    '',
    'Return ONLY JSON like:',
    '{',
    '  "input": "<string with the retrieval-oriented prompt blocks>",',
    '  "output_schema": "<raw JSON schema (escaped) or plain JSON string literal>"',
    '}',
    '',
    'DATA PROVIDED:',
    `Prompt raw: ${prompt}`,
    `Business context raw: ${bc || '(none)'}`,
    `Company block raw: ${cb || '(none)'}`,
    '',
    'Design now.'
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
    // Fallback businessContext to session value if not provided
    try {
      if (!body.businessContext) {
        const session = (await getServerSession(authOptions)) as Session | null
        const bc = session?.user?.businessContext as string | undefined
        if (bc && bc.trim()) body.businessContext = bc
      }
    } catch {}
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
