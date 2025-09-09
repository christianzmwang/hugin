"use client"
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type DashboardMode = 'dark' | 'light'
type Ctx = { mode: DashboardMode; toggle: () => void; setModeExplicit: (m: DashboardMode) => void }
const DashboardModeContext = createContext<Ctx | null>(null)
const STORAGE_KEY = 'dashboardMode'

export function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DashboardMode>('dark')
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === 'light' || s === 'dark') setMode(s)
    } catch {}
  }, [])
  const persist = (m: DashboardMode) => { try { localStorage.setItem(STORAGE_KEY, m) } catch {} }
  const toggle = useCallback(() => {
    setMode(prev => {
      const next: DashboardMode = prev === 'dark' ? 'light' : 'dark'
      persist(next)
      return next
    })
  }, [])
  const setModeExplicit = useCallback((m: DashboardMode) => { setMode(m); persist(m) }, [])
  return (
    <DashboardModeContext.Provider value={{ mode, toggle, setModeExplicit }}>
      {children}
    </DashboardModeContext.Provider>
  )
}

export function useDashboardMode() {
  const ctx = useContext(DashboardModeContext)
  if (!ctx) throw new Error('useDashboardMode must be used within DashboardThemeProvider')
  return ctx
}
