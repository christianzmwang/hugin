'use client'

import AuthNav from '@/components/AuthNav'
import Image from 'next/image'
import { useDashboardMode } from '@/components/DashboardThemeProvider'
// All pages now use light styling when global dashboard mode is light

type TopBarProps = {
  title?: string
}


import React, { useRef, useState, useEffect } from 'react'

export default function TopBar({ title }: TopBarProps) {
  const { mode } = useDashboardMode()
  const light = mode === 'light'
  const bg = light ? 'bg-white border-gray-200' : 'bg-black border-white/10'
  const text = light ? 'text-gray-900' : 'text-white'

  // Dark logo should only ease in AFTER dark mode is active (after bg transition ~300ms)
  const [darkFadeInReady, setDarkFadeInReady] = useState(false)
  useEffect(() => {
    if (!light) { // entering dark
      setDarkFadeInReady(false)
      const t = setTimeout(() => setDarkFadeInReady(true), 300) // match bg transition duration
      return () => clearTimeout(t)
    } else {
      // leaving dark: remove fade state so next dark switch re-triggers
      setDarkFadeInReady(false)
    }
  }, [light])

  const showDark = !light
  // Light logo stays visible until dark logo actually begins its fade-in
  const showLight = light || (showDark && !darkFadeInReady)

  return (
    <div id="topbar-root" className={`${bg} border-b transition-colors duration-300`}>
      <div className="py-2 pl-6 pr-0 flex items-center">
        <h1 className="text-xl font-normal flex items-center gap-2 flex-shrink-0">
          <span className="relative h-6 w-[24px] inline-block">
            {/* Light mode / placeholder logo (no fade-out animation) */}
            <Image
              src="/huginBlack.svg"
              alt="Hugin logo light"
              width={120}
              height={24}
              priority
              className={`h-6 w-auto absolute inset-0 ${showLight ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Dark mode logo: only fades IN (ease) once dark mode active & delay elapsed */}
            <Image
              src="/hugin.svg"
              alt="Hugin logo dark"
              width={120}
              height={24}
              priority
              className={`h-6 w-auto absolute inset-0 ${showDark ? (darkFadeInReady ? 'opacity-100 transition-opacity duration-500 ease-in' : 'opacity-0') : 'opacity-0'}`}
            />
          </span>
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
