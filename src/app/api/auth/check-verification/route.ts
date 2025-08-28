import { NextRequest, NextResponse } from 'next/server'
import { getUserVerificationStatus } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const status = await getUserVerificationStatus(email)

    return NextResponse.json({
      exists: status.exists,
      verified: status.verified
    })

  } catch (error) {
    console.error('Check verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
