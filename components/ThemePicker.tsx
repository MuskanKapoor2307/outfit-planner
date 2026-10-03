'use client'
import { THEMES, THEME_GROUPS } from '@/lib/themes'
import type { ThemeId } from '@/lib/types'
import Icon from './Icon'

/** Each tile is drawn in its own theme, so you see exactly what you'll get. */
export default function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }) {
  return (
    <div className="theme-groups" role="radiogroup" aria-label="App theme">
      {THEME_GROUPS.map((g) => (
        <div key={g.id} className="theme-group">
          <h4>{g.label}</h4>
          <div className="theme-grid">
            {THEMES.filter((t) => t.group === g.id).map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={value === t.id}
                data-theme={t.id}
                className="theme-tile"
                onClick={() => onChange(t.id)}
              >
                {value === t.id && <span className="tick" aria-hidden><Icon name="check" /></span>}
                <span className="mini" aria-hidden><b /><b /><b /></span>
                <span className="txt">
                  <span className="name">{t.name}</span>
                  <span className="blurb">{t.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
