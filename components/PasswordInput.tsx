'use client'
import { useState } from 'react'
import Icon from './Icon'

/** Password field with a show/hide button and a Caps Lock warning. */
export default function PasswordInput({
  value,
  onChange,
  id,
  autoComplete = 'current-password',
  autoFocus,
  inputMode,
  required,
  minLength,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
  autoComplete?: string
  autoFocus?: boolean
  inputMode?: 'text' | 'numeric'
  required?: boolean
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  return (
    <>
      <div className="input-wrap">
        <input
          id={id}
          className="input"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
          onBlur={() => setCaps(false)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          inputMode={inputMode}
          required={required}
          minLength={minLength}
          spellCheck={false}
          autoCapitalize="off"
        />
        <button type="button" className="reveal" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          <Icon name={show ? 'eyeoff' : 'eye'} />
        </button>
      </div>
      {caps && (
        <span className="hint warn">
          <Icon name="alert" /> Caps Lock is on
        </span>
      )}
    </>
  )
}
