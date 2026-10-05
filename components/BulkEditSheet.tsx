'use client'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import { CATEGORIES, friendlyError } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useFeedback } from './Feedback'
import Icon from './Icon'
import type { WardrobeItem } from '@/lib/types'

const parseTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].map((t) => t.slice(0, 24))

/** Change type, colour and tags of several wardrobe pieces at once. Empty fields are left as they are. */
export default function BulkEditSheet({
  open,
  onClose,
  items,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  items: WardrobeItem[]
  onSaved: () => void
}) {
  const { toast } = useFeedback()
  const [category, setCategory] = useState('')
  const [colour, setColour] = useState('')
  const [addTags, setAddTags] = useState('')
  const [removeTags, setRemoveTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setCategory('')
    setColour('')
    setAddTags('')
    setRemoveTags([])
    setError('')
    setSaving(false)
  }, [open])

  const existingTags = [...new Set(items.flatMap((i) => i.tags))].sort()
  const toAdd = parseTags(addTags)
  const nothing = !category && !colour.trim() && !toAdd.length && !removeTags.length

  async function save() {
    if (nothing || !items.length) return
    setSaving(true)
    setError('')
    const sb = supabase()
    const ids = items.map((i) => i.id)
    try {
      const common: { category?: string; color?: string } = {}
      if (category) common.category = category
      if (colour.trim()) common.color = colour.trim().slice(0, 30)
      if (toAdd.length || removeTags.length) {
        // tags differ per piece, so each one is updated on its own (a few at a time)
        const queue = [...items]
        const worker = async () => {
          for (let it = queue.shift(); it; it = queue.shift()) {
            const tags = [...new Set([...it.tags.filter((t) => !removeTags.includes(t)), ...toAdd])].slice(0, 12)
            const { error } = await sb.from('wardrobe_items').update({ ...common, tags }).eq('id', it.id)
            if (error) throw error
          }
        }
        await Promise.all(Array.from({ length: Math.min(6, items.length) }, worker))
      } else {
        const { error } = await sb.from('wardrobe_items').update(common).in('id', ids)
        if (error) throw error
      }
      toast(`${items.length} piece${items.length > 1 ? 's' : ''} updated`)
      onSaved()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
      onSaved() // some may have been saved already: show the latest
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Edit ${items.length} piece${items.length === 1 ? '' : 's'}`}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving || nothing}>
            {saving ? <><span className="spinner" aria-hidden /> Saving</> : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted small">Only what you fill in is changed. Everything else stays as it is.</p>
        <div className="grid-2">
          <label className="field">
            <span>Type</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Keep as is</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Colour</span>
            <input className="input" value={colour} maxLength={30} onChange={(e) => setColour(e.target.value)} placeholder="Keep as is" />
          </label>
        </div>
        <label className="field">
          <span>Add tags</span>
          <input className="input" value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="goa, beach, summer" />
          <small>Separate with commas.</small>
        </label>
        {!!existingTags.length && (
          <div className="field">
            <span>Remove tags</span>
            <div className="chips">
              {existingTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={removeTags.includes(t)}
                  onClick={() => setRemoveTags((r) => (r.includes(t) ? r.filter((x) => x !== t) : [...r, t]))}
                >
                  {removeTags.includes(t) && <Icon name="x" />} {t}
                </button>
              ))}
            </div>
            <small>Tap the tags to take off these pieces.</small>
          </div>
        )}
        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
      </div>
    </Sheet>
  )
}
