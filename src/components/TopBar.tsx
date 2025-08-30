'use client'

import AuthNav from '@/components/AuthNav'
import HuginLogo from '../../public/hugin.svg'

type TopBarProps = {
  title?: string
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <div className="bg-black border-b border-white/10">
      <div className="py-2 px-6 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <HuginLogo className="h-6 w-auto" />
          <span className="inline-block h-6 w-[2px] bg-red-600 mx-2" />
          <span className="text-white">{title || 'Hugin'}</span>
        </h1>
        <AuthNav />
      </div>
    </div>
  )
}


