'use client'
// Tiny per-tab cache (sessionStorage) so screens can show the last-known data instantly
// and refresh it in the background. Cleared when the tab or app is closed.

export function readCache<T>(key: string): T | null {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(`op:${key}`) : null
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) window.sessionStorage.removeItem(`op:${key}`)
    else window.sessionStorage.setItem(`op:${key}`, JSON.stringify(value))
  } catch {
    /* storage full or blocked: skip the cache */
  }
}

/** Remove every cached entry (on sign-out). */
export function clearCache() {
  try {
    const s = window.sessionStorage
    for (const k of Object.keys(s)) if (k.startsWith('op:')) s.removeItem(k)
  } catch {
    /* ignore */
  }
}
