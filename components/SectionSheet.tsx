'use client'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import Icon from './Icon'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { SECTION_KINDS, friendlyError, prettyDate } from '@/lib/constants'
import type { Section, SectionKind } from '@/lib/types'

/** Add or rename a section like "Morning", "Pool party" or "Baga beach". */
export default function SectionSheet({
  open,
  onClose,
  tripId,
  day,
  tripDays,
  section,
  nextPosition,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  tripId: string
  day: string
  tripDays: string[]
  section?: Section | null
  nextPosition: (day: string) => number
  onSaved: () => void
}) {
  const { toast } = useFeedback()
  const [kind, setKind] = useState<SectionKind>('time')
  const [name, setName] = useState('')
  const [allDays, setAllDays] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind(section?.kind ?? 'time')
    setName(section?.name ?? '')
    setAllDays(false)
    setError('')
  }, [open, section])

  const ideas = SECTION_KINDS.find((k) => k.id === kind)!.ideas

  async function save() {
    if (!name.trim()) return setError('Give the section a name.')
    setSaving(true)
    setError('')
    const sb = supabase()
    try {
      if (section) {
        const { error } = await sb.from('sections').update({ name: name.trim(), kind }).eq('id', section.id)
        if (error) throw error
        toast('Section updated')
      } else {
        const days = allDays ? tripDays : [day]
        const { error } = await sb.from('sections').insert(days.map((d) => ({ trip_id: tripId, day: d, name: name.trim(), kind, position: nextPosition(d) })))
        if (error) throw error
        toast(allDays ? `${name.trim()} added to every day` : `${name.trim()} added`)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="small"
      title={section ? 'Rename section' : 'Add a section'}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? <><span className="spinner" aria-hidden /> Saving</> : section ? 'Save' : 'Add section'}</button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="segmented" role="group" aria-label="Section type">
          {SECTION_KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              <Icon name={k.icon} /> {k.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus placeholder={kind === 'place' ? 'Baga beach' : kind === 'event' ? 'Pool party' : 'Sunset'} />
        </label>
        <div className="chips">
          {ideas.map((i) => (
            <button key={i} type="button" className="chip" aria-pressed={name === i} onClick={() => setName(i)}>{i}</button>
          ))}
        </div>
        {!section && tripDays.length > 1 && (
          <label className="switch">
            <span className="label">
              <strong>Add to every day of the trip</strong>
              <span className="hint">Otherwise it’s only added to {prettyDate(day)}.</span>
            </span>
            <input type="checkbox" checked={allDays} onChange={(e) => setAllDays(e.target.checked)} />
          </label>
        )}
        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
