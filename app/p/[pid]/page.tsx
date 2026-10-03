'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import { daysUntil, prettyDate, toISODate, datesBetween } from '@/lib/constants'
import TripSheet from '@/components/TripSheet'
import Icon from '@/components/Icon'
import Menu from '@/components/Menu'
import { useFeedback } from '@/components/Feedback'
import { friendlyError } from '@/lib/constants'
import type { Trip } from '@/lib/types'

interface Stats { sections: number; picked: number; looks: number }

export default function TripsPage() {
  const { profile } = useProfile()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[] | null>(null)
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [creating, setCreating] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const { confirm, toast } = useFeedback()

  const load = useCallback(async () => {
    const sb = supabase()
    const { data } = await sb.from('trips').select('*').eq('profile_id', profile.id).order('start_date', { ascending: false })
    const list = (data || []) as Trip[]
    setTrips(list)
    if (list.length) {
      const ids = list.map((t) => t.id)
      const [{ data: secs }, { data: outs }] = await Promise.all([
        sb.from('sections').select('id, trip_id').in('trip_id', ids),
        sb.from('outfits').select('trip_id, section_id, is_pick').in('trip_id', ids),
      ])
      const st: Record<string, Stats> = {}
      for (const t of ids) st[t] = { sections: 0, picked: 0, looks: 0 }
      for (const s of secs || []) st[s.trip_id].sections++
      const pickedSections = new Set<string>()
      for (const o of outs || []) {
        st[o.trip_id].looks++
        if (o.is_pick && !pickedSections.has(o.section_id)) {
          pickedSections.add(o.section_id)
          st[o.trip_id].picked++
        }
      }
      setStats(st)
    }
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  async function deleteTrip(t: Trip) {
    const ok = await confirm({
      title: `Delete ${t.name}?`,
      message: 'All sections, looks and the shopping list for this trip are deleted. Your wardrobe stays as it is.',
      confirmText: 'Delete trip',
      danger: true,
      typeToConfirm: t.name,
    })
    if (!ok) return
    const { error } = await supabase().from('trips').delete().eq('id', t.id)
    if (error) return toast(friendlyError(error), 'error')
    toast('Trip deleted')
    load()
  }

  const today = toISODate(new Date())
  const stamp = (t: Trip) => {
    if (t.end_date < today) return { text: 'Done', now: false }
    if (t.start_date <= today) return { text: 'Happening now', now: true }
    const n = daysUntil(t.start_date)
    return { text: n === 1 ? 'Tomorrow' : `In ${n} days`, now: false }
  }

  return (
    <>
      <div className="spread page-title">
        <h1>Trips</h1>
        <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> New trip</button>
      </div>

      {trips === null && <div className="trip-list">{[0, 1].map((i) => <div key={i} className="skel" style={{ minHeight: 190 }} />)}</div>}

      {trips?.length === 0 && (
        <div className="empty-state card">
          <span className="art" aria-hidden>🧳</span>
          <h2>Plan your first trip</h2>
          <p className="muted">Make a folder like “Goa”, split each day into mornings, events or places, and plan as many looks as you like.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>New trip</button>
        </div>
      )}

      {!!trips?.length && (
        <div className="trip-list stagger">
          {trips.map((t, i) => {
            const days = datesBetween(t.start_date, t.end_date).length
            const s = stats[t.id] || { sections: 0, picked: 0, looks: 0 }
            const st = stamp(t)
            return (
              <div key={t.id} className="trip-wrap" style={{ ['--i' as string]: i }}>
              <Link href={`/p/${profile.id}/trip/${t.id}`} className="trip-card">
                <span className="big" aria-hidden>{t.name.slice(0, 1)}</span>
                <span className={`stamp ${st.now ? 'now' : ''}`}>{st.text}</span>
                <h3>{t.name}</h3>
                <p className="muted small">
                  {t.destination ? `${t.destination}, ` : ''}
                  {prettyDate(t.start_date, { day: 'numeric', month: 'short' })} to {prettyDate(t.end_date, { day: 'numeric', month: 'short' })}, {days} day{days > 1 ? 's' : ''}
                </p>
                <p className="small">
                  {s.looks} look{s.looks === 1 ? '' : 's'} planned, {s.picked} of {s.sections} sections decided
                </p>
                <span className="meter" aria-hidden><i style={{ width: `${s.sections ? (s.picked / s.sections) * 100 : 0}%` }} /></span>
              </Link>
              <div className="card-menu">
                <Menu
                  label={`Options for ${t.name}`}
                  items={[
                    { label: 'Edit trip', icon: 'edit', onClick: () => setEditingTrip(t) },
                    { label: 'Delete trip', icon: 'trash', onClick: () => deleteTrip(t), danger: true },
                  ]}
                />
              </div>
              </div>
            )
          })}
        </div>
      )}

      <TripSheet open={!!editingTrip} onClose={() => setEditingTrip(null)} profileId={profile.id} trip={editingTrip} onSaved={() => load()} onDeleted={() => load()} />
      <TripSheet open={creating} onClose={() => setCreating(false)} profileId={profile.id} onSaved={(id) => router.push(`/p/${profile.id}/trip/${id}`)} />
    </>
  )
}
