import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'

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
    const promptText = (body.promptText || '')?.trim()
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    if (!targetLanguage && !matchPrompt) return NextResponse.json({ error: 'targetLanguage or matchPrompt is required' }, { status: 400 })

    // If we are asked to match the prompt language but have no sample,
    // return the text unchanged to avoid incorrect translations.
    if (matchPrompt && !promptText) {
      try { console.log('[translate] matchPrompt=true with no promptText; returning original text unchanged') } catch {}
      return NextResponse.json({ text, model: 'no-op' })
    }

    const referer = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || undefined
  let lastErr: unknown = null
  for (const model of MODEL_ORDER) {
      try {
    const translated = await translateViaModel(model, text, targetLanguage || 'match_prompt', referer, promptText || null, matchPrompt)
        return NextResponse.json({ text: translated, model })
      } catch (e) {
        lastErr = e
      }
    }
    return NextResponse.json({ error: 'All translation models failed', details: String(lastErr) }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
