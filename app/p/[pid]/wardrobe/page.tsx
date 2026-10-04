'use client'
import { useCallback, useEffect, useState } from 'react'
import { useProfile } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import { useSignedUrls } from '@/lib/signedUrls'
import { readCache, writeCache } from '@/lib/tabCache'
import { CATEGORIES } from '@/lib/constants'
import ItemGrid from '@/components/ItemGrid'
import ItemSheet from '@/components/ItemSheet'
import BulkEditSheet from '@/components/BulkEditSheet'
import BulkUploadSheet from '@/components/BulkUploadSheet'
import Icon from '@/components/Icon'
import { useFeedback } from '@/components/Feedback'
import { forgetSignedUrl } from '@/lib/signedUrls'
import { friendlyError } from '@/lib/constants'
import type { WardrobeItem } from '@/lib/types'

export default function WardrobePage() {
  const { profile } = useProfile()
  const cacheKey = `wardrobe:${profile.id}`
  const [items, setItems] = useState<WardrobeItem[] | null>(() => readCache<WardrobeItem[]>(cacheKey))
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<WardrobeItem | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [bulkEditing, setBulkEditing] = useState(false)
  const [bulkAdding, setBulkAdding] = useState(false)
  const { confirm, toast } = useFeedback()

  const load = useCallback(async () => {
    const { data, error } = await supabase().from('wardrobe_items').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false })
    if (error) return setItems((cur) => cur ?? [])
    setItems((data || []) as WardrobeItem[])
    writeCache(cacheKey, data)
  }, [profile.id, cacheKey])

  useEffect(() => {
    load()
  }, [load])

  async function deleteSelected() {
    const chosen = (items || []).filter((i) => selected.includes(i.id))
    if (!chosen.length) return
    const sb = supabase()
    const { count } = await sb.from('outfit_items').select('item_id', { count: 'exact', head: true }).in('item_id', chosen.map((c) => c.id))
    const ok = await confirm({
      title: `Delete ${chosen.length} piece${chosen.length > 1 ? 's' : ''}?`,
      message: count
        ? `Some of them are used in planned looks (${count} place${count > 1 ? 's' : ''}). They’ll be removed from those looks. The photos are deleted for good.`
        : 'The photos are deleted for good. This can’t be undone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      const { error } = await sb.from('wardrobe_items').delete().in('id', chosen.map((c) => c.id))
      if (error) throw error
      await sb.storage.from('wardrobe').remove(chosen.map((c) => c.image_path))
      chosen.forEach((c) => forgetSignedUrl(c.image_path))
      toast(`${chosen.length} deleted`)
      setSelected([])
      setSelecting(false)
      load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const urls = useSignedUrls((items || []).map((i) => i.image_path))
  const used = new Set((items || []).map((i) => i.category))
  const q = query.trim().toLowerCase()
  const visible = (items || []).filter(
    (i) =>
      (filter === 'all' || i.category === filter) &&
      (!q || i.name.toLowerCase().includes(q) || (i.color || '').toLowerCase().includes(q) || i.tags.some((t) => t.includes(q))),
  )

  return (
    <>
      <div className="spread page-title">
        <h1>Wardrobe</h1>
        <div className="row">
          {!!items?.length && (
            <button className="btn" onClick={() => { setSelecting((v) => !v); setSelected([]) }}>
              {selecting ? 'Cancel' : <><Icon name="select" /> Select</>}
            </button>
          )}
          {!selecting && <button className="btn" onClick={() => setBulkAdding(true)}><Icon name="image" /> Add many</button>}
          {!selecting && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add piece</button>}
        </div>
      </div>

      {items === null && <div className="items">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" style={{ aspectRatio: '1' }} />)}</div>}

      {items?.length === 0 && (
        <div className="empty-state card">
          <span className="art" aria-hidden>👗</span>
          <h2>Start your digital wardrobe</h2>
          <p className="muted">Add a photo of a dress, sneakers or a watch. Removing the background is optional, free, and happens on your device.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setAdding(true)}>Add your first piece</button>
            <button className="btn" onClick={() => setBulkAdding(true)}><Icon name="image" /> Add many at once</button>
          </div>
        </div>
      )}

      {!!items?.length && (
        <div className="stack">
          <input className="input" type="search" placeholder="Search by name, colour or tag" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search wardrobe" />
          <div className="chips scroll">
            <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All ({items.length})</button>
            {CATEGORIES.filter((c) => used.has(c.id)).map((c) => (
              <button key={c.id} className="chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          {visible.length ? <ItemGrid
              items={visible}
              urls={urls}
              onPick={(it) => (selecting ? setSelected((sel) => (sel.includes(it.id) ? sel.filter((x) => x !== it.id) : [...sel, it.id])) : setEditing(it))}
              selected={selecting ? selected : undefined}
            /> : <p className="muted">Nothing matches that search.</p>}
        </div>
      )}

 {selecting && (
        <div className="select-bar">
          <span><strong>{selected.length}</strong> selected</span>
          <div className="row">
            <button className="btn small" onClick={() => setSelected(selected.length === visible.length ? [] : visible.map((v) => v.id))}>
              {selected.length === visible.length ? 'Clear' : 'Select all'}
            </button>
            <button className="btn small" disabled={!selected.length || deleting} onClick={() => setBulkEditing(true)}>
              <Icon name="edit" /> Edit
            </button>
            <button className="btn small danger" disabled={!selected.length || deleting} onClick={deleteSelected}>
              {deleting ? <><span className="spinner" aria-hidden /> Deleting</> : <><Icon name="trash" /> Delete</>}
            </button>
          </div>
        </div>
      )}

      {!!items?.length && !selecting && (
        <button className="fab" onClick={() => setAdding(true)} aria-label="Add piece"><Icon name="plus" /></button>
      )}

      <BulkUploadSheet open={bulkAdding} onClose={() => setBulkAdding(false)} profileId={profile.id} onSaved={() => load()} />
      <BulkEditSheet
        open={bulkEditing}
        onClose={() => setBulkEditing(false)}
        items={(items || []).filter((i) => selected.includes(i.id))}
        onSaved={() => load()}
      />
      <ItemSheet open={adding} onClose={() => setAdding(false)} profileId={profile.id} onSaved={() => load()} />
      <ItemSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        profileId={profile.id}
        item={editing}
        imageUrl={editing ? urls[editing.image_path] : undefined}
        onSaved={() => load()}
      />
    </>
  )
}
