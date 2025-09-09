import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import AutoChrome from '@/components/AutoChrome'
import { DashboardThemeProvider } from '@/components/DashboardThemeProvider'
import BodyThemeSync from '@/components/BodyThemeSync'

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Hugin - Real time market research',
  description: 'Real time market research platform by Allvitr',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${jetbrainsMono.variable} ${inter.variable} font-mono app-dark`}
      >
        <Providers>
          <DashboardThemeProvider>
            <BodyThemeSync />
            <AutoChrome>{children}</AutoChrome>
          </DashboardThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
