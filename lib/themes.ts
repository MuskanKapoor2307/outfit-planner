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
  { id: 'picnic', name: 'Picnic', group: 'her', blurb: 'Tomato red, gingham and butter script', bar: '#b83b3b' },
  { id: 'stylebook', name: 'Stylebook', group: 'her', blurb: 'Blue gingham binder and typewriter notes', bar: '#dfe8fb' },
  { id: 'vloset', name: 'Vloset', group: 'her', blurb: 'Pastel stripes, coffee brown and egg yolk', bar: '#d6e3f8' },
  { id: 'matcha', name: 'Matcha', group: 'her', blurb: 'Lime polka dots and scalloped stamps', bar: '#c3cc5a' },
  { id: 'happiness', name: 'Happiness', group: 'her', blurb: 'Red stripes, torn paper and gold stars', bar: '#b8202f' },
  { id: 'denim', name: 'Denim', group: 'him', blurb: 'Indigo denim, kraft labels, orange stitching', bar: '#2c4470' },
  { id: 'kraft', name: 'Kraft', group: 'him', blurb: 'Brown paper, ink stamps, typewriter', bar: '#b8956a' },
  { id: 'varsity', name: 'Varsity', group: 'him', blurb: 'Navy, cream and college stripes', bar: '#1d2b4f' },
  { id: 'darkroom', name: 'Darkroom', group: 'anyone', blurb: 'Black paper and safelight red, dark', bar: '#121212' },
]

export const themeInfo = (id: string) => THEMES.find((t) => t.id === id)
export const STUDIO_BAR = '#d6e3f8'
