'use client'
import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { CATEGORIES, categoryLabel, friendlyError } from '@/lib/constants'
import { prepareImage, preloadBackgroundRemover } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import { uploadPhoto } from '@/lib/upload'
import { useAuth } from '@/lib/auth'
import { bgRemovalPreference, setBgRemovalPreference } from '@/lib/ai/settings'
import { useFeedback } from './Feedback'
import Icon from './Icon'

const MAX_FILES = 30
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

type Status = 'waiting' | 'working' | 'done' | 'failed'
interface Row {
  id: string
  file: File
  thumb: string
  status: Status
  msg?: string
}

const parseTags = (s: string) =>
  [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 24))

/** Add many wardrobe photos in one go. They are processed one at a time (background removal is heavy). */
export default function BulkUploadSheet({
  open,
  onClose,
  profileId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  profileId: string
  onSaved: () => void
}) {
  const { session } = useAuth()
  const { confirm, toast } = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [category, setCategory] = useState('dress')
  const [tags, setTags] = useState('')
  const [removeBg, setRemoveBg] = useState(true)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const stopRef = useRef(false)
  const runRef = useRef(0) // bumps every time the sheet opens, so an old run can't carry on
  const rowsRef = useRef<Row[]>([])
  rowsRef.current = rows

  useEffect(() => {
    if (!open) return
    runRef.current++
    rowsRef.current.forEach((r) => URL.revokeObjectURL(r.thumb))
    setRows([])
    setCategory('dress')
    setTags('')
    setRemoveBg(bgRemovalPreference())
    setRunning(false)
    setFinished(false)
    stopRef.current = false
  }, [open])

  // free the preview images when the list is cleared or the sheet goes away
  useEffect(() => () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.thumb)), [])

  useEffect(() => {
    if (open && removeBg) preloadBackgroundRemover()
  }, [open, removeBg])

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const room = MAX_FILES - rows.length
    const picked = [...list].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, Math.max(0, room))
    if (list.length > room) toast(`You can add up to ${MAX_FILES} photos at a time.`, 'error')
    setRows((r) => [
      ...r,
      ...picked.map((file) => ({ id: crypto.randomUUID(), file, thumb: URL.createObjectURL(file), status: 'waiting' as Status })),
    ])
  }

  function removeRow(id: string) {
    setRows((r) => {
      const gone = r.find((x) => x.id === id)
      if (gone) URL.revokeObjectURL(gone.thumb)
      return r.filter((x) => x.id !== id)
    })
  }

  const update = (id: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  async function run() {
    if (!session || running) return
    setRunning(true)
    setFinished(false)
    stopRef.current = false
    const myRun = runRef.current
    const sb = supabase()
    const tagList = parseTags(tags)
    let saved = 0
    for (const row of rowsRef.current.filter((r) => r.status !== 'done')) {
      if (stopRef.current || myRun !== runRef.current) break
      update(row.id, { status: 'working', msg: 'Getting ready' })
      let path: string | null = null
      try {
        const p = await prepareImage(row.file, removeBg, (msg) => update(row.id, { msg }))
        URL.revokeObjectURL(p.url)
        update(row.id, { msg: 'Saving' })
        path = `${session.user.id}/${crypto.randomUUID()}.${p.extension}`
        await uploadPhoto('wardrobe', path, p.blob)
        const name = `${p.colour ? `${p.colour} ` : ''}${categoryLabel(category).toLowerCase()}`
        const { error } = await sb.from('wardrobe_items').insert({
          profile_id: profileId,
          image_path: path,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          category,
          color: p.colour,
          tags: tagList,
        })
        if (error) throw error
        saved++
        update(row.id, { status: 'done', msg: undefined })
      } catch (e) {
        if (path) await sb.storage.from('wardrobe').remove([path]) // don't leave an orphan photo
        update(row.id, { status: 'failed', msg: friendlyError(e) })
        // the account is full: no point trying the rest
        if (friendlyError(e).startsWith('Limit reached')) break
      }
    }
    if (myRun === runRef.current) {
      setRunning(false)
      setFinished(true)
    }
    if (saved) {
      onSaved()
      toast(`${saved} piece${saved > 1 ? 's' : ''} added to your wardrobe`)
    }
  }

  async function close() {
    if (running) {
      const ok = await confirm({
        title: 'Stop adding photos?',
        message: 'Photos already saved stay in your wardrobe. The rest are not added.',
        confirmText: 'Stop',
      })
      if (!ok) return
      stopRef.current = true
    }
    onClose()
  }

  const done = rows.filter((r) => r.status === 'done').length
  const failed = rows.filter((r) => r.status === 'failed').length
  const left = rows.length - done

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add many pieces"
      footer={
        finished && !left ? (
          <button className="btn primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button className="btn ghost" onClick={close}>{running ? 'Stop' : finished ? 'Close' : 'Cancel'}</button>
            <button className="btn primary" onClick={run} disabled={running || !left}>
              {running ? (
                <><span className="spinner" aria-hidden /> Adding {done + 1} of {rows.length}</>
              ) : failed && finished ? (
                `Try ${left} again`
              ) : (
                `Add ${left || ''} piece${left === 1 ? '' : 's'}`
              )}
            </button>
          </>
        )
      }
    >
      <div className="stack">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {!running && !finished && (
          <>
            <button
              type="button"
              className="drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <Icon name="image" />
              <strong>{rows.length ? 'Add more photos' : 'Choose photos'}</strong>
              <span className="muted small">Pick up to {MAX_FILES} at once. You can rename each piece later.</span>
            </button>

            <div className="grid-2">
              <label className="field">
                <span>Type for all</span>
                <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tags for all</span>
                <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="summer, goa" />
              </label>
            </div>

            <label className="switch">
              <span className="label">
                <strong>Remove background</strong>
                <span className="hint">Free and on this device. Takes a few seconds per photo, so keep the app open.</span>
              </span>
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(e) => {
                  setRemoveBg(e.target.checked)
                  setBgRemovalPreference(e.target.checked)
                }}
              />
            </label>
          </>
        )}

        {running && <p className="small muted" aria-live="polite">Please keep the app open until all photos are added.</p>}

        {!!rows.length && (
          <ul className="bulk-list" aria-label="Photos to add">
            {rows.map((r) => (
              <li key={r.id} className={`bulk-row ${r.status}`}>
                <img src={r.thumb} alt="" decoding="async" />
                <span className="bulk-status">
                  {r.status === 'waiting' && <span className="muted">Waiting</span>}
                  {r.status === 'working' && <><span className="spinner" aria-hidden /> {r.msg}…</>}
                  {r.status === 'done' && <><Icon name="check" /> Added</>}
                  {r.status === 'failed' && <><Icon name="alert" /> {r.msg}</>}
                </span>
                {!running && r.status !== 'done' && (
                  <button type="button" className="btn ghost icon-only small" onClick={() => removeRow(r.id)} aria-label="Remove this photo">
                    <Icon name="x" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {finished && !!done && (
          <p className="small muted">Tip: use <strong>Select → Edit</strong> in your wardrobe to change the type or tags of several pieces at once.</p>
        )}
      </div>
    </Sheet>
  )
}
