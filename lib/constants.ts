import type { SectionKind } from './types'

export const SECTION_KINDS: { id: SectionKind; label: string; icon: string; ideas: string[] }[] = [
  { id: 'time', label: 'Time of day', icon: 'sun', ideas: ['Morning', 'Brunch', 'Afternoon', 'Sunset', 'Evening', 'Night out'] },
  { id: 'event', label: 'Event', icon: 'party', ideas: ['Beach day', 'Pool party', 'Dinner date', 'Sightseeing', 'Travel day', 'Club night', 'Wedding', 'Sangeet'] },
  { id: 'place', label: 'Place', icon: 'pin', ideas: ['Beach', 'Café', 'Cruise', 'Flea market', 'Fort', 'Airport'] },
]

export const DEFAULT_DAY_SECTIONS = ['Morning', 'Afternoon', 'Evening', 'Night']

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'top', label: 'Tops & shirts' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'dress', label: 'Dresses' },
  { id: 'set', label: 'Co-ords & suits' },
  { id: 'outerwear', label: 'Layers' },
  { id: 'ethnic', label: 'Ethnic' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'bag', label: 'Bags' },
  { id: 'jewellery', label: 'Jewellery' },
  { id: 'watch', label: 'Watches' },
  { id: 'eyewear', label: 'Eyewear' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'other', label: 'Other' },
]

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export const OUTFIT_AESTHETICS = [
  'Beachy boho', 'Old money', 'Quiet luxury', 'Clean girl', 'Girly pop', 'Coquette',
  'Resort chic', 'Streetwear', 'Smart casual', 'Party glam', 'Desi festive', 'Gorpcore', 'Casual comfy',
]

export const EMOJIS = ['🌸', '🐚', '🕶️', '👒', '💄', '🦋', '🌙', '🍒', '🌿', '💎', '🎀', '☕', '🧢', '⌚', '🎧', '🏄', '🥃', '🛹']

export function datesBetween(start: string, end: string): string[] {
  const out: string[] = []
  const d = new Date(start + 'T00:00:00')
  const last = new Date(end + 'T00:00:00')
  while (d <= last && out.length < 31) {
    out.push(toISODate(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function toISODate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function prettyDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', opts)
}

export function daysUntil(iso: string) {
  const today = new Date(toISODate(new Date()) + 'T00:00:00').getTime()
  return Math.round((new Date(iso + 'T00:00:00').getTime() - today) / 86400000)
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e)
  if (msg.includes('limit_reached')) return msg.replace(/^.*limit_reached:\s*/, 'Limit reached: ')
  if (msg.includes('row-level security')) return 'That isn’t allowed for your account.'
  if (msg.includes('Failed to fetch')) return 'Can’t reach the server. Check your internet connection and the Supabase URL in .env.local.'
  if (msg.includes('trip_dates_valid')) return 'The last day must be on or after the first day, and a trip can be at most 31 days.'
  if (msg.includes('Invalid login')) return 'Email or password is wrong.'
  return msg
}

/** Only allow normal web links (blocks javascript: and other tricks). */
export function safeLink(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.toString().slice(0, 1000)
  } catch {
    return null
  }
}

export const linkHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
