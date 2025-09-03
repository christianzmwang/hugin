/*
  Minimal smoke test for /api/parallel/research
  - Creates a run
  - Polls until completed/failed or timeout
*/
import http from 'node:http'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

function httpRequest<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }>
{
  const payload = body ? Buffer.from(JSON.stringify(body)) : undefined
  const url = new URL(path, BASE)
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        headers: {
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

async function main() {
  // 1) Create a run
  const create = await httpRequest<{ runId: string }>('POST', '/api/parallel/research', {
    companyName: 'Parallel Test Co',
    website: 'https://example.com',
    orgNumber: '123456-7890',
    processor: 'lite',
    prompt: 'Do a quick research summary.',
  })
  console.log('Create:', create)
  if (create.status !== 202) throw new Error('Create failed')
  const runId = (create.json as any).runId
  if (!runId) throw new Error('Missing runId')

  const deadline = Date.now() + 5 * 60_000 // 5 minutes
  // 2) Poll for result
  while (Date.now() < deadline) {
    const poll = await httpRequest<any>('GET', `/api/parallel/research?runId=${encodeURIComponent(runId)}&waitSec=20&details=1`)
    console.log('Poll:', poll.status, poll.json?.status)
    if (poll.status === 200 && poll.json?.status === 'completed') {
      console.log('Result snippet:', JSON.stringify(poll.json?.result)?.slice(0, 400))
      return
    }
    if (poll.status >= 400) throw new Error('Polling error: ' + JSON.stringify(poll.json))
  }
  throw new Error('Timed out waiting for completion')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
