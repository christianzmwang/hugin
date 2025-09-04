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
  // Optional user company profile (from /api/user/business-context) so AI can leverage it only when relevant
  const [userCompanyProfile, setUserCompanyProfile] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/user/business-context', { cache: 'no-store' })
        if (!res.ok) return
        const raw: unknown = await res.json().catch(() => ({}))
        type BusinessContextObj = { businessContext?: unknown; shape?: string }
        const data: BusinessContextObj = (typeof raw === 'object' && raw) ? raw as BusinessContextObj : {}
        let block: string | null = null
        if (data.shape === 'object' && data.businessContext && typeof data.businessContext === 'object' && data.businessContext !== null) {
          const bc = data.businessContext as Record<string, string>
          const lines: string[] = []
          if (bc.businessName) lines.push(`Business name: ${bc.businessName}`)
          if (bc.orgNumber) lines.push(`Business org number: ${bc.orgNumber}`)
          if (bc.delivers) lines.push(`Delivers: ${bc.delivers}`)
          if (bc.icp) lines.push(`ICP: ${bc.icp}`)
          if (lines.length) block = lines.join('\n')
        } else if (data.shape === 'string' && typeof data.businessContext === 'string') {
          const txt = (data.businessContext as string).trim()
          if (txt) block = txt.slice(0, 2000)
        }
        if (!cancelled) setUserCompanyProfile(block)
      } catch {/* silent */}
    }
    loadProfile()
    return () => { cancelled = true }
  }, [])

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
      // Heuristic: if the user asks a generic company-specific metric (e.g. CEO) without naming the company, explicitly anchor it.
      const needsCompanyInjection = /\bceo\b|chief executive|revenue|profit|employees|founder|ownership|competitor/i.test(userMsg.content) && !new RegExp(companyName, 'i').test(userMsg.content)
      const augmentedUserContent = needsCompanyInjection
        ? `${userMsg.content}\n\n(Above question refers to the company ${companyName}${orgNumber ? ` (Org ${orgNumber})` : ''}.)`
        : userMsg.content
  const payload = {
        model: 'speed',
        stream: true,
        messages: [
          // System guidance: provide comprehensive, well-sourced responses
          { role: 'system', content: [
            `You are a business research assistant specializing in providing detailed, well-sourced information about companies. Focus on the target company: ${companyName}${orgNumber ? ` (Org ${orgNumber})` : ''}.`,
            '',
            'Response Guidelines:',
            '• Provide comprehensive answers with proper context and explanations',
            '• When you have factual information, include relevant details that help users understand the significance',
            '• Structure your responses clearly with explanations of what the information means',
            '• If you have access to data sources, include source attribution (publication dates, source names, etc.)',
            '• For key metrics or facts, provide context about industry standards, historical trends, or comparative information when relevant',
            '• When information may be outdated (older than 24 months), explicitly mention this limitation',
            '',
            'Content Rules:',
            '• Never ask which company is meant unless the user explicitly names a different company; all ambiguous questions are about the target company',
            '• Treat short or ambiguous questions (e.g. "CEO?", "revenue last year", "competitors") as referring to this company unless the user clearly switches topic',
            '• Only use information that is directly relevant to the user\'s current question. If some provided context is not needed, ignore it',
            '• If you lack specific information, clearly state what you don\'t know and suggest what type of sources might have that information',
            '• Never invent or fabricate information - only use data you can verify or that comes from reliable sources',
            '',
            'Response Format:',
            '• For executive information (CEO, CFO, etc.): Include full name, title, background, tenure, and any notable achievements or experience',
            '• For financial data: Include specific numbers with units, time periods, growth trends, and industry context when available',
            '• For company metrics: Provide the data point along with context about company size, industry position, and significance',
            '• For competitive information: Include context about market position, differentiation, and comparative analysis',
            '• Use clear, professional language that explains technical concepts when needed',
            '• Avoid overly terse responses like JSON objects - provide enough narrative context to be genuinely helpful',
            '• When citing sources, include publication dates, source credibility, and any limitations of the data',
    userCompanyProfile ? '\nUser company profile (ONLY use if directly relevant to the question; ignore otherwise):\n' + userCompanyProfile : undefined
          ].filter(Boolean).join('\n') },
          ...messages.filter(m => m.role !== 'assistant' || m.content.trim()),
          { role: 'user', content: augmentedUserContent },
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
      const err = e as unknown
      if (err && typeof err === 'object' && 'name' in err && (err as { name?: unknown }).name === 'AbortError') {
        setError('Avbrutt')
      } else {
        setError((err as Error)?.message || 'Ukjent feil')
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, companyName, orgNumber, userCompanyProfile])

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
            <div className="whitespace-pre-wrap leading-relaxed">{m.content || (m.role === 'assistant' && isStreaming ? <span className="opacity-60">Søker…</span> : '')}</div>
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
