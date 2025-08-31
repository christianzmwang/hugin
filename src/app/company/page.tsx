'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ALLOWED_USERS } from '@/lib/constants'

type Business = {
  orgNumber: string
  name: string
  website: string | null
  employees: number | null
  addressStreet: string | null
  addressPostalCode: string | null
  addressCity: string | null
  ceo: string | null
  fiscalYear?: number | null
  revenue?: string | number | null
  profit?: string | number | null
  totalAssets?: string | number | null
  equity?: string | number | null
  employeesAvg?: number | null
  industryCode1?: string | null
  industryText1?: string | null
  industryCode2?: string | null
  industryText2?: string | null
  industryCode3?: string | null
  industryText3?: string | null
  vatRegistered?: boolean | null
  vatRegisteredDate?: string | null
  sectorCode?: string | null
  sectorText?: string | null
  orgFormCode?: string | null
  orgFormText?: string | null
  hasEvents?: boolean | null
  eventScore?: number | null
  eventWeightedScore?: number | null
  // Comprehensive financial data from Power Office
  operatingIncome?: string | number | null
  operatingResult?: string | number | null
  profitBeforeTax?: string | number | null
  valuta?: string | null
  fraDato?: string | null
  tilDato?: string | null
  sumDriftsinntekter?: string | number | null
  driftsresultat?: string | number | null
  aarsresultat?: string | number | null
  sumEiendeler?: string | number | null
  sumEgenkapital?: string | number | null
  sumGjeld?: string | number | null
  reports?: Array<{
    fiscalYear: number
    revenue: string
    operatingIncome: string
    operatingResult: string
    profitBeforeTax: string
    profit: string
    totalAssets: string
    equity: string
    valuta: string
    fraDato: string
    tilDato: string
    sumDriftsinntekter: string
    driftsresultat: string
    aarsresultat: string
    sumEiendeler: string
    sumEgenkapital: string
    sumGjeld: string
  }>
  // Website analysis data
  webFinalUrl?: string | null
  webStatus?: number | null
  webElapsedMs?: number | null
  webIp?: string | null
  webTlsValid?: boolean | null
  webTlsNotBefore?: string | null
  webTlsNotAfter?: string | null
  webTlsDaysToExpiry?: number | null
  webTlsIssuer?: string | null
  webPrimaryCms?: string | null
  webCmsWordpress?: boolean | null
  webCmsDrupal?: boolean | null
  webCmsJoomla?: boolean | null
  webCmsTypo3?: boolean | null
  webCmsShopify?: boolean | null
  webCmsWix?: boolean | null
  webCmsSquarespace?: boolean | null
  webCmsWebflow?: boolean | null
  webCmsGhost?: boolean | null
  webCmsDuda?: boolean | null
  webCmsCraft?: boolean | null
  webEcomWoocommerce?: boolean | null
  webEcomMagento?: boolean | null
  webPayStripe?: boolean | null
  webPayPaypal?: boolean | null
  webPayKlarna?: boolean | null
  webAnalyticsGa4?: boolean | null
  webAnalyticsGtm?: boolean | null
  webAnalyticsUa?: boolean | null
  webAnalyticsFbPixel?: boolean | null
  webAnalyticsLinkedin?: boolean | null
  webAnalyticsHotjar?: boolean | null
  webAnalyticsHubspot?: boolean | null
  webJsReact?: boolean | null
  webJsVue?: boolean | null
  webJsAngular?: boolean | null
  webJsNextjs?: boolean | null
  webJsNuxt?: boolean | null
  webJsSvelte?: boolean | null
  webHasEmailText?: boolean | null
  webHasPhoneText?: boolean | null
  webHtmlKb?: number | null
  webHtmlKbOver500?: boolean | null
  webHeaderServer?: string | null
  webHeaderXPoweredBy?: string | null
  webSecurityHsts?: boolean | null
  webSecurityCsp?: boolean | null
  webCookiesPresent?: boolean | null
  webCdnHint?: string | null
  webServerHint?: string | null
  webRiskFlags?: string | null
  webErrors?: string | null
  webCmsWordpressHash?: string | null
  webRiskPlaceholderKw?: boolean | null
  webRiskParkedKw?: boolean | null
  webRiskSuspendedKw?: boolean | null
}

