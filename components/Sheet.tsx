'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

// how many sheets are open right now (sheets can open on top of each other)
let openSheets = 0
function lockPage(on: boolean) {
  openSheets = Math.max(0, openSheets + (on ? 1 : -1))
  document.documentElement.classList.toggle('sheet-open', openSheets > 0)
}

/** Accessible modal. Slides up as a sheet on phones, animates in and out. */
export default function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  size,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'small'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open) {
      setVisible(true)
      d.classList.remove('closing')
      if (!d.open) {
        d.showModal()
        // iPhone Safari scrolls to whatever showModal focused, which can shove the sheet off-screen
        d.querySelector<HTMLElement>('.sheet-head button')?.focus({ preventScroll: true })
        d.querySelector('.sheet-body')?.scrollTo(0, 0)
      }
      lockPage(true)
      return () => lockPage(false)
    } else if (d.open) {
      d.classList.add('closing')
      const t = setTimeout(() => {
        d.close()
        d.classList.remove('closing')
        setVisible(false)
      }, 190)
      return () => clearTimeout(t)
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`sheet ${size === 'small' ? 'small' : ''}`}
      aria-label={typeof title === 'string' ? title : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {(open || visible) && (
        <>
          <span className="grab" aria-hidden />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="btn ghost icon-only" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}
