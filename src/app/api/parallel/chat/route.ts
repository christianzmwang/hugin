import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1','arn1','cdg1']
export const maxDuration = 60

// Primary (OpenAI-compatible) endpoint; we'll fallback to non-versioned if necessary.
const CHAT_ENDPOINTS = [
  'https://api.parallel.ai/chat/completions', // fallback (some keys/products may only expose this path)
]

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type ChatBody = { messages: ChatMessage[]; model?: string; stream?: boolean }

export async function POST(req: Request) {
  // NOTE: This implementation is intentionally fresh (no reuse of tasks/runs research code)
  try {
    const accessError = await checkApiAccess()
    if (accessError) return accessError
    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json({ error: 'Parallel API key not configured' }, { status: 500 })
    }
    const body = (await req.json().catch(() => ({}))) as ChatBody
    const messages = Array.isArray(body?.messages) ? body.messages.filter(m => m && typeof m.content === 'string') : []
    if (!messages.length) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 })
    }
    const model = (body?.model && typeof body.model === 'string') ? body.model : 'speed'
    const stream = body?.stream !== false // default true for interactive chat

    // Helper to perform request with automatic fallback if we see the "No products found" signature.
    const attemptRequest = async (streaming: boolean) => {
  const lastResp: Response | null = null
      for (let i = 0; i < CHAT_ENDPOINTS.length; i++) {
        const url = CHAT_ENDPOINTS[i]
        const hdrs: Record<string,string> = {
          'content-type': 'application/json',
          'authorization': `Bearer ${process.env.PARALLEL_API_KEY}`,
        }
        if (process.env.PARALLEL_API_KEY) hdrs['x-api-key'] = process.env.PARALLEL_API_KEY
        const resp = await fetch(url, {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({ model, messages, stream: streaming }),
          cache: 'no-store'
        })
        if (resp.status === 401) {
          // Try to parse body for fallback hint
          const txt = await resp.text().catch(() => '')
          let needFallback = false
          try {
            const j = JSON.parse(txt)
            if (j?.message && /No products found for path/i.test(String(j.message)) && url.includes('/v1/')) needFallback = true
          } catch {}
          if (needFallback && i < CHAT_ENDPOINTS.length - 1) {
            // Try next endpoint
            continue
          }
          // Reconstruct response with captured text
          return { resp, text: txt }
        }
        // Return first non-401 or non-fallback-401 response
        return { resp }
      }
      return { resp: lastResp }
    }

    if (!stream) {
      const { resp, text } = await attemptRequest(false)
      if (!resp || !resp.ok) {
        const bodyTxt = text ?? (resp ? await resp.text().catch(() => '') : '')
        return NextResponse.json({ error: 'Upstream chat failed', status: resp?.status || 502, details: bodyTxt }, { status: 502 })
      }
      const json = await resp.json().catch(() => null)
      return NextResponse.json(json)
    }

    const { resp: upstream, text: preBody } = await attemptRequest(true)
    if (!upstream || !upstream.ok || !upstream.body) {
      const txt = preBody ?? (upstream ? await upstream.text().catch(() => '') : '')
      return NextResponse.json({ error: 'Upstream chat failed', status: upstream?.status || 502, details: txt }, { status: 502 })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
  const reader = upstream.body!.getReader()
        let buffer = ''
        function push(line: string) {
          controller.enqueue(encoder.encode(line))
        }
        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              // Ensure termination signal for clients
              push('data: [DONE]\n\n')
              controller.close()
              return
            }
            buffer += decoder.decode(value, { stream: true })
            // Split on double newlines (SSE event boundary)
            const parts = buffer.split(/\n\n/)
            buffer = parts.pop() || ''
            for (const part of parts) {
              // Pass through only lines beginning with data:
              const trimmed = part.trimEnd()
              if (!trimmed) continue
              // Upstream is already SSE (should begin with data:) but we normalize
              const lines = trimmed.split(/\n/)
              for (const l of lines) {
                if (l.startsWith('data:')) {
                  push(l + '\n\n')
                } else {
                  // Wrap raw content as data: for robustness
                  push('data: ' + l + '\n\n')
                }
              }
            }
            read()
          }).catch(err => {
            try { push(`data: {"error":"stream_error","message":${JSON.stringify(String(err))}}\n\n`) } catch {}
            controller.close()
          })
        }
        read()
      }
    })

    return new Response(streamBody, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        // Allow client JS fetch streaming
        'transfer-encoding': 'chunked'
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected error', details: String(e) }, { status: 500 })
  }
}