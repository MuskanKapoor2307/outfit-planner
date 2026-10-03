export type ThemeId =
  | 'pink-pop' | 'coquette' | 'vanilla-latte' | 'riviera' | 'y2k'
  | 'quiet-luxury' | 'street' | 'tailored' | 'trail'
  | 'mono' | 'desert-boho' | 'academia'
export type StyleFor = 'women' | 'men' | 'any'
export type SectionKind = 'time' | 'event' | 'place'

export interface StyleProfile {
  id: string
  owner_id: string
  name: string
  theme: ThemeId
  emoji: string | null
  style_for: StyleFor
  created_at: string
}

export interface WardrobeItem {
  id: string
  owner_id: string
  profile_id: string
  image_path: string
  name: string
  category: string
  color: string | null
  tags: string[]
  created_at: string
}

export interface Trip {
  id: string
  profile_id: string
  name: string
  destination: string | null
  start_date: string
  end_date: string
  notes: string | null
  created_at: string
}

export interface Section {
  id: string
  trip_id: string
  day: string
  name: string
  kind: SectionKind
  position: number
  created_at: string
}

export interface OutfitItemLink {
  item_id: string
  position: number
}

export interface Outfit {
  id: string
  trip_id: string
  section_id: string
  title: string
  aesthetic: string | null
  footwear: string | null
  accessories: string | null
  hairstyle: string | null
  notes: string | null
  is_pick: boolean
  ai_generated: boolean
  created_at: string
  outfit_items: OutfitItemLink[]
}
