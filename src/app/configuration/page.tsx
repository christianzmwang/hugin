'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ConfigurationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/auth/signin')
  }, [status, session, router])

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

  return (
    <div className="p-6">
      <div className="bg-gray-900 border border-white/10 p-6 max-w-3xl">
        <h2 className="text-xl font-semibold mb-4">Konfigurasjon</h2>
        <BusinessContextEditor />
      </div>
    </div>
  )
}

function BusinessContextEditor() {
  const [value, setValue] = useState<string>('')
  const [saved, setSaved] = useState<boolean>(false)
  useEffect(() => {
    try {
      const v = localStorage.getItem('businessContext')
      if (v) setValue(v)
    } catch {}
  }, [])
  const onSave = () => {
    try {
      localStorage.setItem('businessContext', value || '')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {}
  }
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">Forretningskontekst (om deg/din virksomhet)</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder="Beskriv kort hvem du er, hva du selger, segment og preferanser."
        className="w-full bg-black border border-white/20 text-sm p-2 text-white"
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={onSave} className="px-3 py-2 border border-white/20 text-sm text-white/90 hover:bg-white/10">Lagre</button>
        {saved && <span className="text-xs text-green-400">Lagret</span>}
      </div>
    </div>
  )
}


