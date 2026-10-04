'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Photos are private, so we ask Supabase for short-lived links and cache them.
// The cache is also kept in this tab's storage: reusing the SAME link after a reload lets the
// browser show the photo from its own cache instead of downloading it again (a big speed-up).
const TTL_SECONDS = 6 * 3600
const STORE_KEY = 'op:signed-urls'
type Entry = { url: string; expires: number }
let cache: Map<string, Entry> | null = null

function store(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function load(): Map<string, Entry> {
  if (cache) return cache
  cache = new Map()
  try {
    const raw = store()?.getItem(STORE_KEY)
    const now = Date.now()
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) if (v.expires > now) cache.set(k, v)
  } catch {
    /* ignore a broken cache */
  }
  return cache
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      store()?.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(load())))
    } catch {
      /* storage full or blocked: the in-memory cache still works */
    }
  }, 300)
}

export async function getSignedUrls(paths: string[], bucket: 'wardrobe' | 'people' = 'wardrobe'): Promise<Record<string, string>> {
  const c = load()
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of new Set(paths)) {
    const hit = c.get(`${bucket}:${p}`)
    if (hit && hit.expires - now > 10 * 60 * 1000) out[p] = hit.url
    else missing.push(p)
  }
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100)
    const { data, error } = await supabase().storage.from(bucket).createSignedUrls(chunk, TTL_SECONDS)
    if (error) throw error
    for (const row of data || []) {
      if (row.signedUrl && row.path) {
        c.set(`${bucket}:${row.path}`, { url: row.signedUrl, expires: now + TTL_SECONDS * 1000 })
        out[row.path] = row.signedUrl
      }
    }
  }
  if (missing.length) save()
  return out
}

/** Links already cached, available right away (no network). */
function cachedNow(paths: string[], bucket: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const c = load()
  const now = Date.now()
  const out: Record<string, string> = {}
  for (const p of paths) {
    const hit = c.get(`${bucket}:${p}`)
    if (hit && hit.expires - now > 10 * 60 * 1000) out[p] = hit.url
  }
  return out
}

export function useSignedUrls(paths: string[], bucket: 'wardrobe' | 'people' = 'wardrobe') {
  const key = [...new Set(paths)].sort().join('|')
  const [urls, setUrls] = useState<Record<string, string>>(() => (key ? cachedNow(key.split('|'), bucket) : {}))
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
  load().delete(`${bucket}:${path}`)
  save()
}

/** Call on sign-out so the next person on this device can't reuse the links. */
export function clearSignedUrls() {
  load().clear()
  try {
    store()?.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
}
