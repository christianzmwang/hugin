'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

// List of users who can access the main page
const ALLOWED_USERS = [
  'christian@allvitr.com',
  'lars@allvitr.com', 
  'thomas@allvitr.com',
  'atlegram@gmail.com'
]

export default function CountdownPage() {
  const { data: session } = useSession()
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  // Check if current user is one of the allowed users
  const canAccessMainPage = session?.user?.email && ALLOWED_USERS.includes(session.user.email)

  useEffect(() => {
    const calculateTimeLeft = () => {
      // Target date: September 1st, 06:00 Norwegian time (CEST/CET)
      // Norway is UTC+2 in summer (CEST) and UTC+1 in winter (CET)
      const now = new Date()
      const currentYear = now.getFullYear()
      
      // Try current year first
      let targetDate = new Date(`${currentYear}-09-01T06:00:00+02:00`)
      
      // If the target date has already passed this year, use next year
      if (targetDate.getTime() <= now.getTime()) {
        targetDate = new Date(`${currentYear + 1}-09-01T06:00:00+02:00`)
      }
      
      const difference = targetDate.getTime() - now.getTime()

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)

        setTimeLeft({ days, hours, minutes, seconds })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    // Calculate immediately
    calculateTimeLeft()

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="grid grid-cols-4 gap-8 text-white">
          {/* Days */}
          <div className="flex flex-col items-center">
            <div className="text-6xl md:text-8xl font-mono font-bold mb-2">
              {timeLeft.days.toString().padStart(2, '0')}
            </div>
            <div className="text-xl md:text-2xl uppercase tracking-wider">
              Days
            </div>
          </div>

          {/* Hours */}
          <div className="flex flex-col items-center">
            <div className="text-6xl md:text-8xl font-mono font-bold mb-2">
              {timeLeft.hours.toString().padStart(2, '0')}
            </div>
            <div className="text-xl md:text-2xl uppercase tracking-wider">
              Hours
            </div>
          </div>

          {/* Minutes */}
          <div className="flex flex-col items-center">
            <div className="text-6xl md:text-8xl font-mono font-bold mb-2">
              {timeLeft.minutes.toString().padStart(2, '0')}
            </div>
            <div className="text-xl md:text-2xl uppercase tracking-wider">
              Minutes
            </div>
          </div>

          {/* Seconds */}
          <div className="flex flex-col items-center">
            <div className="text-6xl md:text-8xl font-mono font-bold mb-2">
              {timeLeft.seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-xl md:text-2xl uppercase tracking-wider">
              Seconds
            </div>
          </div>
        </div>
        
        {/* Special button only visible to allowed users */}
        {canAccessMainPage && (
          <div className="mt-8">
            <Link 
              href="/"
              className="inline-block bg-white hover:bg-gray-100 text-black px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Access Main Page
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
