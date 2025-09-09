'use client'

import AuthNav from '@/components/AuthNav'
import { usePathname } from 'next/navigation'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
// All pages now use light styling when global dashboard mode is light

type TopBarProps = {
  title?: string
}


import React, { useRef, useState, useEffect } from 'react'

export default function TopBar({ title }: TopBarProps) {
  const pathname = usePathname()
  const { mode } = useDashboardMode()
  const light = mode === 'light'
  const bg = light ? 'bg-white border-gray-200' : 'bg-black border-white/10'
  const text = light ? 'text-gray-900' : 'text-white'

  // State to control when to show the dark logo
  const [showDarkLogo, setShowDarkLogo] = useState(!light)
  const prevLight = useRef(light)

  useEffect(() => {
    // If switching to dark, wait for transition to end
    if (prevLight.current && !light) {
      setShowDarkLogo(false)
    }
    // If switching to light, show light logo immediately
    if (!prevLight.current && light) {
      setShowDarkLogo(false)
    }
    prevLight.current = light
  }, [light])

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName === 'background-color' && !light) {
      setShowDarkLogo(true)
    }
    if (e.propertyName === 'background-color' && light) {
      setShowDarkLogo(false)
    }
  }

  // Show black logo if light, otherwise only show dark logo after transition
  const logoSrc = light || !showDarkLogo ? '/huginBlack.svg' : '/hugin.svg'

  return (
    <div id="topbar-root" className={`${bg} border-b transition-colors duration-300`} onTransitionEnd={handleTransitionEnd}>
  <div className="py-2 pl-6 pr-0 flex items-center">
        <h1 className="text-xl font-normal flex items-center gap-2 flex-shrink-0">
          <img src={logoSrc} alt="Hugin logo" className="h-6 w-auto" />
          <span className="inline-block h-6 w-[2px] bg-red-600 mx-2" />
          <span className={text}>{title || 'Hugin'}</span>
        </h1>
        <div className="ml-auto">
          <AuthNav />
        </div>
      </div>
    </div>
  )
}
