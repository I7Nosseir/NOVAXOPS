import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Providers } from './providers'
import { SwRegister } from '@/components/layout/sw-register'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D3535',
}

export const metadata: Metadata = {
  title: 'NOVA Ops',
  description: 'NOVA unified operations platform',
  icons: { icon: '/icon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NOVAX Ops',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
        <SwRegister />
      </body>
    </html>
  )
}
