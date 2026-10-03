'use client'
import { useCallback, useEffect, useState } from 'react'
import { useProfile } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import { useSignedUrls } from '@/lib/signedUrls'
import { CATEGORIES } from '@/lib/constants'
import ItemGrid from '@/components/ItemGrid'
import ItemSheet from '@/components/ItemSheet'
import Icon from '@/components/Icon'
import type { WardrobeItem } from '@/lib/types'

export default function WardrobePage() {
  const { profile } = useProfile()
  const [items, setItems] = useState<WardrobeItem[] | null>(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<WardrobeItem | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase().from('wardrobe_items').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false })
    setItems((data || []) as WardrobeItem[])
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

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
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add piece</button>
      </div>

      {items === null && <div className="items">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel" style={{ aspectRatio: '1' }} />)}</div>}

      {items?.length === 0 && (
        <div className="empty-state card">
          <span className="art" aria-hidden>👗</span>
          <h2>Start your digital wardrobe</h2>
          <p className="muted">Add a photo of a dress, sneakers or a watch. Removing the background is optional, free, and happens on your device.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>Add your first piece</button>
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
          {visible.length ? <ItemGrid items={visible} urls={urls} onPick={setEditing} /> : <p className="muted">Nothing matches that search.</p>}
        </div>
      )}

      {!!items?.length && (
        <button className="fab" onClick={() => setAdding(true)} aria-label="Add piece"><Icon name="plus" /></button>
      )}

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
