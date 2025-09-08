export function formatEventDate(dateValue: unknown): string {
  if (dateValue == null) return ''
  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (/^\d{4}$/.test(trimmed)) return trimmed
      const date = new Date(trimmed)
      return isNaN(date.getTime()) ? trimmed : date.toLocaleDateString()
    }
    if (typeof dateValue === 'number') {
      const yearCandidate = String(dateValue)
      if (/^\d{4}$/.test(yearCandidate)) return yearCandidate
      const date = new Date(dateValue)
      return isNaN(date.getTime()) ? yearCandidate : date.toLocaleDateString()
    }
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? '' : dateValue.toLocaleDateString()
    }
    const asString = String(dateValue)
    if (/^\d{4}$/.test(asString)) return asString
    const date = new Date(asString)
    return isNaN(date.getTime()) ? asString : date.toLocaleDateString()
  } catch { return String(dateValue) }
}

export function formatDateEU(dateValue: unknown): string {
  if (dateValue == null) return ''
  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim()
      if (/^\d{4}$/.test(trimmed)) return trimmed
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      return trimmed
    }
    if (typeof dateValue === 'number') {
      const d = new Date(dateValue)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      return String(dateValue)
    }
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        return dateValue.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      }
      return ''
    }
    const d = new Date(String(dateValue))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return String(dateValue)
  } catch { return '' }
}
