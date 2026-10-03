'use client'
import { useCallback, useEffect, useState } from 'react'
import Icon from './Icon'
import Menu from './Menu'
import ShoppingSheet from './ShoppingSheet'
import ItemSheet from './ItemSheet'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { categoryLabel, friendlyError, linkHost, rupees } from '@/lib/constants'
import type { ShoppingItem } from '@/lib/types'

export default function ShoppingList({ tripId, profileId, onCountChange, onWardrobeChanged }: {
  tripId: string
  profileId: string
  onCountChange?: (toBuy: number) => void
  onWardrobeChanged?: () => void
}) {
  const { confirm, toast } = useFeedback()
  const [list, setList] = useState<ShoppingItem[] | null>(null)
  const [editing, setEditing] = useState<{ item: ShoppingItem | null } | null>(null)
  const [moving, setMoving] = useState<ShoppingItem | null>(null)
  const [preset, setPreset] = useState<{ name: string; category: string | null } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase().from('shopping_items').select('*').eq('trip_id', tripId).order('created_at')
    const rows = (data || []) as ShoppingItem[]
    setList(rows)
    onCountChange?.(rows.filter((r) => r.status === 'to_buy').length)
  }, [tripId, onCountChange])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(it: ShoppingItem, status: ShoppingItem['status']) {
    setList((l) => l?.map((x) => (x.id === it.id ? { ...x, status } : x)) ?? null)
    const { error } = await supabase().from('shopping_items').update({ status }).eq('id', it.id)
    if (error) toast(friendlyError(error), 'error')
    load()
  }

  async function remove(it: ShoppingItem) {
    const ok = await confirm({ title: `Remove ${it.name}?`, message: 'It’s removed from this shopping list only.', confirmText: 'Remove', danger: true })
    if (!ok) return
    const { error } = await supabase().from('shopping_items').delete().eq('id', it.id)
    if (error) return toast(friendlyError(error), 'error')
    toast('Removed')
    load()
  }

  function startMove(it: ShoppingItem) {
    setPreset({ name: it.name, category: it.category })
    setMoving(it)
  }

  if (list === null) return <div className="skel" style={{ height: 160 }} />

  const toBuy = list.filter((i) => i.status === 'to_buy')
  const bought = list.filter((i) => i.status !== 'to_buy')
  const total = toBuy.reduce((s, i) => s + (i.price ?? 0), 0)

  const renderRow = (it: ShoppingItem) => (
    <div key={it.id} className={`shop-row ${it.status !== 'to_buy' ? 'done' : ''}`}>
      <button
        type="button"
        className="tick-box"
        aria-pressed={it.status !== 'to_buy'}
        aria-label={it.status === 'to_buy' ? `Mark ${it.name} as bought` : `Mark ${it.name} as not bought`}
        onClick={() => setStatus(it, it.status === 'to_buy' ? 'bought' : 'to_buy')}
        disabled={it.status === 'in_wardrobe'}
      >
        {it.status !== 'to_buy' && <Icon name="check" />}
      </button>
      <div className="shop-main">
        <strong>{it.name}</strong>
        <span className="muted small">
          {[it.category && categoryLabel(it.category), it.price != null && rupees(it.price), it.notes].filter(Boolean).join(', ')}
        </span>
        <span className="row" style={{ gap: '0.4rem' }}>
          {it.url && (
            <a className="chip small-chip" href={it.url} target="_blank" rel="noopener noreferrer nofollow">
              {linkHost(it.url) || 'Open link'} <Icon name="link" />
            </a>
          )}
          {it.status === 'bought' && (
            <button className="chip small-chip accent" onClick={() => startMove(it)}><Icon name="hanger" /> Move to wardrobe</button>
          )}
          {it.status === 'in_wardrobe' && <span className="badge ok"><Icon name="check" /> In wardrobe</span>}
        </span>
      </div>
      <Menu
        label={`Options for ${it.name}`}
        items={[
          { label: 'Edit', icon: 'edit', onClick: () => setEditing({ item: it }) },
          ...(it.status !== 'in_wardrobe' ? [{ label: 'Move to wardrobe', icon: 'hanger', onClick: () => startMove(it) }] : []),
          { label: 'Remove', icon: 'trash', onClick: () => remove(it), danger: true },
        ]}
      />
    </div>
  )

  return (
    <div className="stack" style={{ ['--gap' as string]: '1.2rem' }}>
      <div className="spread">
        <div>
          <h2>Shopping list</h2>
          <p className="muted small">
            {toBuy.length ? `${toBuy.length} to buy${total ? `, about ${rupees(total)}` : ''}` : 'Nothing left to buy'}
          </p>
        </div>
        <button className="btn primary" onClick={() => setEditing({ item: null })}><Icon name="plus" /> Add item</button>
      </div>

      {list.length === 0 ? (
        <div className="empty-state card">
          <span className="art" aria-hidden>🛍️</span>
          <h3>Nothing on the list yet</h3>
          <p className="muted">Add things you need for this trip, with a product link and price. Tick them off when bought, then move them into your wardrobe.</p>
        </div>
      ) : (
        <>
          <div className="shop-list stagger">{toBuy.map((it) => renderRow(it))}</div>
          {bought.length > 0 && (
            <div className="stack" style={{ ['--gap' as string]: '0.6rem' }}>
              <h3 className="muted">Bought</h3>
              <div className="shop-list">{bought.map((it) => renderRow(it))}</div>
            </div>
          )}
        </>
      )}

      <ShoppingSheet open={!!editing} onClose={() => setEditing(null)} tripId={tripId} item={editing?.item} onSaved={load} />
      <ItemSheet
        open={!!moving}
        onClose={() => setMoving(null)}
        profileId={profileId}
        preset={preset}
        title="Move to wardrobe"
        onSaved={async (newId) => {
          if (moving && newId) {
            await supabase().from('shopping_items').update({ status: 'in_wardrobe', wardrobe_item_id: newId }).eq('id', moving.id)
            toast(`${moving.name} is now in your wardrobe`)
          }
          onWardrobeChanged?.()
          load()
        }}
      />
    </div>
  )
}
