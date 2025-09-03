import * as fs from 'fs'
import * as path from 'path'

type CsvData = {
  recommendation?: string | null
  rationale?: string | null
  allvitrScore?: number | null
}

class CsvCache {
  private cache = new Map<
    string,
    { set: Set<string>; map: Map<string, CsvData> }
  >()
  private lastLoaded = new Map<string, number>()
  private readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes - longer cache since CSV files don't change often

  private splitCsvLine(line: string): string[] {
    const out: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out
  }

  private loadCsvFile(csvPath: string): {
    set: Set<string>
    map: Map<string, CsvData>
  } {
    try {
      const content = fs.readFileSync(csvPath, 'utf8')
      const lines = content.split(/\r?\n/).filter(Boolean)
      if (lines.length === 0) return { set: new Set<string>(), map: new Map() }

      const header = lines.shift() as string
      const columns = this.splitCsvLine(header).map((c) =>
        c.trim().toLowerCase(),
      )
      const orgIdx = columns.findIndex((c) => c === 'orgnr')
      const recIdx = columns.findIndex((c) => c === 'recommendation')
      const ratIdx = columns.findIndex((c) => c === 'rationale')
      const scoreIdx = columns.findIndex((c) => c === 'allvitr_score')

      const set = new Set<string>()
      const map = new Map<string, CsvData>()

      if (orgIdx === -1) return { set, map }

      for (const line of lines) {
        const cols = this.splitCsvLine(line)
        const org = (cols[orgIdx] || '').trim()
        if (!org) continue

        set.add(org)
        const recommendation = recIdx >= 0 ? (cols[recIdx] || '').trim() : ''
        const rationale = ratIdx >= 0 ? (cols[ratIdx] || '').trim() : ''
        const scoreRaw = scoreIdx >= 0 ? (cols[scoreIdx] || '').trim() : ''
        const allvitrScore = scoreRaw ? Number.parseFloat(scoreRaw) : NaN

        map.set(org, {
          recommendation: recommendation || null,
          rationale: rationale || null,
          allvitrScore: Number.isFinite(allvitrScore) ? allvitrScore : null,
        })
      }

      return { set, map }
    } catch (error) {
      console.warn(`Failed to load CSV from ${csvPath}:`, error)
      return { set: new Set<string>(), map: new Map() }
    }
  }

  private getCacheKey(source: 'accounting' | 'consulting'): string {
    return source === 'accounting' ? 'contaData' : 'konsulentData'
  }

  private getFilePath(source: 'accounting' | 'consulting'): string {
    const filename =
      source === 'accounting' ? 'contaData.csv' : 'konsulentData.csv'
    return path.join(process.cwd(), 'public', 'csv', filename)
  }

  private shouldRefresh(cacheKey: string): boolean {
    const lastLoaded = this.lastLoaded.get(cacheKey) || 0
    return Date.now() - lastLoaded > this.CACHE_TTL
  }

  getCsvData(source: 'accounting' | 'consulting'): {
    set: Set<string>
    map: Map<string, CsvData>
  } {
    const cacheKey = this.getCacheKey(source)

    if (!this.cache.has(cacheKey) || this.shouldRefresh(cacheKey)) {
      console.log(`Loading CSV data for ${source}...`)
      const filePath = this.getFilePath(source)
      const data = this.loadCsvFile(filePath)
      this.cache.set(cacheKey, data)
      this.lastLoaded.set(cacheKey, Date.now())
      console.log(`Loaded ${data.set.size} organizations from ${source} CSV`)
    }

    return this.cache.get(cacheKey)!
  }

  // Preload all CSV files on startup
  preloadAll(): void {
    console.log('Preloading CSV data...')
    this.getCsvData('accounting')
    this.getCsvData('consulting')
    console.log('CSV data preloaded successfully')
  }

  // Clear cache (useful for development)
  clearCache(): void {
    this.cache.clear()
    this.lastLoaded.clear()
  }
}

// Singleton instance
export const csvCache = new CsvCache()

// Preload on module initialization in both development and production
// This prevents the slow loading on first request
csvCache.preloadAll()
