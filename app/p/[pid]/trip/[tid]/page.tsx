'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useProfile } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import { useSignedUrls } from '@/lib/signedUrls'
import { DEFAULT_DAY_SECTIONS, SECTION_KINDS, datesBetween, friendlyError, prettyDate, toISODate } from '@/lib/constants'
import { useAiSettings } from '@/lib/ai/useAi'
import Icon from '@/components/Icon'
import Menu from '@/components/Menu'
import LookCard from '@/components/LookCard'
import OutfitSheet from '@/components/OutfitSheet'
import TripSheet from '@/components/TripSheet'
import SectionSheet from '@/components/SectionSheet'
import AiStylistSheet from '@/components/AiStylistSheet'
import ShoppingList from '@/components/ShoppingList'
import TryOnSheet from '@/components/TryOnSheet'
import { useFeedback } from '@/components/Feedback'
import type { Outfit, Section, Trip, WardrobeItem } from '@/lib/types'

export default function TripPage() {
  const { profile, reload: reloadProfile } = useProfile()
  const { tid } = useParams<{ tid: string }>()
  const router = useRouter()
  const ai = useAiSettings()
  const { confirm, toast } = useFeedback()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [missing, setMissing] = useState(false)
  const [sections, setSections] = useState<Section[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [day, setDay] = useState('')
  const [editing, setEditing] = useState<{ outfit: Outfit | null; sectionId: string } | null>(null)
  const [styling, setStyling] = useState<Section | null>(null)
  const [sectionSheet, setSectionSheet] = useState<{ section: Section | null } | null>(null)
  const [editTrip, setEditTrip] = useState(false)
  const [view, setView] = useState<'plan' | 'shop'>('plan')
  const [tryOn, setTryOn] = useState<Outfit | null>(null)
  const [shopCount, setShopCount] = useState(0)

  const loadItems = useCallback(async () => {
    const { data } = await supabase().from('wardrobe_items').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false })
    setItems((data || []) as WardrobeItem[])
  }, [profile.id])

  const load = useCallback(async () => {
    const sb = supabase()
    const [t, s, o] = await Promise.all([
      sb.from('trips').select('*').eq('id', tid).maybeSingle(),
      sb.from('sections').select('*').eq('trip_id', tid).order('day').order('position').order('created_at'),
      sb.from('outfits').select('*, outfit_items(item_id, position)').eq('trip_id', tid).order('created_at'),
    ])
    if (!t.data) return setMissing(true)
    setTrip(t.data as Trip)
    setSections((s.data || []) as Section[])
    setOutfits((o.data || []) as Outfit[])
  }, [tid])

  useEffect(() => {
    load()
    loadItems()
  }, [load, loadItems])

  const days = useMemo(() => (trip ? datesBetween(trip.start_date, trip.end_date) : []), [trip])
  useEffect(() => {
    if (!days.length || days.includes(day)) return
    const today = toISODate(new Date())
    setDay(days.includes(today) ? today : days[0])
  }, [days, day])

  const urls = useSignedUrls(items.map((i) => i.image_path))
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const daySections = sections.filter((s) => s.day === day).sort((a, b) => a.position - b.position)
  const outside = sections.filter((s) => !days.includes(s.day))
  const looksIn = (sid: string) => outfits.filter((o) => o.section_id === sid)
  const nextPosition = (d: string) => Math.max(-1, ...sections.filter((s) => s.day === d).map((s) => s.position)) + 1
  const dayLabel = (d: string) => `Day ${days.indexOf(d) + 1}, ${prettyDate(d)}`

  if (missing)
    return (
      <div className="empty-state">
        <h2>Trip not found</h2>
        <Link className="btn primary" href={`/p/${profile.id}`}>Back to trips</Link>
      </div>
    )
  if (!trip || !day)
    return (
      <div className="stack">
        <div className="skel" style={{ height: 60, width: '50%' }} />
        <div className="skel" style={{ height: 70 }} />
        <div className="skel" style={{ height: 240 }} />
      </div>
    )

  const lookUrls = (o: Outfit) =>
    [...o.outfit_items]
      .sort((a, b) => a.position - b.position)
      .map((x) => itemById.get(x.item_id))
      .filter(Boolean)
      .map((i) => urls[i!.image_path])
      .filter(Boolean)

  async function togglePick(o: Outfit) {
    const next = !o.is_pick
    setOutfits((all) => all.map((x) => (x.section_id === o.section_id ? { ...x, is_pick: x.id === o.id ? next : next ? false : x.is_pick } : x)))
    const sb = supabase()
    if (next) await sb.from('outfits').update({ is_pick: false }).eq('section_id', o.section_id).neq('id', o.id)
    const { error } = await sb.from('outfits').update({ is_pick: next }).eq('id', o.id)
    if (error) {
      toast(friendlyError(error), 'error')
      load()
    } else if (next) toast(`“${o.title}” is the final pick`)
  }

  async function deleteOutfit(o: Outfit) {
    const ok = await confirm({ title: `Delete “${o.title}”?`, message: 'Your wardrobe pieces are not deleted.', confirmText: 'Delete look', danger: true })
    if (!ok) return
    setOutfits((all) => all.filter((x) => x.id !== o.id))
    const { error } = await supabase().from('outfits').delete().eq('id', o.id)
    if (error) {
      toast(friendlyError(error), 'error')
      return load()
    }
    toast('Look deleted')
  }

  async function deleteTrip() {
    const ok = await confirm({
      title: `Delete ${trip!.name}?`,
      message: 'All sections, looks and the shopping list for this trip are deleted. Your wardrobe stays as it is.',
      confirmText: 'Delete trip',
      danger: true,
      typeToConfirm: trip!.name,
    })
    if (!ok) return
    const { error } = await supabase().from('trips').delete().eq('id', trip!.id)
    if (error) return toast(friendlyError(error), 'error')
    toast('Trip deleted')
    router.replace(`/p/${profile.id}`)
  }

  async function move(s: Section, dir: -1 | 1) {
    const list = [...daySections]
    const i = list.findIndex((x) => x.id === s.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    const updated = list.map((x, position) => ({ ...x, position }))
    setSections((all) => all.map((x) => updated.find((u) => u.id === x.id) ?? x))
    const sb = supabase()
    await Promise.all(updated.map((u) => sb.from('sections').update({ position: u.position }).eq('id', u.id)))
  }

  async function removeSection(s: Section) {
    const n = looksIn(s.id).length
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      message: n ? `Its ${n} look${n > 1 ? 's are' : ' is'} deleted too. Wardrobe pieces stay.` : 'This section is empty.',
      confirmText: 'Delete section',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase().from('sections').delete().eq('id', s.id)
    if (error) return toast(friendlyError(error), 'error')
    toast(`${s.name} deleted`)
    load()
  }

  async function addDefaults() {
    const start = nextPosition(day)
    const { error } = await supabase().from('sections').insert(DEFAULT_DAY_SECTIONS.map((name, i) => ({ trip_id: trip!.id, day, name, kind: 'time', position: start + i })))
    if (error) return toast(friendlyError(error), 'error')
    load()
  }

  async function copyDayToAll() {
    if (!daySections.length) return
    const ok = await confirm({
      title: 'Copy these sections to every day?',
      message: `Adds ${daySections.map((s) => s.name).join(', ')} to the other days, skipping any day that already has a section with the same name. Looks are not copied.`,
      confirmText: 'Copy sections',
    })
    if (!ok) return
    const rows = days
      .filter((d) => d !== day)
      .flatMap((d) => {
        const existing = new Set(sections.filter((s) => s.day === d).map((s) => s.name.toLowerCase()))
        let pos = nextPosition(d)
        return daySections.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => ({ trip_id: trip!.id, day: d, name: s.name, kind: s.kind, position: pos++ }))
      })
    if (!rows.length) return toast('Every day already has these sections')
    const { error } = await supabase().from('sections').insert(rows)
    if (error) return toast(friendlyError(error), 'error')
    toast('Sections copied to the other days')
    load()
  }

  const kindIcon = (k: Section['kind']) => SECTION_KINDS.find((x) => x.id === k)?.icon ?? 'sun'
  const aiOn = ai?.enabled !== false

  const renderSection = (s: Section, idx: number, list: Section[]) => {
    const looks = looksIn(s.id)
    const pick = looks.find((l) => l.is_pick)
    return (
      <section key={s.id} className="section" aria-labelledby={`sec-${s.id}`} style={{ ['--i' as string]: idx }}>
        <div className="section-head">
          <span className="kind" aria-hidden><Icon name={kindIcon(s.kind)} /></span>
          <div className="title">
            <h3 id={`sec-${s.id}`}>{s.name}</h3>
            <span className="sub">
              {looks.length === 0 ? 'Nothing planned yet' : pick ? `Final pick: ${pick.title}` : `${looks.length} option${looks.length > 1 ? 's' : ''}, no final pick yet`}
            </span>
          </div>
          <Menu
            label={`Options for ${s.name}`}
            items={[
              { label: 'Rename', icon: 'edit', onClick: () => setSectionSheet({ section: s }) },
              { label: 'Move up', icon: 'up', onClick: () => move(s, -1), disabled: idx === 0 },
              { label: 'Move down', icon: 'down', onClick: () => move(s, 1), disabled: idx === list.length - 1 },
              { label: 'Delete section', icon: 'trash', onClick: () => removeSection(s), danger: true },
            ]}
          />
        </div>
        <div className="looks stagger">
          {looks.map((o, i) => (
            <LookCard key={o.id} outfit={o} index={i} urls={lookUrls(o)} onOpen={() => setEditing({ outfit: o, sectionId: s.id })} onTogglePick={() => togglePick(o)} onDelete={() => deleteOutfit(o)} onTryOn={() => setTryOn(o)} />
          ))}
          <div className="add-tiles" style={{ ['--i' as string]: looks.length }}>
            <button className="add-tile" onClick={() => setEditing({ outfit: null, sectionId: s.id })}>
              <Icon name="plus" />
              {looks.length ? 'Add another option' : 'Plan a look'}
            </button>
            {aiOn && (
              <button className="add-tile ai" onClick={() => setStyling(s)}>
                <Icon name="sparkle" />
                Style with AI
              </button>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="page-title">
        <Link href={`/p/${profile.id}`} className="back"><Icon name="left" /> All trips</Link>
        <div className="spread">
          <h1>{trip.name}</h1>
          <Menu
            label="Trip options"
            items={[
              { label: 'Edit trip', icon: 'edit', onClick: () => setEditTrip(true) },
              { label: 'Delete trip', icon: 'trash', onClick: deleteTrip, danger: true },
            ]}
          />
        </div>
        <p className="muted">
          {trip.destination ? `${trip.destination}, ` : ''}
          {prettyDate(trip.start_date, { day: 'numeric', month: 'short' })} to {prettyDate(trip.end_date, { day: 'numeric', month: 'short' })}
        </p>
        {trip.notes && <p className="small">{trip.notes}</p>}
      </div>

      <div className="view-tabs" role="group" aria-label="Trip view">
        <button aria-pressed={view === 'plan'} onClick={() => setView('plan')}><Icon name="suitcase" /> Outfits</button>
        <button aria-pressed={view === 'shop'} onClick={() => setView('shop')}>
          <Icon name="bag" /> Shopping list {shopCount > 0 && <span className="count">{shopCount}</span>}
        </button>
      </div>

      <div hidden={view !== 'plan'}>
      <div className="day-strip" role="group" aria-label="Choose a day">
        {days.map((d, i) => {
          const n = outfits.filter((o) => sections.find((s) => s.id === o.section_id)?.day === d).length
          return (
            <button key={d} className="day-pill" aria-pressed={d === day} onClick={() => setDay(d)} aria-label={`${dayLabel(d)}, ${n} looks`}>
              <span className="dow">Day {i + 1}</span>
              <span className="num">{prettyDate(d, { day: 'numeric' })}</span>
              <span className="dow">{prettyDate(d, { weekday: 'short' })}</span>
              <span className="dots" aria-hidden>{Array.from({ length: Math.min(n, 4) }).map((_, k) => <i key={k} />)}</span>
            </button>
          )
        })}
      </div>

      <div className="day-head">
        <h2>{prettyDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <div className="row">
          <button className="btn small" onClick={() => setSectionSheet({ section: null })}><Icon name="plus" /> Add section</button>
          <Menu
            label="Day options"
            items={[{ label: 'Copy sections to all days', icon: 'copy', onClick: copyDayToAll, disabled: !daySections.length }]}
          />
        </div>
      </div>

      <div key={day} className="stagger">
        {daySections.length === 0 ? (
          <div className="empty-state card">
            <span className="art" aria-hidden>🗓️</span>
            <h3>Nothing planned for this day yet</h3>
            <p className="muted">Split the day by time, event or place, then add one or more looks to each.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={addDefaults}>Add Morning to Night</button>
              <button className="btn" onClick={() => setSectionSheet({ section: null })}>Add an event or place</button>
            </div>
          </div>
        ) : (
          daySections.map((s, i, list) => renderSection(s, i, list))
        )}
      </div>

      {outside.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Outside trip dates</h2>
          <p className="muted small">These are on days no longer in the trip. Open a look to move it to another section, or delete the section.</p>
          {outside.map((s, i, list) => renderSection(s, i, list))}
        </div>
      )}
      </div>

      <div hidden={view !== 'shop'}>
        <ShoppingList tripId={trip.id} profileId={profile.id} onCountChange={setShopCount} onWardrobeChanged={loadItems} />
      </div>

      <OutfitSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        trip={trip}
        sections={sections}
        outfit={editing?.outfit}
        defaultSectionId={editing?.sectionId ?? ''}
        items={items}
        urls={urls}
        onSaved={load}
      />
      <AiStylistSheet
        open={!!styling}
        onClose={() => setStyling(null)}
        profile={profile}
        trip={trip}
        section={styling}
        dayLabel={styling ? (days.includes(styling.day) ? dayLabel(styling.day) : prettyDate(styling.day)) : ''}
        items={items}
        urls={urls}
        onItemsChanged={loadItems}
        onSaved={load}
      />
      <TryOnSheet
        open={!!tryOn}
        onClose={() => setTryOn(null)}
        profile={profile}
        outfit={tryOn ? outfits.find((x) => x.id === tryOn.id) ?? tryOn : null}
        items={items}
        urls={urls}
        onSaved={load}
        onProfileChanged={reloadProfile}
      />
      <SectionSheet
        open={!!sectionSheet}
        onClose={() => setSectionSheet(null)}
        tripId={trip.id}
        day={day}
        tripDays={days}
        section={sectionSheet?.section}
        nextPosition={nextPosition}
        onSaved={load}
      />
      <TripSheet
        open={editTrip}
        onClose={() => setEditTrip(false)}
        profileId={profile.id}
        trip={trip}
        onSaved={() => load()}
        onDeleted={() => router.replace(`/p/${profile.id}`)}
      />
    </>
  )
}
