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

    const payload: any = {
      input,
      processor,
      metadata: { kind: 'company-deep-research', orgNumber },
    }
    if (outputSchema) payload.task_spec = { output_schema: outputSchema }

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

    const created = await createResp.json()
    const runId: string | undefined = created?.run_id
    if (!runId) {
      return NextResponse.json({ error: 'Missing run_id from Parallel' }, { status: 502 })
    }

    // Optionally do a short, bounded poll for quick completions
    const pollUntil = Date.now() + 10_000 // poll up to 10s
    let result: any | null = null
    while (Date.now() < pollUntil) {
      const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${encodeURIComponent(runId)}/result`, {
        headers: { 'x-api-key': process.env.PARALLEL_API_KEY },
        cache: 'no-store',
      })
      if (res.ok) {
        result = await res.json()
        break
      }
      // small backoff
      await new Promise((r) => setTimeout(r, 1200))
    }

    if (result) {
      return NextResponse.json({ runId, status: 'completed', result })
    }
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

    const res = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${encodeURIComponent(runId)}/result`, {
      headers: { 'x-api-key': process.env.PARALLEL_API_KEY },
      cache: 'no-store',
    })

    if (res.ok) {
      const result = await res.json()
      return NextResponse.json({ runId, status: 'completed', result })
    }

    // Fall back to run status to inform client
    const runRes = await fetch(`${PARALLEL_BASE}/v1/tasks/runs/${encodeURIComponent(runId)}`, {
      headers: { 'x-api-key': process.env.PARALLEL_API_KEY },
      cache: 'no-store',
    })
    if (runRes.ok) {
      const run = await runRes.json()
      return NextResponse.json({ runId, status: run?.status ?? 'queued' }, { status: 202 })
    }

    return NextResponse.json({ runId, status: 'queued' }, { status: 202 })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
