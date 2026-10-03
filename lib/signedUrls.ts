'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Photos are private, so we ask Supabase for short-lived links (1 hour) and cache them.
const cache = new Map<string, { url: string; expires: number }>()
const TTL_SECONDS = 3600

export async function getSignedUrls(paths: string[], bucket: 'wardrobe' | 'people' = 'wardrobe'): Promise<Record<string, string>> {
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of new Set(paths)) {
    const c = cache.get(`${bucket}:${p}`)
    if (c && c.expires - now > 5 * 60 * 1000) out[p] = c.url
    else missing.push(p)
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100)
    const { data, error } = await supabase().storage.from(bucket).createSignedUrls(chunk, TTL_SECONDS)
    if (error) throw error
    for (const row of data || []) {
      if (row.signedUrl && row.path) {
        cache.set(`${bucket}:${row.path}`, { url: row.signedUrl, expires: now + TTL_SECONDS * 1000 })
        out[row.path] = row.signedUrl
      }
    }
  }
  return out
}

export function useSignedUrls(paths: string[], bucket: 'wardrobe' | 'people' = 'wardrobe') {
  const key = [...new Set(paths)].sort().join('|')
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!key) return
    let alive = true
    getSignedUrls(key.split('|'), bucket)
      .then((u) => alive && setUrls((prev) => ({ ...prev, ...u })))
      .catch((e) => console.warn('Could not load photos', e))
    return () => {
      alive = false
    }
  }, [key, bucket])
  return urls
}

export function forgetSignedUrl(path: string, bucket: 'wardrobe' | 'people' = 'wardrobe') {
  cache.delete(`${bucket}:${path}`)
}
