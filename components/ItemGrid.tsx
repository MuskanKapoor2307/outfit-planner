'use client'
import { categoryLabel } from '@/lib/constants'
import type { WardrobeItem } from '@/lib/types'

export default function ItemGrid({
  items,
  urls,
  onPick,
  selected,
}: {
  items: WardrobeItem[]
  urls: Record<string, string>
  onPick: (item: WardrobeItem) => void
  selected?: string[]
}) {
  return (
    <div className="items">
      {items.map((it) => {
        const idx = selected ? selected.indexOf(it.id) : -1
        return (
          <button
            key={it.id}
            type="button"
            className="item"
            onClick={() => onPick(it)}
            aria-pressed={selected ? idx >= 0 : undefined}
          >
            <span className="pic">{urls[it.image_path] ? <img src={urls[it.image_path]} alt="" loading="lazy" /> : null}</span>
            {idx >= 0 && <span className="picked">{idx + 1}</span>}
            <span className="label">{it.name}</span>
            <span className="sub">
              {categoryLabel(it.category)}
              {it.color ? `, ${it.color.toLowerCase()}` : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
