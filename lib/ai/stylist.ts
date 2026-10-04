'use client'
import type { SectionKind, StyleFor, WardrobeItem } from '../types'
import { categoryLabel } from '../constants'

export type AskType = 'complete' | 'footwear' | 'accessories' | 'hair' | 'custom'

export const ASKS: { id: AskType; label: (s: StyleFor) => string }[] = [
  { id: 'complete', label: () => 'Complete the look' },
  { id: 'footwear', label: () => 'Footwear' },
  { id: 'accessories', label: (s) => (s === 'men' ? 'Watch, bag and accessories' : 'Jewellery, bag and accessories') },
  { id: 'hair', label: (s) => (s === 'men' ? 'Hair and grooming' : 'Hair and makeup') },
  { id: 'custom', label: () => 'Ask something else' },
]

export interface StylistInput {
  ask: AskType
  customAsk: string
  styleFor: StyleFor
  aesthetic: string
  note: string
  tripName: string
  destination: string | null
  dayLabel: string
  sectionName: string
  sectionKind: SectionKind
  pieces: WardrobeItem[] // these photos are attached
  wardrobe: WardrobeItem[] // listed as text only (may be empty)
}

export interface StylistResult {
  look_name: string
  summary: string
  use_from_wardrobe: { itemId: string; why: string }[]
  footwear: string
  accessories: string
  jewellery: string
  bag: string
  layers: string
  hair: string
  makeup_or_grooming: string
  colour_palette: string[]
  to_buy: string[]
  pinterest_searches: string[]
}

/** How many different looks to ask for. */
export const LOOK_COUNT = 3

const describe = (i: WardrobeItem) =>
  `${i.name} (${categoryLabel(i.category).toLowerCase()}${i.color ? `, ${i.color.toLowerCase()}` : ''}${i.tags.length ? `; ${i.tags.slice(0, 4).join(', ')}` : ''})`

const ASK_TEXT: Record<AskType, string> = {
  complete: `Give ${LOOK_COUNT} DIFFERENT complete outfit options around the pieces in the photos (or from scratch if there are none), each with a clearly different vibe: what else to wear, footwear, accessories, bag, layers, hair and makeup or grooming.`,
  footwear: `Give ${LOOK_COUNT} different footwear options that work with these pieces (one per option). Leave unrelated fields empty.`,
  accessories: `Give ${LOOK_COUNT} different jewellery or watch, bag and accessory options for these pieces. Leave unrelated fields empty.`,
  hair: `Give ${LOOK_COUNT} different hair and makeup or grooming options for this look. Leave unrelated fields empty.`,
  custom: '',
}

export const SYSTEM_PROMPT = `You are a warm, practical personal stylist. You give specific, wearable suggestions (colour, material, shape) that suit the occasion, place and likely weather. You prefer pieces the person already owns when they fit. You never invent codes: only use codes that appear in the wardrobe list. You reply with JSON only, no other text.`

