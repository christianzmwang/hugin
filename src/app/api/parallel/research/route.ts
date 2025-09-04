import { NextResponse } from 'next/server'
import { checkApiAccess } from '@/lib/access-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = ['fra1', 'arn1', 'cdg1']
export const maxDuration = 60

const PARALLEL_BASE = 'https://api.parallel.ai'

type CreateBody = {
  companyName: string
  website?: string | null
  orgNumber?: string | null
  processor?: 'lite' | 'base' | 'core' | 'pro' | 'ultra'
  customInput?: string | null
  // Optional override for the company-specific input block.
  // If provided, this replaces the auto-generated lines with Company/Org/Website.
  companyInput?: string | null
  // A user-authored prompt that describes the research request.
  prompt?: string | null
  // Full input override: if provided, use as-is and ignore prompt/customInput/companyInput
  input?: string | null
  outputSchema?: string | null
}

export async function POST(req: Request) {
  try {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json({ error: 'Parallel API key not configured' }, { status: 500 })
    }

    const body = (await req.json()) as CreateBody
    const companyName = (body.companyName || '').trim()
    const website = (body.website || '')?.trim()
    const orgNumber = (body.orgNumber || '')?.trim()
  const processor = (body.processor as CreateBody['processor']) || 'pro'
  const prompt = (body.prompt || '')?.trim()
  const customInput = (body.customInput || '')?.trim()
  const companyInput = (body.companyInput || '')?.trim()
  const directInput = (body.input || '')?.trim()
  const providedOutputSchema = (body.outputSchema || '')?.trim()

    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 })
    }

  const input = directInput
    ? directInput
    : (() => {
        const inputParts: string[] = []
        if (prompt) inputParts.push(prompt)
        if (customInput) inputParts.push(customInput)
        if (companyInput) {
          inputParts.push(companyInput)
        } else {
          const companyLines: string[] = []
          companyLines.push(`Company: ${companyName}`)
          if (orgNumber) companyLines.push(`Org number: ${orgNumber}`)
          if (website) companyLines.push(`Website: ${website}`)
          inputParts.push(companyLines.join('\n'))
        }
        return inputParts.join('\n')
      })()

  // Output schema responsibility is external (DeepSeek compose). Use if provided; otherwise omit.
  const outputSchema = providedOutputSchema || undefined

    type TaskRunPayload = {
      input: string
      processor: CreateBody['processor']
      metadata?: { kind: string; orgNumber?: string | null }
      task_spec?: { output_schema: string }
    }

    const payload: TaskRunPayload = {
      input,
      processor,
      metadata: { kind: 'company-deep-research', orgNumber },
    }
    if (outputSchema) payload.task_spec = { output_schema: outputSchema }

    try {
      console.log('[parallel] creating run', {
        processor,
        orgNumber,
        hasOutputSchema: Boolean(outputSchema),
        inputPreview: input.slice(0, 140),
      })
    } catch {}

    const createResp = await fetch(`${PARALLEL_BASE}/v1/tasks/runs`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PARALLEL_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      // Do not reuse Next fetch cache
      cache: 'no-store',
    })

    if (!createResp.ok) {
      const status = createResp.status
      const retryAfter = createResp.headers.get('retry-after')
      const text = await createResp.text().catch(() => '')
      if (status === 429) {
        return NextResponse.json(
          { error: 'Rate limited by Parallel', code: 'rate_limited', retryAfterSec: retryAfter ? Number(retryAfter) : undefined, details: text },
          { status: 429 }
        )
      }
      if (status === 401) {
        return NextResponse.json(
          { error: 'Unauthorized with Parallel API', code: 'unauthorized', details: text },
          { status: 401 }
        )
      }
      if (status === 403) {
        return NextResponse.json(
          { error: 'Forbidden by Parallel API', code: 'forbidden', details: text },
          { status: 403 }
        )
      }
      if (status === 422) {
        return NextResponse.json(
          { error: 'Invalid request to Parallel', code: 'invalid_request', details: text },
          { status: 422 }
        )
      }
      return NextResponse.json({ error: 'Failed to create task run', code: 'upstream_error', details: text }, { status: 502 })
    }

  const created: unknown = await createResp.json()
  const runId: string | undefined = (created as { run_id?: string } | undefined)?.run_id
    try {
      console.log('[parallel] run created', { runId })
    } catch {}
    if (!runId) {
      return NextResponse.json({ error: 'Missing run_id from Parallel' }, { status: 502 })
    }

  // Return immediately; client will poll for result
  try { console.log('[parallel] queued (client will poll)', { runId }) } catch {}
  return NextResponse.json({ runId, status: 'queued' }, { status: 202 })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
  const accessError = await checkApiAccess()
  if (accessError) return accessError

    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json({ error: 'Parallel API key not configured' }, { status: 500 })
    }
    const { searchParams } = new URL(req.url)
    const runId = searchParams.get('runId')?.trim()
    if (!runId) return NextResponse.json({ error: 'runId is required' }, { status: 400 })
    
  // Optional client-controlled long-poll wait in seconds (default 25s, capped to 55s)
  const waitParam = searchParams.get('waitSec')
  const parsedWait = Number(waitParam)
  const hasValidWait = waitParam !== null && waitParam.trim() !== '' && Number.isFinite(parsedWait)
  const waitSec = hasValidWait ? Math.max(0, Math.min(55, Math.floor(parsedWait))) : 25
  const retryAfterSec = Math.max(5, Math.min(30, Math.floor(waitSec / 2) || 5))
  try { console.log('[parallel] polling (GET)', { runId, waitSec, retryAfterSec }) } catch {}

  // Try to get the result with a configurable timeout; if slow or not ready, fall back to status.
  const resultTimeoutMs = waitSec * 1000
    const resultCtl = new AbortController()
    const resultTimer = setTimeout(() => resultCtl.abort('timeout'), resultTimeoutMs)
    let resultFetched = false
    try {
      const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${encodeURIComponent(runId)}/result`, {
        headers: { 'x-api-key': process.env.PARALLEL_API_KEY },
        cache: 'no-store',
        signal: resultCtl.signal,
      })
      if (res.ok) {
        const raw = await res.json()
        // Normalize various possible result shapes into { output: { content?|text?, basis? } }
        const normalize = (input: unknown): { output: Record<string, unknown> } => {
          try {
            const anyIn = input as Record<string, unknown> | null
            const out: Record<string, unknown> = {}
            const maybeOutput = (anyIn && typeof anyIn === 'object' ? (anyIn as Record<string, unknown>).output : undefined) as
              | Record<string, unknown>
              | undefined
            const output: Record<string, unknown> = maybeOutput && typeof maybeOutput === 'object' ? { ...maybeOutput } : {}
            // Prefer existing output.content/text if present
            const topContent = anyIn && typeof anyIn === 'object' ? (anyIn as Record<string, unknown>).content : undefined
            const topText = anyIn && typeof anyIn === 'object' ? (anyIn as Record<string, unknown>).text : undefined
            if (output.content === undefined && topContent !== undefined) output.content = topContent
            if (output.text === undefined && typeof topText === 'string') output.text = topText
            // Basis may be at either level
            const topBasis = anyIn && typeof anyIn === 'object' ? (anyIn as Record<string, unknown>).basis : undefined
            if (output.basis === undefined && topBasis !== undefined) output.basis = topBasis
            // Fallback: if neither content nor text present but output exists, try to stringify output
            if (output.content === undefined && output.text === undefined && maybeOutput && Object.keys(output).length > 0) {
              try { output.text = JSON.stringify(output) } catch {}
            }
            // Finalize
            return { output }
          } catch {
            // Last resort: wrap as text
            return { output: { text: String(input) } }
          }
        }
        const result = normalize(raw)
        resultFetched = true
        try { console.log('[parallel] result ready', { runId }) } catch {}
        return NextResponse.json({ runId, status: 'completed', result })
      }
      // Non-200 means not ready; fall through to status
      try { console.log('[parallel] result not ready (non-200), checking status', { runId, status: res.status }) } catch {}
    } catch (e) {
      // Timeout or network error: treat as not-ready, fall back to status
      try { console.warn('[parallel] result fetch failed/timeout, checking status', { runId, error: String(e) }) } catch {}
    } finally {
      clearTimeout(resultTimer)
    }

    // Fall back to run status to inform client
    // Fetch run status with a short timeout as well
    const statusTimeoutMs = 8_000
    const statusCtl = new AbortController()
    const statusTimer = setTimeout(() => statusCtl.abort('timeout'), statusTimeoutMs)
    try {
      const runRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${encodeURIComponent(runId)}`, {
        headers: { 'x-api-key': process.env.PARALLEL_API_KEY },
        cache: 'no-store',
        signal: statusCtl.signal,
      })
      if (runRes.ok) {
        const run = await runRes.json()
        try { console.log('[parallel] still waiting', { runId, status: run?.status }) } catch {}
        const { searchParams } = new URL(req.url)
        const includeDetails = Boolean(searchParams.get('details'))

        // If the run is queued for longer than the long end of its time estimate,
        // short-circuit and inform the client it's likely stuck.
        const statusStr: string = run?.status ?? 'queued'
        if (statusStr === 'queued') {
          // Try to compute elapsed queue time
          const createdStr: string | undefined = run?.created_at || run?.queued_at || run?.submitted_at
          const createdMs = createdStr ? Date.parse(createdStr) : NaN
          const nowMs = Date.now()
          const elapsedSec = Number.isFinite(createdMs) ? Math.max(0, Math.floor((nowMs - createdMs) / 1000)) : null

          // Attempt to read a variety of potential "max estimate" fields from the upstream run
          const estimateCandidates: Array<number | undefined> = [
            // Common shapes
            run?.time_estimate?.max,
            run?.eta?.max,
            run?.eta_seconds?.max,
            // Flat numeric fields
            run?.eta_seconds_max,
            run?.eta_sec_max,
            run?.estimated_duration_max_sec,
            // Nested duration estimates
            run?.duration_estimate?.max_sec,
            run?.estimated_duration?.max_sec,
          ]
          const longEndFromApi = estimateCandidates.find((v) => typeof v === 'number' && Number.isFinite(v) && v! > 0)

          // Sensible defaults by processor, if known; otherwise fall back to 120s
          const processor: string | undefined = run?.processor
          const defaultMaxByProc = processor === 'lite' ? 90 : processor === 'pro' ? 180 : processor === 'ultra' ? 240 : 120
          const longEndSec = (longEndFromApi as number | undefined) ?? defaultMaxByProc
          const graceSec = 10

          if (elapsedSec !== null && elapsedSec > longEndSec + graceSec) {
            const payload = includeDetails
              ? { runId, status: 'stuck', reason: 'stuck_in_queue', message: 'Run appears stuck in queue', elapsedSec, estimateSec: longEndSec, run }
              : { runId, status: 'stuck', reason: 'stuck_in_queue', message: 'Run appears stuck in queue', elapsedSec, estimateSec: longEndSec }
            return NextResponse.json(payload, { status: 202, headers: { 'Retry-After': String(retryAfterSec) } })
          }
        }

        return NextResponse.json(
          includeDetails ? { runId, status: statusStr, run } : { runId, status: statusStr },
          { status: 202, headers: { 'Retry-After': String(retryAfterSec) } }
        )
      }
      try { console.warn('[parallel] status fetch non-200, defaulting to queued', { runId, http: runRes.status }) } catch {}
    } catch (e) {
      try { console.warn('[parallel] status fetch failed/timeout, defaulting to queued', { runId, error: String(e) }) } catch {}
    } finally {
      clearTimeout(statusTimer)
    }

    try { console.warn('[parallel] status unknown, defaulting to queued', { runId }) } catch {}
  return NextResponse.json(
    { runId, status: 'queued' },
    { status: 202, headers: { 'Retry-After': String(retryAfterSec) } }
  )
  } catch (err) {
  // Do not bubble intermittent network errors to 500 for client polling; report as queued
  try { console.warn('[parallel] GET crashed, reporting queued', { error: String(err) }) } catch {}
  return NextResponse.json(
    { status: 'queued' },
    { status: 202, headers: { 'Retry-After': '10' } }
  )
  }
}