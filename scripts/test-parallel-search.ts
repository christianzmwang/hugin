/*
  Smoke test for /api/parallel/search
  - Issues a search request
  - Verifies basic shape of response
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
          } catch {
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
  const create = await httpRequest<any>('POST', '/api/parallel/search?public=1', {
    objective: "When was the United Nations established? Prefer UN's websites.",
    searchQueries: [
      'Founding year UN',
      'Year of founding United Nations'
    ],
    processor: 'base',
    maxResults: 3,
    maxCharsPerResult: 800,
  })
  console.log('Search response status:', create.status)
  if (create.status !== 200) throw new Error('Search failed: ' + JSON.stringify(create.json))
  if (!Array.isArray(create.json?.results)) throw new Error('Missing results array')
  console.log('First result snippet:', JSON.stringify(create.json.results[0])?.slice(0, 300))
}

main().catch(e => { console.error(e); process.exit(1) })
