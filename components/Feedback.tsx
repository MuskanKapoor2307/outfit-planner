'use client'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Sheet from './Sheet'
import Icon from './Icon'
import PasswordInput from './PasswordInput'

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  danger?: boolean
  /** person must type this exact text to enable the button */
  typeToConfirm?: string
}
interface AskOptions {
  title: string
  message?: ReactNode
  label: string
  confirmText?: string
  secret?: boolean
  initial?: string
  inputMode?: 'text' | 'numeric'
}

interface FeedbackApi {
  toast: (message: string, kind?: 'ok' | 'error') => void
  confirm: (o: ConfirmOptions) => Promise<boolean>
  ask: (o: AskOptions) => Promise<string | null>
}

const Ctx = createContext<FeedbackApi | null>(null)

type DialogState =
  | { kind: 'confirm'; o: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'ask'; o: AskOptions; resolve: (v: string | null) => void }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: 'ok' | 'error' }[]>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const idRef = useRef(0)

  const toast = useCallback((message: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++idRef.current
    setToasts((t) => [...t.slice(-2), { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200)
  }, [])

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setText('')
    setDialog({ kind: 'confirm', o, resolve })
    setOpen(true)
  }), [])

  const ask = useCallback((o: AskOptions) => new Promise<string | null>((resolve) => {
    setText(o.initial ?? '')
    setDialog({ kind: 'ask', o, resolve })
    setOpen(true)
  }), [])

  function finish(ok: boolean) {
    if (!dialog) return
    if (dialog.kind === 'confirm') dialog.resolve(ok)
    else dialog.resolve(ok ? text : null)
    setOpen(false)
  }

  const blocked = dialog?.kind === 'confirm' && !!dialog.o.typeToConfirm && text.trim() !== dialog.o.typeToConfirm

  return (
    <Ctx.Provider value={{ toast, confirm, ask }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={t.kind === 'error' ? 'alert' : 'check'} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      <Sheet
        open={open}
        size="small"
        title={dialog?.o.title ?? ''}
        onClose={() => finish(false)}
        footer={
          <>
            <button className="btn ghost" onClick={() => finish(false)}>Cancel</button>
            <button
              className={`btn ${dialog?.kind === 'confirm' && dialog.o.danger ? 'danger' : 'primary'}`}
              disabled={blocked}
              onClick={() => finish(true)}
            >
              {dialog?.o.confirmText ?? 'OK'}
            </button>
          </>
        }
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!blocked) finish(true)
          }}
        >
          {dialog?.o.message && <div className="muted">{dialog.o.message}</div>}
          {dialog?.kind === 'confirm' && dialog.o.typeToConfirm && (
            <label className="field">
              <span>Type <strong>{dialog.o.typeToConfirm}</strong> to confirm</span>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus autoComplete="off" />
            </label>
          )}
          {dialog?.kind === 'ask' && (
            <label className="field">
              <span>{dialog.o.label}</span>
              {dialog.o.secret ? (
                <PasswordInput value={text} onChange={setText} autoFocus inputMode={dialog.o.inputMode} autoComplete="off" />
              ) : (
                <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus inputMode={dialog.o.inputMode} />
              )}
            </label>
          )}
          <button type="submit" hidden />
        </form>
      </Sheet>
    </Ctx.Provider>
  )
}

export function useFeedback() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFeedback must be used inside FeedbackProvider')
  return v
}
