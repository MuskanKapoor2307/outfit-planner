// Free, on-device outfit ideas: mixes the wardrobe into complete looks without any AI.
// It favours pieces whose name/tags match the occasion and aesthetic, keeps colours easy to wear
// together, and tries not to repeat the same main piece across ideas.
import type { StyleFor, WardrobeItem } from './types'

export interface OutfitIdea {
  title: string
  itemIds: string[]
  why: string
}

// words that hint a piece suits a vibe (matched against the piece's name, colour and tags)
const VIBES: Record<string, string[]> = {
  beach: ['beach', 'linen', 'crochet', 'swim', 'bikini', 'kaftan', 'sarong', 'sandal', 'flip', 'straw', 'shorts', 'floral', 'resort', 'summer', 'cotton', 'sun', 'hat', 'tote'],
  pool: ['swim', 'bikini', 'cover', 'kaftan', 'slides', 'sandal', 'shorts', 'sunglass', 'hat', 'resort'],
  boho: ['boho', 'crochet', 'floral', 'maxi', 'fringe', 'lace', 'tiered', 'beads', 'embroider', 'linen', 'kaftan'],
  party: ['party', 'sequin', 'satin', 'silk', 'glam', 'mini', 'heels', 'clutch', 'shimmer', 'bodycon', 'black', 'gold', 'silver', 'velvet'],
  club: ['party', 'sequin', 'satin', 'mini', 'heels', 'clutch', 'leather', 'black', 'bodycon', 'shimmer'],
  dinner: ['dinner', 'date', 'satin', 'silk', 'midi', 'heels', 'blazer', 'clutch', 'shirt', 'trousers', 'loafers', 'elegant'],
  date: ['date', 'satin', 'silk', 'midi', 'heels', 'clutch', 'lace', 'red', 'pink'],
  festive: ['ethnic', 'kurta', 'saree', 'lehenga', 'sherwani', 'festive', 'silk', 'zari', 'embroider', 'jhumka', 'juttis', 'mojari', 'gold', 'bangles', 'dupatta', 'anarkali'],
  wedding: ['ethnic', 'saree', 'lehenga', 'sherwani', 'kurta', 'festive', 'silk', 'zari', 'gold', 'jhumka', 'heels', 'juttis', 'bandhgala'],
  sangeet: ['lehenga', 'sharara', 'festive', 'mirror', 'sequin', 'jhumka', 'kurta', 'ethnic'],
  sightseeing: ['sneaker', 'trainer', 'jeans', 'tee', 't-shirt', 'shorts', 'cap', 'backpack', 'comfy', 'cotton', 'crossbody', 'sunglass'],
  travel: ['comfy', 'joggers', 'hoodie', 'sneaker', 'tee', 'sweatshirt', 'backpack', 'cardigan', 'leggings', 'jacket'],
  airport: ['comfy', 'joggers', 'hoodie', 'sneaker', 'sweatshirt', 'backpack', 'jacket', 'co-ord'],
  cafe: ['casual', 'jeans', 'shirt', 'top', 'sneaker', 'tote', 'cardigan', 'knit'],
  morning: ['casual', 'cotton', 'linen', 'tee', 'shorts', 'sneaker', 'sandal', 'cap', 'sunglass'],
  evening: ['satin', 'silk', 'heels', 'clutch', 'blazer', 'dress', 'shirt', 'loafers'],
  night: ['party', 'black', 'satin', 'heels', 'clutch', 'leather', 'jacket'],
  'old money': ['linen', 'cashmere', 'knit', 'polo', 'blazer', 'loafers', 'pearl', 'beige', 'cream', 'navy', 'white', 'trousers', 'shirt', 'silk'],
  'quiet luxury': ['cashmere', 'knit', 'silk', 'trousers', 'loafers', 'beige', 'cream', 'black', 'white', 'minimal', 'leather'],
  'clean girl': ['white', 'beige', 'gold', 'hoops', 'slick', 'minimal', 'tank', 'trousers', 'linen', 'cream'],
  'girly pop': ['pink', 'bow', 'mini', 'pastel', 'ruffle', 'floral', 'heart', 'cute'],
  coquette: ['bow', 'lace', 'pink', 'ribbon', 'pearl', 'ruffle', 'satin', 'cream', 'white'],
  resort: ['linen', 'resort', 'maxi', 'kaftan', 'straw', 'sandal', 'white', 'floral', 'silk', 'hat'],
  streetwear: ['oversized', 'hoodie', 'cargo', 'sneaker', 'cap', 'graphic', 'baggy', 'denim', 'jacket', 'tee'],
  'smart casual': ['shirt', 'chinos', 'trousers', 'loafers', 'blazer', 'polo', 'knit', 'watch'],
  glam: ['sequin', 'satin', 'glam', 'heels', 'clutch', 'gold', 'silver', 'shimmer'],
  gorpcore: ['hiking', 'fleece', 'puffer', 'cargo', 'trail', 'windbreaker', 'backpack', 'boots', 'outdoor'],
  comfy: ['comfy', 'joggers', 'hoodie', 'sweatshirt', 'tee', 'sneaker', 'cotton', 'oversized', 'leggings'],
}

