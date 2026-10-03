'use client'
import { useEffect, useState } from 'react'
import { loadSettings, type AiSettings } from './settings'

/** Current AI settings for this device; updates when they change. */
export function useAiSettings(): AiSettings | null {
  const [s, setS] = useState<AiSettings | null>(null)
  useEffect(() => {
    const read = () => setS(loadSettings())
    read()
    window.addEventListener('op-ai-settings', read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener('op-ai-settings', read)
      window.removeEventListener('storage', read)
    }
  }, [])
  return s
}
