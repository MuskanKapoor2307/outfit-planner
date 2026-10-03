'use client'
import { useEffect } from 'react'
import { STUDIO_BAR, themeInfo } from '@/lib/themes'
import type { ThemeId } from '@/lib/types'

/** Applies a theme to the whole page while mounted, then goes back to the neutral one. */
export default function ThemeScope({ theme }: { theme: ThemeId | 'studio' }) {
  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = theme === 'studio' ? STUDIO_BAR : themeInfo(theme)?.bar ?? STUDIO_BAR
    return () => {
      html.dataset.theme = 'studio'
      if (meta) meta.content = STUDIO_BAR
    }
  }, [theme])
  return null
}