const NEUTRALS = ['black', 'white', 'grey', 'gray', 'beige', 'cream', 'navy', 'brown', 'tan', 'denim', 'silver', 'gold', 'nude', 'khaki', 'ivory', 'off white', 'charcoal', 'camel']
const STOP = new Set(['the', 'and', 'for', 'with', 'day', 'look', 'outfit', 'wear', 'time', 'out', 'any', 'some', 'very', 'more'])
const BASE_ONE_PIECE = ['dress', 'set', 'ethnic']

function keywords(text: string): string[] {
  const t = text.toLowerCase()
  const out = new Set<string>()
  for (const [vibe, words] of Object.entries(VIBES)) if (t.includes(vibe)) words.forEach((w) => out.add(w))
  // also use the person's own words ("pool party in goa" → pool, party, goa)
  for (const w of t.split(/[^a-z]+/)) if (w.length > 2 && !STOP.has(w)) out.add(w)
  return [...out]
}

const text = (i: WardrobeItem) => `${i.name} ${i.color ?? ''} ${i.tags.join(' ')}`.toLowerCase()
const isNeutral = (i: WardrobeItem) => !i.color || NEUTRALS.some((n) => i.color!.toLowerCase().includes(n))
const colourKey = (i: WardrobeItem) => (i.color || '').toLowerCase().split(/\s+/).pop() || ''

/** Small seeded random so "Shuffle" gives new but repeatable ideas. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function matchScore(i: WardrobeItem, kws: string[]) {
  if (!kws.length) return 0
  const t = text(i)
  return kws.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0)
}

/** Do these pieces' colours go together? (neutrals go with anything; at most two non-neutral colours) */
function colourScore(pieces: WardrobeItem[]) {
  const bold = [...new Set(pieces.filter((p) => !isNeutral(p)).map(colourKey).filter(Boolean))]
  if (bold.length <= 1) return 2
  if (bold.length === 2) return 0.5
  return -2
}

function pick<T>(list: T[], score: (x: T) => number, rand: () => number, avoid?: Set<T>): T | undefined {
  if (!list.length) return undefined
  // mostly the best matches, with some randomness so ideas vary
  const ranked = list
    .map((x) => ({ x, s: score(x) + rand() * 1.5 - (avoid?.has(x) ? 5 : 0) }))
    .sort((a, b) => b.s - a.s)
  return ranked[0].x
}

