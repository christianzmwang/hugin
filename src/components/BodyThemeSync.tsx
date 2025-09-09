"use client"
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDashboardMode } from '@/components/DashboardThemeProvider'

export default function BodyThemeSync() {
  const { mode } = useDashboardMode()
  const pathname = usePathname()
  useEffect(() => {
    const body = document.body
    const isAuth = pathname?.startsWith('/auth/')
    if (isAuth) {
      body.dataset.appTheme = 'dark'
      body.classList.add('app-dark')
      body.classList.remove('app-light')
      return
    }
    body.dataset.appTheme = mode
    if (mode === 'light') {
      body.classList.add('app-light')
      body.classList.remove('app-dark')
    } else {
      body.classList.add('app-dark')
      body.classList.remove('app-light')
    }
  }, [mode, pathname])
  return null
}
