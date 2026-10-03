import type { ThemeId } from './types'

export type ThemeGroup = 'her' | 'him' | 'anyone'

export interface ThemeInfo {
  id: ThemeId
  name: string
  group: ThemeGroup
  blurb: string
  bar: string // phone status-bar colour
}

export const THEME_GROUPS: { id: ThemeGroup; label: string }[] = [
  { id: 'her', label: 'For her' },
  { id: 'him', label: 'For him' },
  { id: 'anyone', label: 'For anyone' },
]

export const THEMES: ThemeInfo[] = [
  { id: 'pink-pop', name: 'Pink pop', group: 'her', blurb: 'Hot pink, cherry red, sticker edges', bar: '#ffe4f0' },
  { id: 'coquette', name: 'Coquette', group: 'her', blurb: 'Blush, ribbon red, lace scallops', bar: '#fbecec' },
  { id: 'vanilla-latte', name: 'Vanilla latte', group: 'her', blurb: 'Clean-girl creams and soft caramel', bar: '#f7f2ec' },
  { id: 'riviera', name: 'Riviera', group: 'her', blurb: 'Old-money navy, linen and gold', bar: '#f4eee2' },
  { id: 'y2k', name: 'Y2K chrome', group: 'her', blurb: 'Lilac shimmer and bubble type', bar: '#ece8ff' },
  { id: 'quiet-luxury', name: 'Quiet luxury', group: 'him', blurb: 'Stone, camel and charcoal', bar: '#e9e5de' },
  { id: 'street', name: 'Street', group: 'him', blurb: 'Concrete grey, tape orange, bold type', bar: '#d8d8d4' },
  { id: 'tailored', name: 'Tailored', group: 'him', blurb: 'Midnight navy, pinstripe, brass', bar: '#141d33' },
  { id: 'trail', name: 'Trail', group: 'him', blurb: 'Gorpcore olive, khaki and blaze', bar: '#e5e0cc' },
  { id: 'mono', name: 'Mono', group: 'anyone', blurb: 'Black, white and one yellow marker', bar: '#fafafa' },
  { id: 'desert-boho', name: 'Desert boho', group: 'anyone', blurb: 'Rust, mustard and arched frames', bar: '#f4e6d2' },
  { id: 'academia', name: 'Academia', group: 'anyone', blurb: 'Candlelit browns and oxblood, dark', bar: '#1c1814' },
]

export const themeInfo = (id: string) => THEMES.find((t) => t.id === id)
export const STUDIO_BAR = '#2a1b3d'
