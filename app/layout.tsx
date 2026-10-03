import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import Providers from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Outfit Planner',
  description: 'Plan trip outfits by day and time, with your own wardrobe.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Outfits', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#d6e3f8',
}

const FONTS =
  'https://fonts.googleapis.com/css2?' +
  [
    'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500;1,9..144,600',
    'Instrument+Sans:wght@500;700',
    'Imperial+Script',
    'Caveat:wght@600;700',
    'Courier+Prime:wght@400;700',
    'Karla:wght@400;500;600;700',
    'DM+Serif+Display',
    'Archivo+Black',
    'Archivo:wght@500;700;800',
    'Special+Elite',
  ].map((f) => `family=${f}`).join('&') +
  '&display=swap'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers makes every page render per request, so each gets a fresh CSP nonce.
  await headers()
  return (
    <html lang="en" data-theme="studio">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
