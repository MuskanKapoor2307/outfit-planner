'use client'
import { useState } from 'react'
import ThemePicker from './ThemePicker'
import { EMOJIS } from '@/lib/constants'
import type { StyleFor, ThemeId } from '@/lib/types'

export interface ProfileDraft {
  name: string
  emoji: string
  theme: ThemeId
  style_for: StyleFor
}

export default function ProfileForm({ initial, onChange }: { initial: ProfileDraft; onChange: (d: ProfileDraft) => void }) {
  const [d, setD] = useState(initial)
  const update = (patch: Partial<ProfileDraft>) => {
    const next = { ...d, ...patch }
    setD(next)
    onChange(next)
  }
  return (
    <div className="stack" style={{ ['--gap' as string]: '1.3rem' }}>
      <label className="field">
        <span>Name</span>
        <input className="input" value={d.name} maxLength={40} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Me, Mom, Arjun" />
      </label>
      <div className="field">
        <span>Icon</span>
        <div className="chips">
          {EMOJIS.map((em) => (
            <button key={em} type="button" className="chip" aria-pressed={d.emoji === em} onClick={() => update({ emoji: em })} aria-label={`Icon ${em}`}>
              {em}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Style suggestions for</span>
        <div className="segmented" role="group" aria-label="Style suggestions for">
          {([['women', 'Women'], ['men', 'Men'], ['any', 'Anyone']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={d.style_for === id} onClick={() => update({ style_for: id })}>{label}</button>
          ))}
        </div>
        <small>Used when you ask AI for ideas, so it suggests the right kind of pieces.</small>
      </div>
      <div className="field">
        <span>Theme</span>
        <ThemePicker value={d.theme} onChange={(theme) => update({ theme })} />
      </div>
    </div>
  )
}
