import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'
import { apiCache } from '@/lib/api-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 60

type TranslateBody = {
  text: string
  targetLanguage?: string | null
  matchPrompt?: boolean | null
  promptText?: string | null
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL_ORDER = [
  'tngtech/deepseek-r1t2-chimera:free',
  'tngtech/deepseek-r1t-chimera:free',
  'deepseek/deepseek-chat-v3.1:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'openai/gpt-5-mini',
  'google/gemini-2.5-flash',
]

// Tiny heuristic language detector: focuses on English, Norwegian, Swedish, Danish.
// Returns 'en' | 'no' | 'sv' | 'da' | 'unknown'.
function detectLangHeuristic(text: string): 'en' | 'no' | 'sv' | 'da' | 'unknown' {
  const t = (text || '').toLowerCase()
  if (!t || t.replace(/[^a-zæøåäö]/gi, '').length < 8) return 'unknown'

  // Diacritics strong hints
  if (/[æøå]/.test(t)) {
    // Distinguish no vs da by "av" vs "af"
    const hasAv = /\bav\b/.test(t)
    const hasAf = /\baf\b/.test(t)
    if (hasAf && !hasAv) return 'da'
    return 'no'
  }
  if (/[äö]/.test(t)) return 'sv'

  // Stopword scoring
  const count = (re: RegExp) => (t.match(re) || []).length
  const score = {
    en: count(/\b(the|and|of|to|in|for|with|on|as|is|are|that|from)\b/g),
    no: count(/\b(og|i|på|av|til|for|med|er|som|det|ikke)\b/g),
    sv: count(/\b(och|i|på|av|till|för|med|är|som|det|inte)\b/g),
    da: count(/\b(og|i|på|af|til|for|med|er|som|det|ikke)\b/g),
  }
  // Penalize overlaps a bit
  score.no += count(/\bav\b/g)
  score.da += count(/\baf\b/g)
  // Pick max if sufficiently above others
  const entries = Object.entries(score) as Array<[keyof typeof score, number]>
  entries.sort((a, b) => b[1] - a[1])
  const [top, next] = entries
  if (!top || top[1] < 2) return 'unknown'
  if (next && top[1] - next[1] < 1) return 'unknown'
  return top[0]
}

function normalizeTargetLang(input: string | null | undefined): 'en' | 'no' | 'sv' | 'da' | 'unknown' {
  const s = (input || '').toLowerCase().trim()
  if (!s) return 'unknown'
  if (s === 'en' || /english/.test(s)) return 'en'
  if (s === 'no' || s === 'nb' || s === 'nn' || /norwegian|norsk/.test(s)) return 'no'
  if (s === 'sv' || /swedish|svenska/.test(s)) return 'sv'
  if (s === 'da' || /danish|dansk/.test(s)) return 'da'
  return 'unknown'
}

async function translateViaModel(model: string, text: string, target: string, referer?: string, promptText?: string | null, matchPrompt?: boolean | null): Promise<string> {
  try {
    console.log('[translate] Request', { model, target, matchPrompt, promptSamplePresent: Boolean(promptText), textPreview: text.slice(0, 200) })
  } catch {}
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      ...(referer ? { 'HTTP-Referer': referer } : {}),
      'X-Title': 'Hugin Translate',
    },
    body: JSON.stringify({
      model,
      temperature: 0.0,
      messages: [
        {
          role: 'system',
          content: [
            'You are a precise translator. Translate the user content to the requested target language.',
            'If match_prompt is true, first detect the language of the provided prompt sample and translate to that language.',
            'If match_prompt is true and no prompt sample is provided, DO NOT translate; return the text unchanged.',
            'If the source already matches the target language, return it exactly as-is (no paraphrasing).',
            'Never output a different language than the requested target. If unsure, keep the original language unchanged.',
            'Keep Markdown and bracketed citation IDs [n] and the Sources list intact. No explanations.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Target language: ${target}`,
            `match_prompt: ${matchPrompt ? 'true' : 'false'}`,
            promptText ? `prompt_sample: ${promptText}` : '',
            '',
            '---',
            '',
            text,
          ].filter(Boolean).join('\n'),
        },
      ],
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${model} error ${res.status}: ${t}`)
  }
  const data = await res.json()
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('No translation content')
  try {
    console.log('[translate] Response', { model, textPreview: content.slice(0, 200) })
  } catch {}
  return content
}

export async function POST(req: Request) {
  try {
    const accessError = await checkApiAccess()
    if (accessError) return accessError

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
    }

  const body = (await req.json()) as TranslateBody
    const text = (body.text || '').trim()
    const targetLanguage = (body.targetLanguage || '')?.trim()
    const matchPrompt = Boolean(body.matchPrompt)
    // Use only a small sample of the prompt for language detection to reduce payload size
    const promptText = (body.promptText || '')?.trim()
    const promptSample = promptText ? promptText.slice(0, 400) : ''
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    if (!targetLanguage && !matchPrompt) return NextResponse.json({ error: 'targetLanguage or matchPrompt is required' }, { status: 400 })

    // If we are asked to match the prompt language but have no sample,
    // return the text unchanged to avoid incorrect translations.
    if (matchPrompt && !promptText) {
      try { console.log('[translate] matchPrompt=true with no promptText; returning original text unchanged') } catch {}
      return NextResponse.json({ text, model: 'no-op' })
    }

    // Heuristic short-circuit: if source already matches target/prompt language, return unchanged
    try {
      const srcLang = detectLangHeuristic(text)
      if (matchPrompt && promptSample) {
        const promptLang = detectLangHeuristic(promptSample)
        if (srcLang !== 'unknown' && promptLang !== 'unknown' && srcLang === promptLang) {
          console.log('[translate] short-circuit (matchPrompt): same language detected; returning original')
          return NextResponse.json({ text, model: 'no-op' })
        }
      }
      const tgtLang = normalizeTargetLang(targetLanguage)
      if (!matchPrompt && tgtLang !== 'unknown' && srcLang !== 'unknown' && tgtLang === srcLang) {
        console.log('[translate] short-circuit (targetLanguage): same language detected; returning original')
        return NextResponse.json({ text, model: 'no-op' })
      }
    } catch {}

    // Cache key (keep prompt sample short to avoid oversized keys)
    const cacheKey = {
      route: 'translate',
      text,
      target: targetLanguage || 'match_prompt',
      matchPrompt,
      promptSample,
    }
    const cached = apiCache.get<{ text: string; model: string }>(cacheKey)
    if (cached) {
      try { console.log('[translate] cache hit') } catch {}
      return NextResponse.json(cached)
    }

    const referer = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined
  let lastErr: unknown = null
  for (const model of MODEL_ORDER) {
      try {
    const translated = await translateViaModel(model, text, targetLanguage || 'match_prompt', referer, promptSample || null, matchPrompt)
        const payload = { text: translated, model }
        // Store for a reasonable TTL (10 minutes) to avoid repeated translations of same text
        apiCache.set(cacheKey, payload, 10 * 60 * 1000)
        return NextResponse.json(payload)
      } catch (e) {
        lastErr = e
      }
    }
    return NextResponse.json({ error: 'All translation models failed', details: String(lastErr) }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
