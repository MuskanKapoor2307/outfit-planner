'use client'
import { useEffect, useMemo, useState } from 'react'
import Sheet from './Sheet'
import LookBoard from './LookBoard'
import ItemGrid from './ItemGrid'
import Icon, { AiBadge } from './Icon'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, OUTFIT_AESTHETICS, datesBetween, friendlyError, prettyDate } from '@/lib/constants'
import type { Outfit, Section, Trip, WardrobeItem } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  trip: Trip
  sections: Section[]
  outfit?: Outfit | null
  defaultSectionId: string
  items: WardrobeItem[]
  urls: Record<string, string>
  onSaved: () => void
}

export default function OutfitSheet({ open, onClose, trip, sections, outfit, defaultSectionId, items, urls, onSaved }: Props) {
  const { confirm, toast } = useFeedback()
  const [title, setTitle] = useState('')
  const [sectionId, setSectionId] = useState(defaultSectionId)
  const [isPick, setIsPick] = useState(false)
  const [aesthetic, setAesthetic] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [footwear, setFootwear] = useState('')
  const [accessories, setAccessories] = useState('')
  const [hairstyle, setHairstyle] = useState('')
  const [notes, setNotes] = useState('')
  const [choosing, setChoosing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(outfit?.title ?? '')
    setSectionId(outfit?.section_id ?? defaultSectionId)
    setIsPick(outfit?.is_pick ?? false)
    setAesthetic(outfit?.aesthetic ?? '')
    setPicked(outfit ? [...outfit.outfit_items].sort((a, b) => a.position - b.position).map((x) => x.item_id) : [])
    setFootwear(outfit?.footwear ?? '')
    setAccessories(outfit?.accessories ?? '')
    setHairstyle(outfit?.hairstyle ?? '')
    setNotes(outfit?.notes ?? '')
    setChoosing(!outfit)
    setFilter('all')
    setError('')
  }, [open, outfit, defaultSectionId])

  const tripDays = datesBetween(trip.start_date, trip.end_date)
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const boardUrls = picked.map((id) => byId.get(id)).filter(Boolean).map((i) => urls[i!.image_path]).filter(Boolean)
  const usedCats = new Set(items.map((i) => i.category))
  const visible = filter === 'all' ? items : items.filter((i) => i.category === filter)
  const isCustomAesthetic = aesthetic && !OUTFIT_AESTHETICS.includes(aesthetic)
  const sectionLabel = (s: Section) => {
    const n = tripDays.indexOf(s.day)
    return `${n >= 0 ? `Day ${n + 1}` : prettyDate(s.day)}: ${s.name}`
  }

  function toggle(it: WardrobeItem) {
    setPicked((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : p.length >= 12 ? p : [...p, it.id]))
  }

  const fields = () => ({
    section_id: sectionId,
    is_pick: isPick,
    title: title.trim(),
    aesthetic: aesthetic.trim() || null,
    footwear: footwear.trim() || null,
    accessories: accessories.trim() || null,
    hairstyle: hairstyle.trim() || null,
    notes: notes.trim() || null,
  })

  async function writeItems(outfitId: string) {
    const sb = supabase()
    const { error: delErr } = await sb.from('outfit_items').delete().eq('outfit_id', outfitId)
    if (delErr) throw delErr
    if (picked.length) {
      const { error } = await sb.from('outfit_items').insert(picked.map((item_id, position) => ({ outfit_id: outfitId, item_id, position })))
      if (error) throw error
    }
  }

  async function save(asCopy = false) {
    if (!title.trim()) return setError('Give the look a name, e.g. “Sunset shack dinner”.')
    if (!sectionId) return setError('Choose where this look goes.')
    setSaving(true)
    setError('')
    const sb = supabase()
    try {
      if (isPick) {
        // only one final pick per section
        await sb.from('outfits').update({ is_pick: false }).eq('section_id', sectionId).neq('id', outfit && !asCopy ? outfit.id : '00000000-0000-0000-0000-000000000000')
      }
      if (outfit && !asCopy) {
        const { error } = await sb.from('outfits').update(fields()).eq('id', outfit.id)
        if (error) throw error
        await writeItems(outfit.id)
        toast('Look saved')
      } else {
        const row = { ...fields(), trip_id: trip.id, ai_generated: asCopy ? !!outfit?.ai_generated : false, title: asCopy ? `${title.trim()} (copy)`.slice(0, 60) : title.trim(), is_pick: asCopy ? false : isPick }
        const { data, error } = await sb.from('outfits').insert(row).select('id').single()
        if (error) throw error
        await writeItems(data.id)
        toast(asCopy ? 'Copy added as another option' : 'Look saved')
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!outfit) return
    const ok = await confirm({ title: `Delete “${outfit.title}”?`, message: 'Your wardrobe pieces are not deleted.', confirmText: 'Delete look', danger: true })
    if (!ok) return
    setSaving(true)
    const { error } = await supabase().from('outfits').delete().eq('id', outfit.id)
    setSaving(false)
    if (error) return setError(friendlyError(error))
    toast('Look deleted')
    onSaved()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<>{outfit ? 'Edit look' : 'Plan a look'}{outfit?.ai_generated && <AiBadge text="AI idea" />}</>}
      footer={
        <>
          {outfit && (
            <>
              <button className="btn danger" onClick={remove} disabled={saving}><Icon name="trash" /> Delete</button>
              <button className="btn" onClick={() => save(true)} disabled={saving} style={{ marginRight: 'auto' }}><Icon name="copy" /> Duplicate</button>
            </>
          )}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => save()} disabled={saving}>{saving ? <><span className="spinner" aria-hidden /> Saving</> : 'Save look'}</button>
        </>
      }
    >
      <div className="stack" style={{ ['--gap' as string]: '1.1rem' }}>
        <div className="look" style={{ maxWidth: 200, cursor: 'default' }}>
          <LookBoard urls={boardUrls} emptyText="Pick pieces to see the look here, or just describe it below" />
        </div>

        <label className="field">
          <span>Look name</span>
          <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Sunset shack dinner" />
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Goes in</span>
            <select className="select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
            </select>
          </label>
          <label className="switch" style={{ alignSelf: 'end', minHeight: 48 }}>
            <span className="label"><strong>Final pick</strong><span className="hint">The one you’ll actually wear</span></span>
            <input type="checkbox" checked={isPick} onChange={(e) => setIsPick(e.target.checked)} />
          </label>
        </div>

        <div className="field">
          <div className="spread">
            <span className="field-label">Pieces from your wardrobe ({picked.length})</span>
            {items.length > 0 && <button type="button" className="btn small" onClick={() => setChoosing((c) => !c)}>{choosing ? 'Done' : 'Choose pieces'}</button>}
          </div>
          {items.length === 0 && <small>Your wardrobe is empty. Add pieces in the Wardrobe tab, or describe the look below.</small>}
          {choosing && items.length > 0 && (
            <div className="stack" style={{ ['--gap' as string]: '0.7rem' }}>
              <div className="chips scroll">
                <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
                {CATEGORIES.filter((c) => usedCats.has(c.id)).map((c) => (
                  <button key={c.id} type="button" className="chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>{c.label}</button>
                ))}
              </div>
              <ItemGrid items={visible} urls={urls} onPick={toggle} selected={picked} />
            </div>
          )}
        </div>

        <div className="field">
          <span>Aesthetic</span>
          <div className="chips">
            {OUTFIT_AESTHETICS.map((a) => (
              <button key={a} type="button" className="chip" aria-pressed={aesthetic === a} onClick={() => setAesthetic(aesthetic === a ? '' : a)}>{a}</button>
            ))}
          </div>
          <input className="input" value={isCustomAesthetic ? aesthetic : ''} maxLength={40} onChange={(e) => setAesthetic(e.target.value)} placeholder="Or type your own, e.g. coastal cowgirl" />
        </div>

        <label className="field">
          <span>Footwear</span>
          <input className="input" value={footwear} maxLength={200} onChange={(e) => setFootwear(e.target.value)} placeholder="Tan braided flats" />
        </label>
        <label className="field">
          <span>Accessories, jewellery and bag</span>
          <input className="input" value={accessories} maxLength={300} onChange={(e) => setAccessories(e.target.value)} placeholder="Gold hoops, straw tote, oval sunglasses" />
        </label>
        <label className="field">
          <span>Hair, makeup or grooming</span>
          <input className="input" value={hairstyle} maxLength={200} onChange={(e) => setHairstyle(e.target.value)} placeholder="Low claw-clip bun, glossy lips" />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea className="textarea" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Carry a light shrug for the boat ride" />
        </label>

        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
      </div>
    </Sheet>
  )
}
