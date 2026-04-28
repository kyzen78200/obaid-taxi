import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'O Taxi Admin',
  description: 'Back-office de gestion O Taxi',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'O Taxi',
  },
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" type="image/png" href="/favicon-32.png" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
