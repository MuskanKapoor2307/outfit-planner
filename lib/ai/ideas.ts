'use client'
// AI "outfit ideas from my wardrobe": sends a TEXT-ONLY wardrobe list (no photos) and asks for
// several complete looks made from it. The reply is untrusted and parsed strictly.
import type { SectionKind, StyleFor, WardrobeItem } from '../types'
import { categoryLabel } from '../constants'
import type { OutfitIdea } from '../mixMatch'

export interface IdeasInput {
  styleFor: StyleFor
  occasion: string
  sectionKind: SectionKind
  aesthetic: string
  note: string
  tripName: string
  destination: string | null
  dayLabel: string
  wardrobe: WardrobeItem[]
}

export interface AiIdea extends OutfitIdea {
  footwear: string
  accessories: string
  hair: string
}

export const IDEAS_SYSTEM_PROMPT = `You are a warm, practical personal stylist who is great at mixing and matching what someone already owns into fresh outfits. You only use codes that appear in the wardrobe list. You reply with JSON only, no other text.`

const describe = (i: WardrobeItem) =>
  `${i.name} (${categoryLabel(i.category).toLowerCase()}${i.color ? `, ${i.color.toLowerCase()}` : ''}${i.tags.length ? `; ${i.tags.slice(0, 4).join(', ')}` : ''})`

export function buildIdeasPrompt(input: IdeasInput, count = 3) {
  const codes = input.wardrobe.slice(0, 200).map((w, i) => ({ code: `W${i + 1}`, item: w }))
  const forWhom = input.styleFor === 'men' ? 'a man' : input.styleFor === 'women' ? 'a woman' : 'a person (keep it gender-neutral unless the pieces suggest otherwise)'
  const text = [
    `Styling for: ${forWhom}`,
    `Trip: ${input.tripName}${input.destination ? ` in ${input.destination}` : ''}${input.dayLabel ? `, ${input.dayLabel}` : ''}`,
    `Occasion: ${input.occasion || 'any'}${input.sectionKind === 'time' ? ' (time of day)' : input.sectionKind === 'place' ? ' (place)' : ''}`,
    input.aesthetic ? `Aesthetic I want: ${input.aesthetic}` : 'Aesthetic: your choice, whatever suits the occasion',
    input.note.trim() ? `Notes from me: ${input.note.trim().slice(0, 400)}` : '',
    '',
    `Create ${count} DIFFERENT complete outfits using ONLY pieces from my wardrobe below. Mix and match in new ways: each outfit should feel distinct. Each outfit needs clothing that covers a full look (a dress/co-ord/ethnic outfit, or a top with a bottom), plus footwear and accessories from the list when available. If something important is missing from my wardrobe, mention it in "accessories" or "footwear" as a suggestion.`,
    '',
    `My wardrobe (use these codes):\n${codes.map((c) => `${c.code}: ${describe(c.item)}`).join('\n')}`,
    '',
    `Reply with ONLY this JSON:
{
  "outfits": [
    {
      "look_name": "short catchy name, max 6 words",
      "codes": ["W1", "W7", "W12"],
      "why": "1-2 sentences on why this works for the occasion and aesthetic",
      "footwear": "which footwear, or what to wear if none is listed",
      "accessories": "jewellery, bag and accessory tips",
      "hair": "quick hair and makeup or grooming tip"
    }
  ]
}`,
  ]
    .filter((l) => l !== '')
    .join('\n')
  return { text, codes }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Reads the AI's reply. Untrusted: only known fields, plain text, and codes that exist. */
export function parseIdeas(raw: string, codes: { code: string; item: WardrobeItem }[]): AiIdea[] {
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
  const list = Array.isArray(j.outfits) ? (j.outfits as unknown[]) : []
  const ideas = list
    .map((o): AiIdea | null => {
      const r = (o || {}) as Record<string, unknown>
      const ids = Array.isArray(r.codes)
        ? [...new Set((r.codes as unknown[]).map((c) => byCode.get(str(c, 8).toUpperCase())).filter((x): x is string => !!x))].slice(0, 10)
        : []
      if (!ids.length) return null
      return {
        title: str(r.look_name, 60) || 'Outfit idea',
        itemIds: ids,
        why: str(r.why, 400),
        footwear: str(r.footwear, 200),
        accessories: str(r.accessories, 300),
        hair: str(r.hair, 200),
      }
    })
    .filter((x): x is AiIdea => !!x)
    .slice(0, 6)
  if (!ideas.length) throw new Error('The reply had no outfits made from your wardrobe. Try again.')
  return ideas
}

export function manualIdeasPrompt(text: string) {
  return `${IDEAS_SYSTEM_PROMPT}\n\n${text}\n\nPut the JSON inside a single code block.`
}
