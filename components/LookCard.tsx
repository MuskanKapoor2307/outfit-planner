'use client'
import LookBoard from './LookBoard'
import Icon, { AiBadge } from './Icon'
import type { Outfit } from '@/lib/types'

export default function LookCard({
  outfit,
  index,
  urls,
  onOpen,
  onTogglePick,
}: {
  outfit: Outfit
  index: number
  urls: string[]
  onOpen: () => void
  onTogglePick: () => void
}) {
  const described = [outfit.footwear, outfit.accessories, outfit.hairstyle].filter(Boolean) as string[]
  return (
    <div className={`look ${outfit.is_pick ? 'picked' : ''}`} style={{ ['--i' as string]: index }}>
      <div className="option">
        <span>{outfit.is_pick ? <span className="pick-flag">Final pick</span> : `Option ${index + 1}`}</span>
        <button
          type="button"
          className="star-btn"
          aria-pressed={outfit.is_pick}
          aria-label={outfit.is_pick ? 'Unmark final pick' : 'Mark as final pick'}
          onClick={onTogglePick}
        >
          <Icon name="star" />
        </button>
      </div>
      <button type="button" className="look" onClick={onOpen} aria-label={`Open ${outfit.title}`}>
        {urls.length === 0 && described.length > 0 ? (
          <div className="board">
            <div className="described">{described.slice(0, 3).map((d, i) => <span key={i}>{d}</span>)}</div>
          </div>
        ) : (
          <LookBoard urls={urls} />
        )}
        <span className="title">{outfit.title}</span>
        <span className="meta">
          {outfit.ai_generated && <AiBadge text="AI idea" />}
          {outfit.aesthetic && <span>{outfit.aesthetic}</span>}
        </span>
      </button>
    </div>
  )
}
