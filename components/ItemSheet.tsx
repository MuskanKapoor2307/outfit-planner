'use client'
import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { CATEGORIES, friendlyError } from '@/lib/constants'
import { prepareImage, type PreparedImage } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { forgetSignedUrl } from '@/lib/signedUrls'
import { bgRemovalPreference, setBgRemovalPreference } from '@/lib/ai/settings'
import { useFeedback } from './Feedback'
import Icon from './Icon'
import type { WardrobeItem } from '@/lib/types'

interface Props {
  open: boolean
  onClose: () => void
  profileId: string
  /** pass an item to edit it; leave empty to add a new one */
  item?: WardrobeItem | null
  imageUrl?: string
  onSaved: (newItemId?: string) => void
}

const parseTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 24))

export default function ItemSheet({ open, onClose, profileId, item, imageUrl, onSaved }: Props) {
  const { session } = useAuth()
  const { confirm, toast } = useFeedback()
  const [dragOver, setDragOver] = useState(false)
  const editing = !!item
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [removeBg, setRemoveBg] = useState(true)
  const [busy, setBusy] = useState<{ msg: string; frac?: number } | null>(null)
  const [prepared, setPrepared] = useState<PreparedImage | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('dress')
  const [colour, setColour] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // reset when opened
  useEffect(() => {
    if (!open) return
    setFile(null)
    setRemoveBg(bgRemovalPreference())
    setPrepared(null)
    setBusy(null)
    setError('')
    setSaving(false)
    setName(item?.name ?? '')
    setCategory(item?.category ?? 'dress')
    setColour(item?.color ?? '')
    setTags(item?.tags.join(', ') ?? '')
  }, [open, item])

  // process the photo whenever the file or the toggle changes
  useEffect(() => {
    if (!file) return
    let cancelled = false
    setError('')
    setPrepared(null)
    prepareImage(file, removeBg, (msg, frac) => !cancelled && setBusy({ msg, frac }))
      .then((p) => {
        if (cancelled) return URL.revokeObjectURL(p.url)
        setPrepared(p)
        if (p.colour) setColour((c) => c || p.colour!)
      })
      .catch((e) => !cancelled && setError(friendlyError(e)))
      .finally(() => !cancelled && setBusy(null))
    return () => {
      cancelled = true
    }
  }, [file, removeBg])

  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url) }, [prepared])

  async function save() {
    if (!session) return
    if (!name.trim()) return setError('Give this piece a name, e.g. “White linen dress”.')
    setSaving(true)
    setError('')
    const sb = supabase()
    try {
      if (editing && item) {
        const { error } = await sb
          .from('wardrobe_items')
          .update({ name: name.trim(), category, color: colour.trim() || null, tags: parseTags(tags) })
          .eq('id', item.id)
        if (error) throw error
      } else {
        if (!prepared) throw new Error('Add a photo first.')
        const path = `${session.user.id}/${crypto.randomUUID()}.${prepared.extension}`
        const up = await sb.storage.from('wardrobe').upload(path, prepared.blob, { contentType: prepared.blob.type, upsert: false })
        if (up.error) throw up.error
        const { data: row, error } = await sb.from('wardrobe_items').insert({
          profile_id: profileId,
          image_path: path,
          name: name.trim(),
          category,
          color: colour.trim() || null,
          tags: parseTags(tags),
        }).select('id').single()
        if (error) {
          await sb.storage.from('wardrobe').remove([path]) // don't leave an orphan photo
          throw error
        }
        toast(`${name.trim()} added to your wardrobe`)
        onSaved(row.id)
        onClose()
        return
      }
      toast('Changes saved')
      onSaved()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!item) return
    const sb = supabase()
    const { count } = await sb.from('outfit_items').select('item_id', { count: 'exact', head: true }).eq('item_id', item.id)
    const ok = await confirm({
      title: `Delete ${item.name}?`,
      message: count
        ? `It’s used in ${count} look${count > 1 ? 's' : ''}. It will be removed from those looks. This can’t be undone.`
        : 'The photo is deleted for good. This can’t be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      const { error } = await sb.from('wardrobe_items').delete().eq('id', item.id)
      if (error) throw error
      await sb.storage.from('wardrobe').remove([item.image_path])
      forgetSignedUrl(item.image_path)
      toast('Deleted')
      onSaved()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const preview = prepared?.url ?? (editing ? imageUrl : undefined)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit piece' : 'Add to wardrobe'}
      footer={
        <>
          {editing && (
            <button className="btn danger" onClick={remove} disabled={saving} style={{ marginRight: 'auto' }}>
              Delete
            </button>
          )}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={saving || !!busy || (!editing && !prepared)}>
            {saving ? <><span className="spinner" aria-hidden /> Saving</> : editing ? 'Save changes' : 'Add piece'}
          </button>
        </>
      }
    >
      <div className="stack">
        {!editing && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setFile(f)
                e.target.value = ''
              }}
            />
            {!file && (
              <button
                type="button"
                className={`drop ${dragOver ? 'over' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) setFile(f)
                }}
              >
                <Icon name="upload" />
                <strong>Choose or drop a photo</strong>
                <span className="muted small">A photo of the piece, or a screenshot from a shopping site.</span>
              </button>
            )}
            <label className="switch">
              <span className="label">
                <strong>Remove background</strong>
                <span className="hint">Free. Runs on this device and never uses AI credits. Turn off for a faster save.</span>
              </span>
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(e) => {
                  setRemoveBg(e.target.checked)
                  setBgRemovalPreference(e.target.checked)
                }}
                disabled={!!busy}
              />
            </label>
          </>
        )}

        {busy && (
          <div className="stack" style={{ ['--gap' as string]: '0.4rem' }} aria-live="polite">
            <p className="small">{busy.msg}…</p>
            <div className={`progress ${busy.frac === undefined ? 'indeterminate' : ''}`}>
              <i style={{ width: busy.frac === undefined ? undefined : `${Math.round(busy.frac * 100)}%` }} />
            </div>
          </div>
        )}

        {preview && (
          <div className="checker">
            <img src={preview} alt="Preview of the piece" />
          </div>
        )}
        {file && !busy && (
          <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
            Use a different photo
          </button>
        )}

        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}

        {(editing || prepared) && (
          <>
            <label className="field">
              <span>Name</span>
              <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="White linen dress" />
            </label>
            <div className="grid-2">
              <label className="field">
                <span>Type</span>
                <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Colour</span>
                <input className="input" value={colour} maxLength={30} onChange={(e) => setColour(e.target.value)} placeholder="White" />
              </label>
            </div>
            <label className="field">
              <span>Tags</span>
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="beach, linen, summer" />
              <small>Separate with commas. Helps you filter later.</small>
            </label>
          </>
        )}
      </div>
    </Sheet>
  )
}
