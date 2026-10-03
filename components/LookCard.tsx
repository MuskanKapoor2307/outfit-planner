'use client'
import LookBoard from './LookBoard'
import Icon, { AiBadge } from './Icon'
import Menu from './Menu'
import type { Outfit } from '@/lib/types'

export default function LookCard({
  outfit,
  index,
  urls,
  onOpen,
  onTogglePick,
  onDelete,
  onTryOn,
}: {
  outfit: Outfit
  index: number
  urls: string[]
  onOpen: () => void
  onTogglePick: () => void
  onDelete: () => void
  onTryOn: () => void
}) {
  const described = [outfit.footwear, outfit.accessories, outfit.hairstyle].filter(Boolean) as string[]
  return (
    <div className={`look ${outfit.is_pick ? 'picked' : ''}`} style={{ ['--i' as string]: index }}>
      <div className="option">
        <span>{outfit.is_pick ? <span className="pick-flag">Final pick</span> : `Option ${index + 1}`}</span>
        <span className="row" style={{ gap: 0 }}>
          <button
            type="button"
            className="star-btn"
            aria-pressed={outfit.is_pick}
            aria-label={outfit.is_pick ? 'Unmark final pick' : 'Mark as final pick'}
            onClick={onTogglePick}
          >
            <Icon name="star" />
          </button>
          <Menu
            label={`Options for ${outfit.title}`}
            items={[
              { label: 'Open and edit', icon: 'edit', onClick: onOpen },
              { label: 'Try it on me (free)', icon: 'user', onClick: onTryOn },
              { label: outfit.is_pick ? 'Unmark final pick' : 'Make final pick', icon: 'star', onClick: onTogglePick },
              { label: 'Delete look', icon: 'trash', onClick: onDelete, danger: true },
            ]}
          />
        </span>
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
