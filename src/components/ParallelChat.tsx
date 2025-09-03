'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

type ChatMessage = { role: 'user' | 'assistant'; content: string; id: string }

interface ParallelChatProps {
  companyName: string
  orgNumber?: string | null
}

// Utility to generate simple ids (avoid crypto for bundle size)
function rid() { return Math.random().toString(36).slice(2, 10) }

export default function ParallelChat({ companyName, orgNumber }: ParallelChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: rid(), role: 'assistant', content: `Du kan stille raske spørsmål om ${companyName}.` },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll on new assistant content
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const send = useCallback(async () => {
    if (!input.trim() || isStreaming) return
    setError(null)
    const userMsg: ChatMessage = { id: rid(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsStreaming(true)
    const assistantId = rid()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    const ctl = new AbortController()
    abortRef.current = ctl
    try {
      const payload = {
        model: 'speed',
        stream: true,
        messages: [
          // Provide lightweight system context so upstream has company context; kept minimal per docs
          { role: 'system', content: `Answer concisely. Company context: ${companyName}${orgNumber ? ` (Org ${orgNumber})` : ''}. Cite sources if provided.` },
          ...messages.filter(m => m.role !== 'assistant' || m.content.trim()),
          { role: 'user', content: userMsg.content },
        ],
      }
      const res = await fetch('/api/parallel/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Feil (${res.status})`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const append = (chunk: string) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m))
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(/\n\n/)
        buffer = parts.pop() || ''
        for (const p of parts) {
          const line = p.trim()
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') {
              abortRef.current = null
              break
            }
            // Try parse JSON delta, else treat as raw text
            try {
              const json = JSON.parse(data)
              // OpenAI style: choices[0].delta.content
              const delta = json?.choices?.[0]?.delta?.content
              if (typeof delta === 'string') append(delta)
              else if (typeof json?.content === 'string') append(json.content)
            } catch {
              // Fallback: raw token text
              if (data) append(data)
            }
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        setError('Avbrutt')
      } else {
        setError((e as Error)?.message || 'Ukjent feil')
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, companyName, orgNumber])

  const stop = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="border border-white/10 p-4 mb-6 bg-white/5">
      <h3 className="text-lg font-semibold mb-3">Hurtig Chat</h3>
      <div ref={scrollRef} className="max-h-64 overflow-y-auto pr-2 text-sm space-y-3 mb-3">
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-white' : 'text-gray-200'}>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">{m.role === 'user' ? 'Du' : 'Hugin'}</div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content || (m.role === 'assistant' && isStreaming ? <span className="opacity-60">Skriver…</span> : '')}</div>
          </div>
        ))}
      </div>
      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
      <div className="flex items-start gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isStreaming}
          placeholder={`Spør om ${companyName}`}
          rows={1}
          className="flex-1 bg-black border border-white/20 text-sm px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-red-600/70 resize-none min-h-[40px]"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault(); send()
            }
          }}
        />
        {isStreaming ? (
          <button onClick={stop} className="h-10 px-4 border border-red-600/60 text-white text-sm hover:bg-red-600/20">Stopp</button>
        ) : (
          <button onClick={send} disabled={!input.trim()} className={`h-10 px-4 border text-sm ${input.trim() ? 'border-white/20 text-white/90 hover:bg-red-600/20 hover:border-red-600/60' : 'border-white/10 text-white/40'}`}>Send</button>
        )}
      </div>
    </div>
  )
}
