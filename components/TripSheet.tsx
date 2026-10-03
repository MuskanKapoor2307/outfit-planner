'use client'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import Icon from './Icon'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { DEFAULT_DAY_SECTIONS, datesBetween, friendlyError, toISODate } from '@/lib/constants'
import type { Trip } from '@/lib/types'

export default function TripSheet({
  open,
  onClose,
  profileId,
  trip,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  profileId: string
  trip?: Trip | null
  onSaved: (id: string) => void
  onDeleted?: () => void
}) {
  const { confirm, toast } = useFeedback()
  const today = toISODate(new Date())
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [notes, setNotes] = useState('')
  const [starter, setStarter] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(trip?.name ?? '')
    setDestination(trip?.destination ?? '')
    setStart(trip?.start_date ?? today)
    setEnd(trip?.end_date ?? today)
    setNotes(trip?.notes ?? '')
    setStarter(true)
    setError('')
  }, [open, trip, today])

  async function save() {
    if (!name.trim()) return setError('Give the trip a name, e.g. “Goa”.')
    if (end < start) return setError('The last day can’t be before the first day.')
    setSaving(true)
    setError('')
    const sb = supabase()
    const row = { name: name.trim(), destination: destination.trim() || null, start_date: start, end_date: end, notes: notes.trim() || null }
    try {
      if (trip) {
        const { count } = await sb
          .from('sections')
          .select('id', { count: 'exact', head: true })
          .eq('trip_id', trip.id)
          .or(`day.lt.${start},day.gt.${end}`)
        if (count) {
          const ok = await confirm({
            title: 'Some plans fall outside the new dates',
            message: `${count} section${count > 1 ? 's are' : ' is'} on days outside the new dates. They’ll be kept under “Outside trip dates” so nothing is lost.`,
            confirmText: 'Change dates',
          })
          if (!ok) return setSaving(false)
        }
        const { error } = await sb.from('trips').update(row).eq('id', trip.id)
        if (error) throw error
        toast('Trip updated')
        onSaved(trip.id)
      } else {
        const { data, error } = await sb.from('trips').insert({ ...row, profile_id: profileId }).select('id').single()
        if (error) throw error
        if (starter) {
          const rows = datesBetween(start, end).flatMap((day) =>
            DEFAULT_DAY_SECTIONS.map((n, position) => ({ trip_id: data.id, day, name: n, kind: 'time', position })),
          )
          await sb.from('sections').insert(rows)
        }
        toast(`${row.name} created`)
        onSaved(data.id)
      }
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!trip) return
    const ok = await confirm({
      title: `Delete ${trip.name}?`,
      message: 'All sections and looks in this trip are deleted. Your wardrobe stays as it is.',
      confirmText: 'Delete trip',
      danger: true,
      typeToConfirm: trip.name,
    })
    if (!ok) return
    setSaving(true)
    const { error } = await supabase().from('trips').delete().eq('id', trip.id)
    setSaving(false)
    if (error) return setError(friendlyError(error))
    toast('Trip deleted')
    onClose()
    onDeleted?.()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={trip ? 'Edit trip' : 'New trip'}
      footer={
        <>
          {trip && <button className="btn danger" onClick={remove} disabled={saving} style={{ marginRight: 'auto' }}><Icon name="trash" /> Delete</button>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? <><span className="spinner" aria-hidden /> Saving</> : trip ? 'Save changes' : 'Create trip'}
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>Trip name</span>
          <input className="input" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="Goa" autoFocus={!trip} />
        </label>
        <label className="field">
          <span>Where</span>
          <input className="input" value={destination} maxLength={60} onChange={(e) => setDestination(e.target.value)} placeholder="North Goa" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>First day</span>
            <input className="input" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} />
          </label>
          <label className="field">
            <span>Last day</span>
            <input className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {!trip && (
          <label className="switch">
            <span className="label">
              <strong>Start each day with Morning, Afternoon, Evening and Night</strong>
              <span className="hint">You can rename these, delete them, or add events and places later.</span>
            </span>
            <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
          </label>
        )}
        <label className="field">
          <span>Notes</span>
          <textarea className="textarea" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Beach shack dinner on day 2, sunset cruise on day 3…" />
        </label>
        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
      </div>
    </Sheet>
  )
}
