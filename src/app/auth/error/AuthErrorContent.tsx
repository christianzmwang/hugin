'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Server Configuration Error',
    description: 'There is a problem with the server configuration. Please contact support.'
  },
  AccessDenied: {
    title: 'Access Denied',
    description: 'You do not have permission to sign in with this account.'
  },
  Verification: {
    title: 'Verification Error',
    description: 'The verification token has expired or has already been used.'
  },
  Default: {
    title: 'Authentication Failed',
    description: 'There was a problem with authentication. Please try signing in again.'
  },
  CredentialsSignin: {
    title: 'Invalid Credentials',
    description: 'The email or password you entered is incorrect. Please check your credentials and try again.'
  },
  OAuthSignin: {
    title: 'OAuth Sign-in Error',
    description: 'There was a problem signing in with your OAuth provider. Please try again.'
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    description: 'There was a problem during the OAuth authentication process. Please try again.'
  },
  OAuthCreateAccount: {
    title: 'Account Creation Error',
    description: 'Could not create an OAuth account. Please try a different sign-in method.'
  },
  EmailCreateAccount: {
    title: 'Email Account Error',
    description: 'Could not create an account with this email. Please try a different email address.'
  },
  Callback: {
    title: 'Callback Error',
    description: 'There was a problem during the authentication callback. Please try again.'
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    description: 'This OAuth account is not linked to an existing account. Please sign in with your original method first.'
  },
  EmailSignin: {
    title: 'Email Sign-in Error',
    description: 'There was a problem sending the sign-in email. Please check your email address and try again.'
  },
  SessionRequired: {
    title: 'Session Required',
    description: 'You must be signed in to access this page.'
  }
}

export default function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  
  const errorInfo = error && errorMessages[error] ? errorMessages[error] : errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <div className="mt-8 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  {errorInfo.title}
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{errorInfo.description}</p>
                  {error && (
                    <p className="mt-1 text-xs text-red-600">
                      Error code: {error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href="/auth/signin"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