type EventItem = {
  id?: string | number
  title?: string | null
  description?: string | null
  date?: string | null
  url?: string | null
  source?: string | null
  score?: number | null
  orgNumber?: string | null
  businessName?: string | null
}

const numberFormatter: Intl.NumberFormat = (() => {
  try {
    return new Intl.NumberFormat('nb-NO')
  } catch {
    try {
      return new Intl.NumberFormat('no')
    } catch {
      return new Intl.NumberFormat()
    }
  }
})()

function formatEventDate(dateValue: unknown): string {
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
  } catch {
    return String(dateValue)
  }
}

export default function CompanyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [topCompany, setTopCompany] = useState<Business | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<Array<{ name: string; orgNumber: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [businessStats, setBusinessStats] = useState<{
    totalCompanies: number
    totalEvents: number
    companiesWithEvents: number
  } | null>(null)
  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ name: string; orgNumber: string }>>([])

  // Load recently viewed companies from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentlyViewedCompanies')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentlyViewed(parsed.slice(0, 20)) // Keep only last 20
        }
      }
    } catch (error) {
      console.error('Failed to load recently viewed companies:', error)
    }
  }, [])

  // Add company to recently viewed
  const addToRecentlyViewed = (company: { name: string; orgNumber: string }) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(c => c.orgNumber !== company.orgNumber)
      const updated = [company, ...filtered].slice(0, 20) // Keep only last 20
      try {
        localStorage.setItem('recentlyViewedCompanies', JSON.stringify(updated))
      } catch (error) {
        console.error('Failed to save recently viewed companies:', error)
      }
      return updated
    })
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    const userEmail = session.user?.email
    if (userEmail && !ALLOWED_USERS.includes(userEmail)) {
      router.push('/countdown')
      return
    }
  }, [status, session, router])

  // Fetch company data
  useEffect(() => {
    if (status !== 'authenticated') return
    
    let cancelled = false
    
    const fetchCompanyData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Check if orgNumber is provided in URL
        const orgNumberFromUrl = searchParams.get('orgNumber')
        
        if (orgNumberFromUrl) {
          // Fetch specific company by orgNumber
          const params = new URLSearchParams({
            q: orgNumberFromUrl,
            limit: '1'
          })
          
          const response = await fetch(`/api/businesses?${params.toString()}`)
          if (!response.ok) throw new Error('Failed to fetch company')
          
          const data = await response.json()
          const items = Array.isArray(data) ? data : data.items || []
          
          if (cancelled) return
          
          if (items.length > 0) {
            const company = items[0] as Business
            setTopCompany(company)
            
            // Add to recently viewed
            addToRecentlyViewed({
              name: company.name,
              orgNumber: company.orgNumber
            })
            
            // Fetch events for this company
            const eventsParams = new URLSearchParams({
              orgNumber: company.orgNumber,
              limit: '50'
            })
            
                         const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
             if (eventsResponse.ok) {
               const eventsData = await eventsResponse.json()
               const eventItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
               if (!cancelled) {
                 setEvents(eventItems)
               }
             }
          } else {
            if (!cancelled) {
              setError('Company not found')
            }
          }
        } else {
          // Fetch top company with events (original behavior)
          const params = new URLSearchParams({
            events: 'with',
            sortBy: 'scoreDesc',
            limit: '1'
          })
          
          const response = await fetch(`/api/businesses?${params.toString()}`)
          if (!response.ok) throw new Error('Failed to fetch companies')
          
          const data = await response.json()
          const items = Array.isArray(data) ? data : data.items || []
          
          if (cancelled) return
          
          if (items.length > 0) {
            const company = items[0] as Business
            setTopCompany(company)
            
            // Fetch events for this company
            if (company.orgNumber) {
              const eventsParams = new URLSearchParams({
                orgNumber: company.orgNumber,
                limit: '50'
              })
              
              const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
              if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json()
                const eventItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
                if (!cancelled) {
                  setEvents(eventItems)
                }
              }
            }
          } else {
            if (!cancelled) {
              setError('No companies with news events found')
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load company data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    
    fetchCompanyData()
    
    return () => {
      cancelled = true
    }
  }, [status, searchParams])

  // Fetch business statistics
  useEffect(() => {
    if (status !== 'authenticated') return
    
    let cancelled = false
    
    const fetchStats = async () => {
      try {
        // Get total companies count
        const companiesResponse = await fetch('/api/businesses?countOnly=1')
        const companiesData = await companiesResponse.json()
        
        // Get companies with events count
        const withEventsResponse = await fetch('/api/businesses?events=with&countOnly=1')
        const withEventsData = await withEventsResponse.json()
        
        // Get total events count (approximate from latest events)
        const eventsResponse = await fetch('/api/events?limit=1')
        const eventsData = await eventsResponse.json()
        
        if (!cancelled) {
          setBusinessStats({
            totalCompanies: companiesData.total || companiesData.grandTotal || 0,
            companiesWithEvents: withEventsData.total || withEventsData.grandTotal || 0,
            totalEvents: 50000 // Approximate since we don't have a direct count API
          })
        }
      } catch (err) {
        console.error('Failed to fetch business stats:', err)
      }
    }
    
    fetchStats()
    
    return () => {
      cancelled = true
    }
  }, [status])

  // Company search suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setCompanySuggestions([])
      setShowSuggestions(false)
      return
    }

    let cancelled = false
    const fetchSuggestions = async () => {
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: '8',
          skipCount: '1'
        })
        const response = await fetch(`/api/businesses?${params.toString()}`)
        const data = await response.json()
        const items = Array.isArray(data) ? data : data.items || []
        
        if (!cancelled) {
          setCompanySuggestions(items.map((item: Business) => ({
            name: item.name,
            orgNumber: item.orgNumber
          })))
          setShowSuggestions(true)
        }
      } catch (err) {
        if (!cancelled) {
          setCompanySuggestions([])
          setShowSuggestions(false)
        }
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 300)
    return () => {
      clearTimeout(timeoutId)
      cancelled = true
    }
  }, [searchQuery])

  const handleCompanySelect = async (orgNumber: string) => {
    setShowSuggestions(false)
    setSearchQuery('')
    setLoading(true)
    setError(null)

    try {
      // Fetch selected company
      const params = new URLSearchParams({
        q: orgNumber,
        limit: '1'
      })
      const response = await fetch(`/api/businesses?${params.toString()}`)
      const data = await response.json()
      const items = Array.isArray(data) ? data : data.items || []

      if (items.length > 0) {
        const company = items[0] as Business
        setTopCompany(company)
        
        // Add to recently viewed
        addToRecentlyViewed({
          name: company.name,
          orgNumber: company.orgNumber
        })

        // Fetch events for this company
        const eventsParams = new URLSearchParams({
          orgNumber: company.orgNumber,
          limit: '50'
        })
        
        const eventsResponse = await fetch(`/api/events?${eventsParams.toString()}`)
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json()
          const eventItems = Array.isArray(eventsData) ? eventsData : eventsData.items || []
          setEvents(eventItems)
        }
      }
    } catch (err) {
      setError('Failed to load selected company')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <div className="text-lg text-gray-400">Loading...</div>
        </div>
      </div>
    )
  }

  if (!session) return null

  const fmt = (v: number | string | null | undefined) =>
    v === null || v === undefined ? '—' : numberFormatter.format(Number(v))

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Search Bar and Recently Viewed */}
      <div className="p-2 px-6 border-b border-white/10">
        <div className="flex items-center gap-8">
              {/* Search Bar */}
          <div className="relative w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk selskaper"
            className="w-full bg-transparent text-white placeholder-gray-500 px-0 py-2 border-0 border-b border-white/20 focus:outline-none focus:ring-0 focus:border-white/40"
            onFocus={() => {
              if (companySuggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            onBlur={() => {
              // Delay to allow click on suggestions
              setTimeout(() => setShowSuggestions(false), 200)
            }}
          />
          
          {showSuggestions && companySuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-2 border border-white/10 bg-black text-white shadow-xl divide-y divide-white/10">
              {companySuggestions.map((company, idx) => (
                <button
                  key={`${company.orgNumber}-${idx}`}
                  onClick={() => handleCompanySelect(company.orgNumber)}
                  className="block w-full text-left px-4 py-3 hover:bg-white/20 focus:bg-white/20 focus:outline-none text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{company.name || 'Uten navn'}</span>
                    <span className="text-xs text-gray-400">{company.orgNumber}</span>
                  </div>
                </button>
              ))}
              </div>
            )}
          </div>

          {/* Recently Viewed Companies */}
          {recentlyViewed.length > 0 && (
            <div className="flex-1 relative flex items-center min-w-0">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pr-4 pl-4 w-full">
                {recentlyViewed.map((company, idx) => (
                  <button
                    key={`${company.orgNumber}-${idx}`}
                    onClick={() => handleCompanySelect(company.orgNumber)}
                    className="px-3 py-1 text-xs border border-white/20 text-white/90 hover:bg-white/10 hover:border-white/40 transition-colors rounded whitespace-nowrap flex-shrink-0"
                    title={`${company.name} (${company.orgNumber})`}
                  >
                    <span className="max-w-32 block truncate">{company.name}</span>
                  </button>
                ))}
              </div>
              {/* Fade effect on the left */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent pointer-events-none"></div>
              {/* Fade effect on the right */}
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black to-transparent pointer-events-none"></div>
            </div>
          )}
        </div>
      </div>

    <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
              <div className="text-lg text-gray-400">Laster selskapsdata...</div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg text-red-400 mb-4">Feil</div>
              <div className="text-gray-400">{error}</div>
            </div>
          </div>
        ) : topCompany ? (
          <div className="w-full">
            {/* Company Details */}
            <div className="border border-white/10 p-6 mb-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">{topCompany.name}</h2>
                  </div>
                {topCompany.website && topCompany.website.trim() && (
                  <a 
                    href={topCompany.website.startsWith('http') ? topCompany.website : `https://${topCompany.website}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="px-4 py-2 border border-white/20 text-white/90 hover:bg-white/10 hover:border-white/40 transition-colors"
                  >
                    Besøk nettside
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Grunnleggende informasjon</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Organisasjonsnummer:</span>
                      <div className="text-white">{topCompany.orgNumber}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Daglig leder:</span>
                      <div className="text-white">{topCompany.ceo || '—'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Antall ansatte:</span>
                      <div className="text-white">{topCompany.employees ?? '—'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Gjennomsnittlig ansatte:</span>
                      <div className="text-white">{topCompany.employeesAvg ?? '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Income Statement */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Resultatregnskap</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Sum driftsinntekter:</span>
                      <div className="text-white">
                        {(topCompany.sumDriftsinntekter || topCompany.operatingIncome || topCompany.revenue) == null ? '—' : 
                         `${fmt(topCompany.sumDriftsinntekter || topCompany.operatingIncome || topCompany.revenue)} ${topCompany.valuta || 'NOK'}${topCompany.fiscalYear ? ` (${topCompany.fiscalYear})` : ''}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Driftsresultat:</span>
                      <div className="text-white">
                        {(topCompany.driftsresultat || topCompany.operatingResult) == null ? '—' : 
                         `${fmt(topCompany.driftsresultat || topCompany.operatingResult)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Ordinært resultat før skatt:</span>
                      <div className="text-white">
                        {topCompany.profitBeforeTax == null ? '—' : 
                         `${fmt(topCompany.profitBeforeTax)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Årsresultat:</span>
                      <div className="text-white">
                        {(topCompany.aarsresultat || topCompany.profit) == null ? '—' : 
                         `${fmt(topCompany.aarsresultat || topCompany.profit)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    {topCompany.employeesAvg !== null && topCompany.employeesAvg !== undefined && (
                      <div>
                        <span className="font-medium text-gray-300">Gjennomsnittlig ansatte:</span>
                        <div className="text-white">{topCompany.employeesAvg}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Balance Sheet - Assets */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Balanse - Eiendeler</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Sum eiendeler:</span>
                      <div className="text-white">
                        {(topCompany.sumEiendeler || topCompany.totalAssets) == null ? '—' : 
                         `${fmt(topCompany.sumEiendeler || topCompany.totalAssets)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balance Sheet - Equity & Liabilities */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Balanse - Egenkapital og gjeld</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Sum egenkapital:</span>
                      <div className="text-white">
                        {(topCompany.sumEgenkapital || topCompany.equity) == null ? '—' : 
                         `${fmt(topCompany.sumEgenkapital || topCompany.equity)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Sum gjeld:</span>
                      <div className="text-white">
                        {topCompany.sumGjeld == null ? '—' : 
                         `${fmt(topCompany.sumGjeld)} ${topCompany.valuta || 'NOK'}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Period */}
                {(topCompany.fraDato || topCompany.tilDato) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Regnskapsperiode</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Periode:</span>
                        <div className="text-white">
                          {topCompany.fraDato && topCompany.tilDato 
                            ? `${formatEventDate(topCompany.fraDato)} - ${formatEventDate(topCompany.tilDato)}`
                            : topCompany.fraDato 
                              ? `Fra ${formatEventDate(topCompany.fraDato)}`
                              : topCompany.tilDato
                                ? `Til ${formatEventDate(topCompany.tilDato)}`
                                : '—'
                          }
                        </div>
                      </div>
                      {topCompany.valuta && (
                        <div>
                          <span className="font-medium text-gray-300">Valuta:</span>
                          <div className="text-white">{topCompany.valuta}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* Location & Industry */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Lokasjon og bransje</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-300">Adresse:</span>
                      <div className="text-white">
                        {[
                          topCompany.addressStreet,
                          topCompany.addressPostalCode,
                          topCompany.addressCity,
                        ].filter(Boolean).join(', ') || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Primær bransje:</span>
                      <div className="text-white">
                        {topCompany.industryCode1 ? `${topCompany.industryCode1} ${topCompany.industryText1 || ''}`.trim() : '—'}
                      </div>
                    </div>
                    {topCompany.industryCode2 && (
                      <div>
                        <span className="font-medium text-gray-300">Sekundær bransje:</span>
                        <div className="text-white">
                          {`${topCompany.industryCode2} ${topCompany.industryText2 || ''}`.trim()}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-300">Sektor:</span>
                      <div className="text-white">
                        {topCompany.sectorCode ? `${topCompany.sectorCode} ${topCompany.sectorText || ''}`.trim() : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">Organisasjonsform:</span>
                      <div className="text-white">{topCompany.orgFormText || topCompany.orgFormCode || '—'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-300">MVA-registrert:</span>
                      <div className="text-white">
                        {topCompany.vatRegistered === true ? 'Ja' : topCompany.vatRegistered === false ? 'Nei' : '—'}
                        {topCompany.vatRegisteredDate && ` (${formatEventDate(topCompany.vatRegisteredDate)})`}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Events Section */}
            <div className="border border-white/10 p-6 mb-8">
              <h3 className="text-xl font-semibold mb-4">Siste nyheter og hendelser</h3>
              {events.length === 0 ? (
                <div className="text-gray-400">Ingen hendelser tilgjengelig</div>
              ) : (
                <div className="space-y-4">
                  {events.map((event, idx) => (
                    <div key={(event.id ?? idx) as React.Key} className="border border-white/10 p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-2">
                            {event.title || 'Untitled event'}
                          </h4>
                          {event.description && (
                            <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                              {event.description}
                            </p>
                          )}
                          {event.url && (
                            <a 
                              href={event.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-sky-400 hover:text-sky-300 underline text-sm"
                            >
                              Les mer
                            </a>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-gray-400 mb-2">
                            {formatEventDate(event.date)}
                          </div>
                          {event.source && (
                            <span className="inline-block px-2 py-1 text-[11px] bg-white/5 border border-white/20 text-gray-200">
                              {event.source.replace(/_/g, ' ').charAt(0).toUpperCase() + event.source.replace(/_/g, ' ').slice(1)}
                            </span>
                          )}
                          {event.score !== null && event.score !== undefined && (
                            <div className="text-xs text-gray-400 mt-1">
                              Score: {numberFormatter.format(event.score)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Website Stats Section */}
            {topCompany.website && (topCompany.webFinalUrl || topCompany.webStatus || topCompany.webTlsValid !== null) && (
              <div className="border border-white/10 p-6 mb-8">
                <h3 className="text-xl font-semibold mb-4">Nettstedsanalyse</h3>
                <p className="text-sm text-gray-400 mb-4">Webanalyse-data er tilgjengelig for denne bedriften</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  
                  {/* Basic Web Info */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Grunnleggende informasjon</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">URL:</span>
                        <div className="text-white break-all">{topCompany.webFinalUrl || topCompany.website || '—'}</div>
                    </div>
                      <div>
                        <span className="font-medium text-gray-300">Status:</span>
                        <div className="text-white">{topCompany.webStatus || '—'}</div>
                  </div>
                      <div>
                        <span className="font-medium text-gray-300">Response tid:</span>
                        <div className="text-white">{topCompany.webElapsedMs ? `${topCompany.webElapsedMs}ms` : '—'}</div>
                    </div>
                      <div>
                        <span className="font-medium text-gray-300">IP-adresse:</span>
                        <div className="text-white">{topCompany.webIp || '—'}</div>
                  </div>
                      <div>
                        <span className="font-medium text-gray-300">HTML størrelse:</span>
                        <div className="text-white">{topCompany.webHtmlKb ? `${topCompany.webHtmlKb}KB` : '—'}</div>
                    </div>
                  </div>
                </div>
                
                  {/* TLS/Security */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Sikkerhet & TLS</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">TLS gyldig:</span>
                        <div className="text-white">
                          {topCompany.webTlsValid === true ? 'Ja' : topCompany.webTlsValid === false ? 'Nei' : '—'}
                    </div>
                  </div>
                      <div>
                        <span className="font-medium text-gray-300">TLS utsteder:</span>
                        <div className="text-white">{topCompany.webTlsIssuer || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Dager til utløp:</span>
                        <div className="text-white">{topCompany.webTlsDaysToExpiry || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">HSTS:</span>
                        <div className="text-white">
                          {topCompany.webSecurityHsts === true ? 'Ja' : topCompany.webSecurityHsts === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">CSP:</span>
                        <div className="text-white">
                          {topCompany.webSecurityCsp === true ? 'Ja' : topCompany.webSecurityCsp === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CMS & Technology */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">CMS & Teknologi</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Primær CMS:</span>
                        <div className="text-white">{topCompany.webPrimaryCms || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">WordPress:</span>
                        <div className="text-white">
                          {topCompany.webCmsWordpress === true ? 'Ja' : topCompany.webCmsWordpress === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Shopify:</span>
                        <div className="text-white">
                          {topCompany.webCmsShopify === true ? 'Ja' : topCompany.webCmsShopify === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">React:</span>
                        <div className="text-white">
                          {topCompany.webJsReact === true ? 'Ja' : topCompany.webJsReact === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Next.js:</span>
                        <div className="text-white">
                          {topCompany.webJsNextjs === true ? 'Ja' : topCompany.webJsNextjs === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analytics & Marketing */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Analytics & Markedsføring</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Google Analytics 4:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsGa4 === true ? 'Ja' : topCompany.webAnalyticsGa4 === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Google Tag Manager:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsGtm === true ? 'Ja' : topCompany.webAnalyticsGtm === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Facebook Pixel:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsFbPixel === true ? 'Ja' : topCompany.webAnalyticsFbPixel === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">LinkedIn Insight:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsLinkedin === true ? 'Ja' : topCompany.webAnalyticsLinkedin === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Hotjar:</span>
                        <div className="text-white">
                          {topCompany.webAnalyticsHotjar === true ? 'Ja' : topCompany.webAnalyticsHotjar === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* E-commerce & Payments */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">E-handel & Betalinger</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">WooCommerce:</span>
                        <div className="text-white">
                          {topCompany.webEcomWoocommerce === true ? 'Ja' : topCompany.webEcomWoocommerce === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Magento:</span>
                        <div className="text-white">
                          {topCompany.webEcomMagento === true ? 'Ja' : topCompany.webEcomMagento === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Stripe:</span>
                        <div className="text-white">
                          {topCompany.webPayStripe === true ? 'Ja' : topCompany.webPayStripe === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">PayPal:</span>
                        <div className="text-white">
                          {topCompany.webPayPaypal === true ? 'Ja' : topCompany.webPayPaypal === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Klarna:</span>
                        <div className="text-white">
                          {topCompany.webPayKlarna === true ? 'Ja' : topCompany.webPayKlarna === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Server & Headers */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Server & Headers</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Server:</span>
                        <div className="text-white">{topCompany.webHeaderServer || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">X-Powered-By:</span>
                        <div className="text-white">{topCompany.webHeaderXPoweredBy || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">CDN Hint:</span>
                        <div className="text-white">{topCompany.webCdnHint || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Server Hint:</span>
                        <div className="text-white">{topCompany.webServerHint || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Cookies:</span>
                        <div className="text-white">
                          {topCompany.webCookiesPresent === true ? 'Ja' : topCompany.webCookiesPresent === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Content */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Kontakt & Innhold</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">E-post på nettside:</span>
                        <div className="text-white">
                          {topCompany.webHasEmailText === true ? 'Ja' : topCompany.webHasEmailText === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Telefon på nettside:</span>
                        <div className="text-white">
                          {topCompany.webHasPhoneText === true ? 'Ja' : topCompany.webHasPhoneText === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">HTML &gt; 500KB:</span>
                        <div className="text-white">
                          {topCompany.webHtmlKbOver500 === true ? 'Ja' : topCompany.webHtmlKbOver500 === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b border-white/10 pb-2">Risikovurdering</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-300">Risikoflagg:</span>
                        <div className="text-white">{topCompany.webRiskFlags || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Feil:</span>
                        <div className="text-white">{topCompany.webErrors || '—'}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Placeholder nettside:</span>
                        <div className="text-white">
                          {topCompany.webRiskPlaceholderKw === true ? 'Ja' : topCompany.webRiskPlaceholderKw === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Parkert domene:</span>
                        <div className="text-white">
                          {topCompany.webRiskParkedKw === true ? 'Ja' : topCompany.webRiskParkedKw === false ? 'Nei' : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-300">Suspendert:</span>
                        <div className="text-white">
                          {topCompany.webRiskSuspendedKw === true ? 'Ja' : topCompany.webRiskSuspendedKw === false ? 'Nei' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Website Data Not Available */}
            {topCompany.website && !(topCompany.webFinalUrl || topCompany.webStatus || topCompany.webTlsValid !== null) && (
              <div className="border border-white/10 p-6 mb-8">
                <h3 className="text-xl font-semibold mb-4">Nettstedsanalyse</h3>
                <p className="text-sm text-gray-400">Webanalyse-data er ikke tilgjengelig for denne bedriften ennå.</p>
                <p className="text-sm text-gray-300 mt-2">Nettside: <a href={topCompany.website.startsWith('http') ? topCompany.website : `https://${topCompany.website}`} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">{topCompany.website}</a></p>
              </div>
            )}


          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-lg text-gray-400">Ingen selskapsdata tilgjengelig</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



