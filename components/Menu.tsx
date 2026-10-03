'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

export interface MenuItem {
  label: string
  icon: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export default function Menu({ items, label = 'More options', trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn ghost icon-only" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger ?? <Icon name="dots" />}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={it.danger ? 'danger' : undefined}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
            >
              <Icon name={it.icon} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