export function mixAndMatch(
  items: WardrobeItem[],
  opts: { occasion: string; aesthetic: string; styleFor: StyleFor; count?: number; seed?: number },
): { ideas: OutfitIdea[]; missing: string | null } {
  const count = opts.count ?? 4
  const rand = rng(opts.seed ?? Date.now())
  const kws = keywords(`${opts.occasion} ${opts.aesthetic}`)
  const by = (cats: string[]) => items.filter((i) => cats.includes(i.category))
  const onePieces = by(BASE_ONE_PIECE)
  const tops = by(['top'])
  const bottoms = by(['bottom'])
  const layers = by(['outerwear'])
  const shoes = by(['footwear'])
  const bags = by(['bag'])
  const extras = by(['jewellery', 'watch', 'eyewear', 'accessory'])

  const canSeparates = tops.length > 0 && bottoms.length > 0
  if (!onePieces.length && !canSeparates) {
    return {
      ideas: [],
      missing: 'Add a few tops and bottoms (or dresses, co-ords or ethnic outfits) to your wardrobe to get mix & match ideas.',
    }
  }

  const usedBases = new Set<WardrobeItem>()
  const usedOther = new Set<WardrobeItem>()
  const seen = new Set<string>()
  const ideas: OutfitIdea[] = []

  for (let attempt = 0; ideas.length < count && attempt < count * 6; attempt++) {
    // alternate between one-piece looks and top + bottom, weighted by what fits the vibe
    const onePieceBest = Math.max(-1, ...onePieces.map((i) => matchScore(i, kws)))
    const sepBest = Math.max(-1, ...tops.map((i) => matchScore(i, kws)), ...bottoms.map((i) => matchScore(i, kws)))
    const useOnePiece = onePieces.length > 0 && (!canSeparates || rand() < (onePieceBest >= sepBest ? 0.6 : 0.35))

    const look: WardrobeItem[] = []
    if (useOnePiece) {
      const base = pick(onePieces, (i) => matchScore(i, kws) * 2, rand, usedBases)!
      look.push(base)
    } else {
      const top = pick(tops, (i) => matchScore(i, kws) * 2, rand, usedBases)!
      look.push(top)
      const bottom = pick(bottoms, (i) => matchScore(i, kws) * 2 + colourScore([top, i]), rand, usedOther)!
      look.push(bottom)
    }
    // a layer only when it matches the vibe, or now and then for the evening/travel
    const layer = pick(layers, (i) => matchScore(i, kws) * 2 + colourScore([...look, i]), rand, usedOther)
    if (layer && (matchScore(layer, kws) > 0 || rand() < 0.2)) look.push(layer)
    const shoe = pick(shoes, (i) => matchScore(i, kws) * 2 + colourScore([...look, i]), rand, usedOther)
    if (shoe) look.push(shoe)
    const bag = pick(bags, (i) => matchScore(i, kws) * 2 + colourScore([...look, i]), rand, usedOther)
    if (bag) look.push(bag)
    const extra = pick(extras, (i) => matchScore(i, kws) * 2, rand, usedOther)
    if (extra && (matchScore(extra, kws) > 0 || rand() < 0.5)) look.push(extra)

    const key = look.map((l) => l.id).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    usedBases.add(look[0])
    look.slice(1).forEach((l) => usedOther.add(l))

    const main = look[0]
    const second = !useOnePiece ? look[1] : null
    const matched = look.filter((l) => matchScore(l, kws) > 0)
    const reasons: string[] = []
    if (matched.length && (opts.occasion || opts.aesthetic)) reasons.push(`${matched.map((m) => m.name).slice(0, 2).join(' and ')} fit${matched.length === 1 ? 's' : ''} the ${[opts.occasion, opts.aesthetic].filter(Boolean).join(', ').toLowerCase()} vibe`)
    const bold = look.filter((l) => !isNeutral(l))
    if (bold.length <= 1) reasons.push(bold.length ? `${bold[0].color!.toLowerCase()} stands out against easy neutrals` : 'easy neutral colours that all go together')
    else reasons.push('a two-colour mix')
    if (!shoes.length) reasons.push('add footwear to finish it')

    ideas.push({
      title: second ? `${main.name} + ${second.name}` : main.name,
      itemIds: look.map((l) => l.id),
      why: reasons.join('; ').replace(/^./, (c) => c.toUpperCase()) + '.',
    })
  }
  return { ideas, missing: null }
}
