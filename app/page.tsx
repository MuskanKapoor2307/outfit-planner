'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RequireAuth, useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/constants'
import { themeInfo } from '@/lib/themes'
import Sheet from '@/components/Sheet'
import Icon from '@/components/Icon'
import ProfileForm, { type ProfileDraft } from '@/components/ProfileForm'
import type { StyleProfile } from '@/lib/types'

const blank = (): ProfileDraft => ({ name: '', emoji: '🌸', theme: 'vanilla-latte', style_for: 'any' })

function ProfilePicker() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [profiles, setProfiles] = useState<StyleProfile[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ProfileDraft>(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase().from('style_profiles').select('*').order('created_at')
    setProfiles((data || []) as StyleProfile[])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function create() {
    if (!draft.name.trim()) return setError('Give the profile a name.')
    setBusy(true)
    setError('')
    const { data, error } = await supabase()
      .from('style_profiles')
      .insert({ name: draft.name.trim(), emoji: draft.emoji, theme: draft.theme, style_for: draft.style_for })
      .select('id')
      .single()
    setBusy(false)
    if (error) return setError(friendlyError(error))
    router.push(`/p/${data.id}`)
  }

  return (
    <div className="wrap">
      <header className="topbar">
        <span className="brand"><span className="mark"><Icon name="hanger" /></span>Outfit Planner</span>
        <div className="row" style={{ gap: '0.2rem' }}>
          {isAdmin && <Link href="/admin" className="btn ghost small"><Icon name="mail" /> Invites</Link>}
          <Link href="/settings/ai" className="btn ghost small" aria-label="AI settings"><Icon name="sparkle" /> AI</Link>
          <Link href="/account" className="btn ghost small" aria-label="Account"><Icon name="settings" /></Link>
        </div>
      </header>

      <main className="page-enter">
        <div className="page-title">
          <h1>Who’s planning?</h1>
          <p className="muted">Each profile has its own wardrobe, trips and look.</p>
        </div>

        {profiles === null ? (
          <div className="who-grid">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ minHeight: 190 }} />)}</div>
        ) : (
          <div className="who-grid stagger">
            {profiles.map((p, i) => (
              <Link key={p.id} href={`/p/${p.id}`} className="who-tile" data-theme={p.theme} style={{ ['--i' as string]: i }}>
                <span className="emoji" aria-hidden>{p.emoji || '🌸'}</span>
                <strong>{p.name}</strong>
                <span className="theme"><i aria-hidden />{themeInfo(p.theme)?.name}</span>
              </Link>
            ))}
            {profiles.length < 8 && (
              <button
                className="who-tile add"
                style={{ ['--i' as string]: profiles.length }}
                onClick={() => {
                  setDraft(blank())
                  setError('')
                  setAdding(true)
                }}
              >
                <span className="plus" aria-hidden><Icon name="plus" /></span>
                <span>Add profile</span>
              </button>
            )}
          </div>
        )}
      </main>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="New profile"
        footer={
          <>
            <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary" onClick={create} disabled={busy}>{busy ? <><span className="spinner" aria-hidden /> Creating</> : 'Create profile'}</button>
          </>
        }
      >
        <div className="stack">
          {adding && <ProfileForm initial={draft} onChange={setDraft} />}
          {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
        </div>
      </Sheet>
    </div>
  )
}

export default function Home() {
  return (
    <RequireAuth>
      <ProfilePicker />
    </RequireAuth>
  )
}
