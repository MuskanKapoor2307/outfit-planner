export type ThemeId =
  | 'picnic' | 'stylebook' | 'vloset' | 'matcha' | 'happiness'
  | 'denim' | 'kraft' | 'varsity'
  | 'darkroom'
export type StyleFor = 'women' | 'men' | 'any'
export type SectionKind = 'time' | 'event' | 'place'

export interface StyleProfile {
  id: string
  owner_id: string
  name: string
  theme: ThemeId
  emoji: string | null
  style_for: StyleFor
  body_photo_path: string | null
  body_photo_consent_at: string | null
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
  tryon: TryOnPlacement[] | null
  created_at: string
  outfit_items: OutfitItemLink[]
}

/** Position of one piece on the try-on board, in % of the board. */
export interface TryOnPlacement {
  item_id: string
  x: number // centre, 0–100
  y: number // centre, 0–100
  w: number // width, 5–100
  r: number // rotation in degrees
  z: number
}

export type ShoppingStatus = 'to_buy' | 'bought' | 'in_wardrobe'

export interface ShoppingItem {
  id: string
  trip_id: string
  name: string
  url: string | null
  price: number | null
  category: string | null
  notes: string | null
  status: ShoppingStatus
  wardrobe_item_id: string | null
  created_at: string
}
