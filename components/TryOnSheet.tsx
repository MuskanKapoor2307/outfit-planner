'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from './Sheet'
import Icon from './Icon'
import BodyPhotoCard from './BodyPhotoCard'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { getSignedUrls } from '@/lib/signedUrls'
import { friendlyError } from '@/lib/constants'
import type { Outfit, StyleProfile, TryOnPlacement, WardrobeItem } from '@/lib/types'

// Where a piece starts on the body, by type: [x%, y%, width%, layer]
const START: Record<string, [number, number, number, number]> = {
  bottom: [50, 62, 36, 1],
  dress: [50, 46, 44, 2],
  set: [50, 46, 46, 2],
  ethnic: [50, 46, 48, 2],
  top: [50, 34, 42, 3],
  outerwear: [50, 34, 50, 4],
  footwear: [50, 92, 30, 5],
  bag: [76, 52, 24, 6],
  jewellery: [50, 19, 14, 7],
  watch: [30, 52, 10, 7],
  accessory: [70, 30, 18, 7],
  eyewear: [50, 9, 16, 8],
  other: [50, 50, 30, 3],
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const round = (v: number) => Math.round(v * 10) / 10

function startFor(item: WardrobeItem): TryOnPlacement {
  const [x, y, w, z] = START[item.category] ?? START.other
  return { item_id: item.id, x, y, w, r: 0, z }
}

export default function TryOnSheet({
  open,
  onClose,
  profile,
  outfit,
  items,
  urls,
  onSaved,
  onProfileChanged,
}: {
  open: boolean
  onClose: () => void
  profile: StyleProfile
  outfit: Outfit | null
  items: WardrobeItem[]
  urls: Record<string, string>
  onSaved: () => void
  onProfileChanged: () => void
}) {
  const { toast } = useFeedback()
  const stageRef = useRef<HTMLDivElement>(null)
  const [bodyUrl, setBodyUrl] = useState<string | null>(null)
  const [placed, setPlaced] = useState<TryOnPlacement[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; start: TryOnPlacement } | null>(null)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const outfitItems = useMemo(
    () => (outfit ? [...outfit.outfit_items].sort((a, b) => a.position - b.position).map((l) => byId.get(l.item_id)).filter(Boolean) as WardrobeItem[] : []),
    [outfit, byId],
  )

  useEffect(() => {
    if (!open || !outfit) return
    const saved = (outfit.tryon || []).filter((p) => byId.has(p.item_id))
    const missing = outfitItems.filter((i) => !saved.some((p) => p.item_id === i.id)).map(startFor)
    setPlaced(outfit.tryon ? saved : missing)
    setActive(null)
  }, [open, outfit, outfitItems, byId])

  useEffect(() => {
    if (!open || !profile.body_photo_path) return setBodyUrl(null)
    getSignedUrls([profile.body_photo_path], 'people').then((u) => setBodyUrl(u[profile.body_photo_path!] ?? null)).catch(() => setBodyUrl(null))
  }, [open, profile.body_photo_path])

  const sel = placed.find((p) => p.item_id === active) || null
  const update = (id: string, patch: Partial<TryOnPlacement>) => setPlaced((ps) => ps.map((p) => (p.item_id === id ? { ...p, ...patch } : p)))

  function onDown(e: React.PointerEvent, id: string, mode: 'move' | 'resize') {
    e.stopPropagation()
    const p = placed.find((x) => x.item_id === id)
    if (!p) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setActive(id)
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, start: { ...p } }
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current
    const rect = stageRef.current?.getBoundingClientRect()
    if (!d || !rect) return
    const dx = ((e.clientX - d.sx) / rect.width) * 100
    const dy = ((e.clientY - d.sy) / rect.height) * 100
    if (d.mode === 'move') update(d.id, { x: round(clamp(d.start.x + dx, 0, 100)), y: round(clamp(d.start.y + dy, 0, 100)) })
    else update(d.id, { w: round(clamp(d.start.w + dx * 2, 5, 100)) })
  }

  function onUp() {
    drag.current = null
  }

  function togglePiece(item: WardrobeItem) {
    setPlaced((ps) => (ps.some((p) => p.item_id === item.id) ? ps.filter((p) => p.item_id !== item.id) : [...ps, startFor(item)]))
    setActive(item.id)
  }

  function layer(dir: 1 | -1) {
    if (!sel) return
    const zs = placed.map((p) => p.z)
    update(sel.item_id, { z: dir === 1 ? Math.max(...zs) + 1 : Math.min(...zs) - 1 })
  }

  async function save() {
    if (!outfit) return
    setSaving(true)
    const { error } = await supabase().from('outfits').update({ tryon: placed }).eq('id', outfit.id)
    setSaving(false)
    if (error) return toast(friendlyError(error), 'error')
    toast('Try-on saved')
    onSaved()
  }

  async function download() {
    if (!bodyUrl) return
    try {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image()
          im.crossOrigin = 'anonymous'
          im.onload = () => res(im)
          im.onerror = () => rej(new Error('image'))
          im.src = src
        })
      const W = 900, H = 1200
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      const body = await load(bodyUrl)
      const s = Math.min(W / body.width, H / body.height)
      ctx.drawImage(body, (W - body.width * s) / 2, (H - body.height * s) / 2, body.width * s, body.height * s)
      for (const p of [...placed].sort((a, b) => a.z - b.z)) {
        const it = byId.get(p.item_id)
        if (!it || !urls[it.image_path]) continue
        const im = await load(urls[it.image_path])
        const w = (p.w / 100) * W
        const h = w * (im.height / im.width)
        ctx.save()
        ctx.translate((p.x / 100) * W, (p.y / 100) * H)
        ctx.rotate((p.r * Math.PI) / 180)
        ctx.drawImage(im, -w / 2, -h / 2, w, h)
        ctx.restore()
      }
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.9))
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(outfit?.title || 'try-on').replace(/[^\w-]+/g, '-')}.jpg`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    } catch {
      toast('Couldn’t make the image on this device. A screenshot works too.', 'error')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<>Try it on <span className="badge">Free, no AI</span></>}
      footer={
        bodyUrl && outfit ? (
          <>
            <button className="btn ghost" onClick={() => outfit && setPlaced(outfitItems.map(startFor))} style={{ marginRight: 'auto' }}>Reset</button>
            <button className="btn" onClick={download}><Icon name="share" /> Save image</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving ? <><span className="spinner" aria-hidden /> Saving</> : 'Save layout'}</button>
          </>
        ) : undefined
      }
    >
      {!profile.body_photo_path ? (
        <div className="stack">
          <p className="muted">Add a full-length photo once, then every look can be tried on it.</p>
          <BodyPhotoCard profile={profile} onChanged={onProfileChanged} />
        </div>
      ) : !outfit ? null : outfitItems.length === 0 ? (
        <div className="empty-state">
          <p>This look has no wardrobe pieces yet. Add pieces to the look first, then try it on.</p>
        </div>
      ) : (
        <div className="tryon-wrap">
          <div
            ref={stageRef}
            className="tryon-stage"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerDown={() => setActive(null)}
          >
            {bodyUrl ? <img className="body" src={bodyUrl} alt="You" /> : <div className="skel" style={{ position: 'absolute', inset: 0 }} />}
            {[...placed].sort((a, b) => a.z - b.z).map((p) => {
              const it = byId.get(p.item_id)
              if (!it) return null
              return (
                <div
                  key={p.item_id}
                  className={`tryon-piece ${active === p.item_id ? 'active' : ''}`}
                  style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, zIndex: p.z + 10, transform: `translate(-50%, -50%) rotate(${p.r}deg)` }}
                  onPointerDown={(e) => onDown(e, p.item_id, 'move')}
                  role="button"
                  aria-label={`Move ${it.name}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    const step = e.shiftKey ? 5 : 1
                    if (e.key === 'ArrowLeft') update(p.item_id, { x: clamp(p.x - step, 0, 100) })
                    if (e.key === 'ArrowRight') update(p.item_id, { x: clamp(p.x + step, 0, 100) })
                    if (e.key === 'ArrowUp') update(p.item_id, { y: clamp(p.y - step, 0, 100) })
                    if (e.key === 'ArrowDown') update(p.item_id, { y: clamp(p.y + step, 0, 100) })
                    if (e.key.startsWith('Arrow')) e.preventDefault()
                  }}
                  onFocus={() => setActive(p.item_id)}
                >
                  {urls[it.image_path] && <img src={urls[it.image_path]} alt="" draggable={false} />}
                  {active === p.item_id && (
                    <span className="handle" onPointerDown={(e) => onDown(e, p.item_id, 'resize')} aria-hidden>
                      <Icon name="plus" />
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="tryon-tools">
            <span className="label-mono">Pieces (tap to show or hide)</span>
            <div className="tryon-tray">
              {outfitItems.map((it) => (
                <button key={it.id} type="button" aria-pressed={placed.some((p) => p.item_id === it.id)} onClick={() => togglePiece(it)} aria-label={it.name}>
                  {urls[it.image_path] && <img src={urls[it.image_path]} alt="" />}
                </button>
              ))}
            </div>
            {sel ? (
              <>
                <strong>{byId.get(sel.item_id)?.name}</strong>
                <label className="field">
                  <span>Size</span>
                  <input type="range" min={5} max={100} step={0.5} value={sel.w} onChange={(e) => update(sel.item_id, { w: Number(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Tilt</span>
                  <input type="range" min={-45} max={45} step={1} value={sel.r} onChange={(e) => update(sel.item_id, { r: Number(e.target.value) })} />
                </label>
                <div className="row">
                  <button className="btn small" onClick={() => layer(1)}><Icon name="up" /> Front</button>
                  <button className="btn small" onClick={() => layer(-1)}><Icon name="down" /> Back</button>
                </div>
              </>
            ) : (
              <p className="muted small">Drag a piece to move it. Tap it to resize, tilt or change which piece sits in front.</p>
            )}
            <p className="muted small">Your photo and pieces stay in your private storage. Nothing here uses AI.</p>
          </div>
        </div>
      )}
    </Sheet>
  )
}
