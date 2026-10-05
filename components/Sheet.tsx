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

  // Phones: keep the sheet above the on-screen keyboard and the field being typed in visible.
  // iPhone Safari doesn't shrink the page for the keyboard, so we measure the visible area ourselves.
  useEffect(() => {
    const d = ref.current
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!open || !d || !vv) return
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      d.style.setProperty('--kb', `${Math.round(keyboard)}px`)
      d.style.setProperty('--vvh', `${Math.round(vv.height)}px`)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (!t.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select')) return
      clearTimeout(timer)
      // wait for the keyboard to finish sliding up, then bring the field into view
      timer = setTimeout(() => {
        update()
        t.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 320)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    d.addEventListener('focusin', onFocus)
    return () => {
      clearTimeout(timer)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      d.removeEventListener('focusin', onFocus)
      d.style.removeProperty('--kb')
      d.style.removeProperty('--vvh')
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
