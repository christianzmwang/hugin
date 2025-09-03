/*
  Direct upstream Parallel API smoke test.
  Requires PARALLEL_API_KEY in env (.env.local).
*/
import https from 'node:https'

const PARALLEL_BASE = 'https://api.parallel.ai'

function request<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }>{
  const payload = body ? Buffer.from(JSON.stringify(body)) : undefined
  const url = new URL(path, PARALLEL_BASE)
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'x-api-key': process.env.PARALLEL_API_KEY || '',
          'content-type': 'application/json',
          ...(payload ? { 'content-length': String(payload.length) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c as Buffer))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          try {
            const json = JSON.parse(text)
            resolve({ status: res.statusCode || 0, json })
          } catch (e) {
            reject(new Error(`Non-JSON response (status ${res.statusCode}): ${text}`))
          }
        })
      }
    )
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  if (!process.env.PARALLEL_API_KEY) {
    throw new Error('PARALLEL_API_KEY not set')
  }
  const create = await request<any>('POST', '/v1/tasks/runs', {
    input: 'Test research on a demo company. Company: Parallel Test Co',
    processor: 'lite',
    metadata: { kind: 'connectivity-test' },
  })
  console.log('Create:', create.status, create.json)
  if (create.status !== 200 && create.status !== 202) throw new Error('Create failed')
  const runId = (create.json as any).run_id
  if (!runId) throw new Error('Missing run_id')

  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    const res = await request<any>('GET', `/v1/tasks/runs/${encodeURIComponent(runId)}`)
    const status = (res.json as any)?.status
    console.log('Run status:', status)
    if (status === 'completed' || status === 'failed' || status === 'canceled') break

    // Try result endpoint quickly
    const result = await request<any>('GET', `/v1/tasks/runs/${encodeURIComponent(runId)}/result`).catch(() => null)
    if (result && result.status === 200) {
      console.log('Result ready (quick):', JSON.stringify(result.json).slice(0, 400))
      return
    }
    await sleep(5000)
  }
  // Final attempt to fetch result
  const final = await request<any>('GET', `/v1/tasks/runs/${encodeURIComponent(runId)}/result`).catch(() => null)
  if (final && final.status === 200) {
    console.log('Final result:', JSON.stringify(final.json).slice(0, 400))
    return
  }
  console.log('Done without result; check run in Parallel dashboard:', runId)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
