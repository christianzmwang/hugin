// Type declarations for NextAuth

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      username?: string | null
      name?: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
    email: string
    username?: string | null
    name?: string | null
    image?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}

// Cloudflare Turnstile type declarations
declare global {
  interface Window {
    turnstile?: {
      ready: (callback: () => void) => void
      render: (element: string | HTMLElement, options: TurnstileOptions) => string
      execute: (widgetId: string) => void
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }

  interface TurnstileOptions {
    sitekey: string
    callback?: (token: string) => void
    'error-callback'?: () => void
    'expired-callback'?: () => void
    'timeout-callback'?: () => void
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'invisible'
    language?: string
  }
}

export {}