export function buildPrompt(input: StylistInput) {
  const pieceCodes = input.pieces.map((p, i) => ({ code: `P${i + 1}`, item: p }))
  const wardrobeCodes = input.wardrobe
    .filter((w) => !input.pieces.some((p) => p.id === w.id))
    .slice(0, 120)
    .map((w, i) => ({ code: `W${i + 1}`, item: w }))

  const ask =
    input.ask === 'custom'
      ? `${input.customAsk.trim() || 'Complete the look.'} Give 2 or ${LOOK_COUNT} different options if the question allows it.`
      : ASK_TEXT[input.ask]
  const forWhom = input.styleFor === 'men' ? 'a man' : input.styleFor === 'women' ? 'a woman' : 'a person (keep suggestions gender-neutral unless the pieces suggest otherwise)'

  const lines = [
    `Styling for: ${forWhom}`,
    `Trip: ${input.tripName}${input.destination ? ` in ${input.destination}` : ''}, ${input.dayLabel}`,
    `This outfit is for: ${input.sectionName} (${input.sectionKind === 'time' ? 'time of day' : input.sectionKind})`,
    input.aesthetic ? `Aesthetic: ${input.aesthetic}` : '',
    input.note.trim() ? `Notes from me: ${input.note.trim().slice(0, 500)}` : '',
    '',
    `What I want: ${ask}`,
    '',
    pieceCodes.length
      ? `Pieces in the attached photos, in order:\n${pieceCodes.map((p) => `${p.code}: ${describe(p.item)}`).join('\n')}`
      : 'No photos attached. Suggest a look from scratch, using my wardrobe where it fits.',
    '',
    wardrobeCodes.length
      ? `My wardrobe (text only, use these codes if you pick something I own):\n${wardrobeCodes.map((w) => `${w.code}: ${describe(w.item)}`).join('\n')}`
      : 'My wardrobe list was not shared.',
    '',
    `Reply with ONLY this JSON (use "" or [] for anything that doesn't apply). Each option in "looks" must be different:
{
  "looks": [
    {
      "look_name": "short catchy name, max 6 words",
      "summary": "2-3 sentences on the idea and why it works for this occasion",
      "use_from_wardrobe": [{"code": "W1", "why": "short reason"}],
      "footwear": "", "accessories": "", "jewellery": "", "bag": "", "layers": "",
      "hair": "", "makeup_or_grooming": "",
      "colour_palette": ["3-5 colour names"],
      "to_buy": ["only if something important is missing"],
      "pinterest_searches": ["2-3 short, specific photo search phrases for this exact look, e.g. 'white linen co-ord tan sandals beach'"]
    }
  ]
}`,
  ].filter((l) => l !== null)

  return { text: lines.join('\n'), pieceCodes, wardrobeCodes }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const strList = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []

/** Reads the AI's reply. Treats it as untrusted: only known fields, plain text, known codes. 1 to 3 looks. */
export function parseResult(raw: string, codes: { code: string; item: WardrobeItem }[]): StylistResult[] {
  let t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '')
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('The reply didn’t contain the expected format. Try again, or paste the whole reply.')
  t = t.slice(a, b + 1)
  let j: Record<string, unknown>
  try {
    j = JSON.parse(t)
  } catch {
    throw new Error('The reply couldn’t be read. Try again, or paste the whole reply including the { and }.')
  }
  const byCode = new Map(codes.map((c) => [c.code.toUpperCase(), c.item.id]))
  // new format: { looks: [...] }; older single-look replies are still accepted
  const raws = Array.isArray(j.looks) ? (j.looks as unknown[]) : [j]
  const looks = raws
    .slice(0, LOOK_COUNT)
    .map((x) => readLook((x || {}) as Record<string, unknown>, byCode))
    .filter((l) => l.summary || l.use_from_wardrobe.length || l.footwear || l.accessories || l.jewellery || l.hair || l.makeup_or_grooming)
  if (!looks.length) throw new Error('The reply had no outfit ideas in it. Try again.')
  return looks
}

function readLook(j: Record<string, unknown>, byCode: Map<string, string>): StylistResult {
  const used = Array.isArray(j.use_from_wardrobe)
    ? (j.use_from_wardrobe as unknown[])
        .map((u) => {
          const o = (u || {}) as Record<string, unknown>
          const id = byCode.get(str(o.code, 8).toUpperCase())
          return id ? { itemId: id, why: str(o.why, 160) } : null
        })
        .filter((x): x is { itemId: string; why: string } => !!x)
        .slice(0, 8)
    : []
  return {
    look_name: str(j.look_name, 60) || 'Styled look',
    summary: str(j.summary, 600),
    use_from_wardrobe: used,
    footwear: str(j.footwear, 200),
    accessories: str(j.accessories, 200),
    jewellery: str(j.jewellery, 200),
    bag: str(j.bag, 160),
    layers: str(j.layers, 200),
    hair: str(j.hair, 200),
    makeup_or_grooming: str(j.makeup_or_grooming, 200),
    colour_palette: strList(j.colour_palette, 6, 30),
    to_buy: strList(j.to_buy, 6, 120),
    pinterest_searches: strList(j.pinterest_searches, 4, 80),
  }
}

export const pinterestUrl = (q: string) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`
/** Photo search (opens in a new tab; nothing is loaded inside the app). */
export const imagesUrl = (q: string) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`

/** Full text for copy-paste mode (their own Claude / ChatGPT app). */
export function manualPrompt(text: string, photoCount: number) {
  return `${SYSTEM_PROMPT}

${photoCount ? `I'm attaching ${photoCount} photo${photoCount > 1 ? 's' : ''} in the order listed below (P1 first).` : ''}

${text}

Put the JSON inside a single code block.`
}
