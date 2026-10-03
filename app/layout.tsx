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
  themeColor: '#2a1b3d',
}

const FONTS =
  'https://fonts.googleapis.com/css2?' +
  [
    'Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700',
    'Instrument+Sans:wght@400;500;600;700',
    'Fredoka:wght@500;600',
    'Nunito:wght@400;600;700',
    'Playfair+Display:ital,wght@0,500;1,500;1,600',
    'Quicksand:wght@400;500;600;700',
    'Manrope:wght@300;400;600;700',
    'Cormorant+Garamond:wght@500;600',
    'Jost:wght@400;500;600',
    'Unbounded:wght@500;600',
    'Sora:wght@400;600',
    'Marcellus',
    'Figtree:wght@400;600;700',
    'Anton',
    'Archivo:wght@400;600;700',
    'Bodoni+Moda:opsz,wght@6..96,500;6..96,600',
    'Libre+Franklin:wght@400;600',
    'Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700',
    'Work+Sans:wght@400;600',
    'Familjen+Grotesk:wght@400;600;700',
    'Young+Serif',
    'Karla:wght@400;600;700',
    'Libre+Baskerville:ital,wght@0,400;0,700;1,700',
    'Crimson+Pro:wght@400;600;700',
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
