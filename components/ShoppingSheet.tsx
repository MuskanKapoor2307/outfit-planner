'use client'
import { useEffect, useState } from 'react'
import Sheet from './Sheet'
import Icon from './Icon'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, friendlyError, safeLink } from '@/lib/constants'
import type { ShoppingItem } from '@/lib/types'

export default function ShoppingSheet({
  open,
  onClose,
  tripId,
  item,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  tripId: string
  item?: ShoppingItem | null
  onSaved: () => void
}) {
  const { toast } = useFeedback()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setUrl(item?.url ?? '')
    setPrice(item?.price != null ? String(item.price) : '')
    setCategory(item?.category ?? '')
    setNotes(item?.notes ?? '')
    setError('')
  }, [open, item])

  async function save() {
    if (!name.trim()) return setError('What do you need to buy?')
    const link = url.trim() ? safeLink(url) : null
    if (url.trim() && !link) return setError('That link doesn’t look right. Paste the full product address.')
    const p = price.trim() ? Number(price.replace(/[₹,\s]/g, '')) : null
    if (p !== null && (!Number.isFinite(p) || p < 0)) return setError('Enter the price as a number, e.g. 1299.')
    setSaving(true)
    setError('')
    const row = { name: name.trim(), url: link, price: p, category: category || null, notes: notes.trim() || null }
    const sb = supabase()
    const { error } = item
      ? await sb.from('shopping_items').update(row).eq('id', item.id)
      : await sb.from('shopping_items').insert({ ...row, trip_id: tripId })
    setSaving(false)
    if (error) return setError(friendlyError(error))
    toast(item ? 'Saved' : `${row.name} added to the shopping list`)
    onSaved()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="small"
      title={item ? 'Edit item' : 'Add to shopping list'}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? <><span className="spinner" aria-hidden /> Saving</> : 'Save'}</button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save() }}>
        <label className="field">
          <span>Item</span>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Tan braided sandals" autoFocus />
        </label>
        <label className="field">
          <span>Product link (optional)</span>
          <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.myntra.com/…" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Price in ₹ (optional)</span>
            <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1299" />
          </label>
          <label className="field">
            <span>Type</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Notes (optional)</span>
          <input className="input" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Size 6, for the sunset cruise look" />
        </label>
        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
