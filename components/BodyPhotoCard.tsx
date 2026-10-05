'use client'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { useFeedback } from './Feedback'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { getSignedUrls, forgetSignedUrl } from '@/lib/signedUrls'
import { prepareImage, type PreparedImage } from '@/lib/image'
import { uploadPhoto } from '@/lib/upload'
import { friendlyError } from '@/lib/constants'
import type { StyleProfile } from '@/lib/types'

/** Upload, replace or delete the full-length photo used by the free try-on board. */
export default function BodyPhotoCard({ profile, onChanged }: { profile: StyleProfile; onChanged: () => void }) {
  const { session } = useAuth()
  const { confirm, toast } = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<PreparedImage | null>(null)
  const [removeBg, setRemoveBg] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!profile.body_photo_path) return setUrl(null)
    getSignedUrls([profile.body_photo_path], 'people').then((u) => setUrl(u[profile.body_photo_path!] ?? null)).catch(() => setUrl(null))
  }, [profile.body_photo_path])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setPrepared(null)
    prepareImage(file, removeBg, (m) => !cancelled && setBusy(m))
      .then((p) => !cancelled && setPrepared(p))
      .catch((e) => !cancelled && toast(friendlyError(e), 'error'))
      .finally(() => !cancelled && setBusy(null))
    return () => {
      cancelled = true
    }
  }, [file, removeBg, toast])

  async function save() {
    if (!prepared || !session || !consent) return
    setBusy('Saving')
    const sb = supabase()
    try {
      const path = `${session.user.id}/${profile.id}-${crypto.randomUUID()}.${prepared.extension}`
      await uploadPhoto('people', path, prepared.blob)
      const old = profile.body_photo_path
      const { error } = await sb.from('style_profiles').update({ body_photo_path: path, body_photo_consent_at: new Date().toISOString() }).eq('id', profile.id)
      if (error) {
        await sb.storage.from('people').remove([path])
        throw error
      }
      if (old) {
        await sb.storage.from('people').remove([old])
        forgetSignedUrl(old, 'people')
      }
      toast('Try-on photo saved')
      setFile(null)
      setPrepared(null)
      setConsent(false)
      onChanged()
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!profile.body_photo_path) return
    const ok = await confirm({ title: 'Delete your try-on photo?', message: 'The photo is deleted for good. Saved try-on layouts stay, so you can add a new photo later.', confirmText: 'Delete photo', danger: true })
    if (!ok) return
    setBusy('Deleting')
    const sb = supabase()
    const path = profile.body_photo_path
    const { error } = await sb.from('style_profiles').update({ body_photo_path: null, body_photo_consent_at: null }).eq('id', profile.id)
    if (!error) await sb.storage.from('people').remove([path])
    forgetSignedUrl(path, 'people')
    setBusy(null)
    if (error) return toast(friendlyError(error), 'error')
    toast('Photo deleted')
    onChanged()
  }

  return (
    <div className="card stack">
      <div className="spread">
        <h3>Try-on photo</h3>
        <span className="badge">Free, no AI</span>
      </div>
      <p className="muted small">
        A full-length photo of {profile.name === 'Me' ? 'yourself' : profile.name}, standing straight, facing the camera. Outfits are layered on it like a paper doll.
        It’s kept in a separate private storage area and is never sent to any AI.
      </p>

      {url && !file && (
        <>
          <div className="checker"><img className="body-preview" src={url} alt="Your try-on photo" /></div>
          <div className="row">
            <button className="btn small" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Replace</button>
            <button className="btn small camera-btn" onClick={() => cameraRef.current?.click()}><Icon name="camera" /> Take a new one</button>
            <button className="btn small danger" onClick={remove} disabled={!!busy}><Icon name="trash" /> Delete photo</button>
          </div>
        </>
      )}

      {!url && !file && (
        <button type="button" className="drop" onClick={() => fileRef.current?.click()}>
          <Icon name="user" />
          <strong>Add a full-length photo</strong>
          <span className="muted small">Plain background works best. Head to toe in the frame.</span>
        </button>
      )}
      {!url && !file && (
        <button type="button" className="btn camera-btn" onClick={() => cameraRef.current?.click()}>
          <Icon name="camera" /> Take a photo
        </button>
      )}

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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) setFile(f)
          e.target.value = ''
        }}
      />

      {file && (
        <div className="stack">
          <label className="switch">
            <span className="label"><strong>Remove background</strong><span className="hint">Free, runs on this device, never uses AI credits.</span></span>
            <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} disabled={!!busy} />
          </label>
          {busy && <div className="progress indeterminate"><i /></div>}
          {prepared && <div className="checker"><img className="body-preview" src={prepared.url} alt="Preview" /></div>}
          <label className="switch">
            <span className="label">
              <strong>This is me, or I have this person’s permission</strong>
              <span className="hint">Only add photos of adults who agreed to it. You can delete the photo any time.</span>
            </span>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          </label>
          <div className="row">
            <button className="btn ghost" onClick={() => { setFile(null); setPrepared(null) }}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!prepared || !consent || !!busy}>
              {busy ? <><span className="spinner" aria-hidden /> {busy}</> : 'Save photo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
