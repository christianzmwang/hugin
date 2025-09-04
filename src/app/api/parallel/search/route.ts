import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1','arn1','cdg1']
export const maxDuration = 30

// Parallel Search API (beta) endpoint
const SEARCH_ENDPOINT = 'https://api.parallel.ai/v1beta/search'

type SearchBody = {
  objective?: string | null
  searchQueries?: string[] | null // camelCase input accepted
  search_queries?: string[] | null // snake_case input accepted
  processor?: 'base' | 'pro'
  maxResults?: number | null
  maxCharsPerResult?: number | null
  sourcePolicy?: unknown // Pass-through (user provides valid policy object per docs)
  source_policy?: unknown
}

// POST /api/parallel/search
// Lightweight wrapper over Parallel Search API with validation & constraints.
export async function POST(req: Request) {
  try {
    // Allow unauthenticated usage if explicitly opted-in via ?public=1 (e.g., for internal smoke tests)
    const url = new URL(req.url)
    const isPublic = url.searchParams.get('public') === '1'
    if (!isPublic) {
      const accessError = await checkApiAccess()
      if (accessError) return accessError
    }
    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json({ error: 'Parallel API key not configured' }, { status: 500 })
    }

    const body = (await req.json().catch(() => ({}))) as SearchBody
    let objective = typeof body.objective === 'string' ? body.objective.trim() : ''
    let searchQueries: string[] = Array.isArray(body.searchQueries) ? body.searchQueries as string[] : Array.isArray(body.search_queries) ? body.search_queries as string[] : []
    searchQueries = searchQueries.filter(q => typeof q === 'string' && q.trim()).map(q => q.trim())

    // Enforce requirement: at least one of objective or search_queries
    if (!objective && !searchQueries.length) {
      return NextResponse.json({ error: 'objective or searchQueries required' }, { status: 400 })
    }

    // Length constraints per docs
    if (objective.length > 5000) objective = objective.slice(0, 5000)
    if (searchQueries.length > 5) searchQueries = searchQueries.slice(0, 5)
    searchQueries = searchQueries.map(q => q.length > 200 ? q.slice(0, 200) : q)

    // Processor defaults to base
    const processor: 'base' | 'pro' = body.processor === 'pro' ? 'pro' : 'base'
    // Clamp max results (fallback to 5); processor-specific hard limits not enforced here but we keep sane bounds (1-25)
    let maxResults = typeof body.maxResults === 'number' ? body.maxResults : undefined
    if (maxResults !== undefined && !Number.isFinite(maxResults)) maxResults = undefined
    maxResults = maxResults === undefined ? 5 : Math.min(25, Math.max(1, Math.floor(maxResults)))
    // Clamp chars per result (min 100, max 30000; docs note >30000 not guaranteed)
    let maxCharsPerResult = typeof body.maxCharsPerResult === 'number' ? body.maxCharsPerResult : undefined
    if (maxCharsPerResult !== undefined && !Number.isFinite(maxCharsPerResult)) maxCharsPerResult = undefined
    maxCharsPerResult = maxCharsPerResult === undefined ? 1500 : Math.min(30000, Math.max(100, Math.floor(maxCharsPerResult)))

    const sourcePolicy = body.sourcePolicy ?? body.source_policy

    const payload: Record<string, unknown> = {
      processor,
      max_results: maxResults,
      max_chars_per_result: maxCharsPerResult,
    }
    if (objective) payload.objective = objective
    if (searchQueries.length) payload.search_queries = searchQueries
    if (sourcePolicy && typeof sourcePolicy === 'object') payload.source_policy = sourcePolicy

  try { console.log('[parallel-search] request', { processor, public: isPublic, objectivePreview: objective.slice(0,120), queries: searchQueries }) } catch {}

    const upstream = await fetch(SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.PARALLEL_API_KEY,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return NextResponse.json({ error: 'Parallel search failed', status: upstream.status, details: text }, { status: upstream.status })
    }
    const json = await upstream.json().catch(() => null)
    return NextResponse.json(json, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
