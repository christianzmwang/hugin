export function getDataApiBaseUrl(): string | null {
  const base = process.env.DATA_API_BASE_URL || ''
  const trimmed = base.trim()
  if (!trimmed) return null
  try {
    // Validate URL
    new URL(trimmed)
    return trimmed.replace(/\/$/, '')
  } catch {
    return null
  }
}

export async function proxyJson(path: string, reqUrl: string): Promise<Response> {
  const base = getDataApiBaseUrl()
  if (!base) return new Response('DATA_API_BASE_URL not configured', { status: 503 })
  const url = new URL(reqUrl)
  const dest = `${base}${path}${url.search}`
  const res = await fetch(dest, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } })
}


