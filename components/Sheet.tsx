'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'

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
      if (!d.open) d.showModal()
      d.classList.remove('closing')
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
