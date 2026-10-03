'use client'
/**
 * AI settings live ONLY on this device (browser storage). API keys never go to
 * our database or server. Keys can be:
 *  - remembered on this device,
 *  - remembered on this device and locked with a PIN (encrypted), or
 *  - kept only until the tab is closed.
 */

export type ProviderId = 'gemini' | 'claude' | 'openai' | 'manual'
export type KeyProvider = Exclude<ProviderId, 'manual'>

export interface AiSettings {
  enabled: boolean
  provider: ProviderId
  models: Record<KeyProvider, string>
  consent: Partial<Record<ProviderId, boolean>>
}

export const PROVIDERS: { id: ProviderId; name: string; cost: string; blurb: string }[] = [
  { id: 'gemini', name: 'Google Gemini', cost: 'Free key', blurb: 'Free daily limit. Free-tier data may be used by Google to improve its models.' },
  { id: 'claude', name: 'Claude (Anthropic)', cost: 'Paid key', blurb: 'Pay per use with your own Anthropic API key.' },
  { id: 'openai', name: 'OpenAI', cost: 'Paid key', blurb: 'Pay per use with your own OpenAI API key.' },
  { id: 'manual', name: 'My chat app', cost: 'Your subscription', blurb: 'Copy a ready prompt into the Claude or ChatGPT app, then paste the reply back. No key needed.' },
]

export const DEFAULT_MODELS: Record<KeyProvider, string> = {
  gemini: 'gemini-flash-latest',
  claude: 'claude-sonnet-5-5',
  openai: 'gpt-5-mini',
}
export const GEMINI_FALLBACK_MODEL = 'gemini-flash-lite-latest'

const SETTINGS_KEY = 'op.ai.settings'
const KEY_PREFIX = 'op.ai.key.'

const defaults: AiSettings = { enabled: true, provider: 'gemini', models: { ...DEFAULT_MODELS }, consent: {} }

function safeGet(store: Storage, k: string) {
  try { return store.getItem(k) } catch { return null }
}
function safeSet(store: Storage, k: string, v: string) {
  try { store.setItem(k, v) } catch {}
}
function safeDel(store: Storage, k: string) {
  try { store.removeItem(k) } catch {}
}

export function loadSettings(): AiSettings {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = safeGet(localStorage, SETTINGS_KEY)
    if (!raw) return { ...defaults, models: { ...DEFAULT_MODELS } }
    const s = JSON.parse(raw)
    return { ...defaults, ...s, models: { ...DEFAULT_MODELS, ...(s.models || {}) }, consent: s.consent || {} }
  } catch {
    return { ...defaults, models: { ...DEFAULT_MODELS } }
  }
}

export function saveSettings(s: AiSettings) {
  safeSet(localStorage, SETTINGS_KEY, JSON.stringify(s))
  window.dispatchEvent(new Event('op-ai-settings'))
}

// ---------- Keys ----------
type StoredKey = { type: 'plain'; value: string } | { type: 'pin'; salt: string; iv: string; data: string }

const unlocked = new Map<KeyProvider, string>() // in memory for this tab only

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(pin: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 250000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export type KeyMode = 'device' | 'pin' | 'session'

export async function saveKey(p: KeyProvider, key: string, mode: KeyMode, pin?: string) {
  removeKey(p)
  const value = key.trim()
  if (mode === 'session') {
    safeSet(sessionStorage, KEY_PREFIX + p, JSON.stringify({ type: 'plain', value }))
  } else if (mode === 'pin') {
    if (!pin || pin.length < 4) throw new Error('Use a PIN of at least 4 digits.')
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const k = await deriveKey(pin, salt)
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(value))
    safeSet(localStorage, KEY_PREFIX + p, JSON.stringify({ type: 'pin', salt: b64(salt), iv: b64(iv), data: b64(data) }))
  } else {
    safeSet(localStorage, KEY_PREFIX + p, JSON.stringify({ type: 'plain', value }))
  }
  unlocked.set(p, value)
  window.dispatchEvent(new Event('op-ai-settings'))
}

function readStored(p: KeyProvider): { stored: StoredKey; where: 'device' | 'session' } | null {
  for (const [store, where] of [[sessionStorage, 'session'], [localStorage, 'device']] as const) {
    const raw = safeGet(store, KEY_PREFIX + p)
    if (raw) {
      try { return { stored: JSON.parse(raw), where } } catch {}
    }
  }
  return null
}

export function keyStatus(p: KeyProvider): 'none' | 'ready' | 'locked' {
  if (unlocked.has(p)) return 'ready'
  const r = readStored(p)
  if (!r) return 'none'
  return r.stored.type === 'pin' ? 'locked' : 'ready'
}

export function keyMode(p: KeyProvider): KeyMode | null {
  const r = readStored(p)
  if (!r) return null
  if (r.where === 'session') return 'session'
  return r.stored.type === 'pin' ? 'pin' : 'device'
}

/** Returns the key. If it's PIN-locked, askPin is called to get the PIN. */
export async function getKey(p: KeyProvider, askPin: () => Promise<string | null>): Promise<string | null> {
  const mem = unlocked.get(p)
  if (mem) return mem
  const r = readStored(p)
  if (!r) return null
  if (r.stored.type === 'plain') {
    unlocked.set(p, r.stored.value)
    return r.stored.value
  }
  const pin = await askPin()
  if (!pin) return null
  try {
    const k = await deriveKey(pin, unb64(r.stored.salt))
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(r.stored.iv) as BufferSource }, k, unb64(r.stored.data) as BufferSource)
    const value = new TextDecoder().decode(plain)
    unlocked.set(p, value)
    return value
  } catch {
    throw new Error('Wrong PIN.')
  }
}

export function removeKey(p: KeyProvider) {
  unlocked.delete(p)
  safeDel(localStorage, KEY_PREFIX + p)
  safeDel(sessionStorage, KEY_PREFIX + p)
  window.dispatchEvent(new Event('op-ai-settings'))
}

/** Forget unlocked keys (used on log out). Device-saved keys stay unless removed. */
export function lockAllKeys() {
  unlocked.clear()
}

export function removeAllKeys() {
  for (const p of ['gemini', 'claude', 'openai'] as const) removeKey(p)
}

// ---------- Simple daily counter (per device) ----------
function pacificDay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())
}
export function countRequest(p: ProviderId) {
  const k = `op.ai.count.${p}`
  const day = pacificDay()
  let c = { day, n: 0 }
  try { c = JSON.parse(safeGet(localStorage, k) || '') } catch {}
  if (c.day !== day) c = { day, n: 0 }
  c.n++
  safeSet(localStorage, k, JSON.stringify(c))
}
export function requestsToday(p: ProviderId): number {
  try {
    const c = JSON.parse(safeGet(localStorage, `op.ai.count.${p}`) || '')
    return c.day === pacificDay() ? c.n : 0
  } catch {
    return 0
  }
}

export function bgRemovalPreference(): boolean {
  return safeGet(localStorage, 'op.bg.remove') !== 'off'
}
export function setBgRemovalPreference(on: boolean) {
  safeSet(localStorage, 'op.bg.remove', on ? 'on' : 'off')
}
