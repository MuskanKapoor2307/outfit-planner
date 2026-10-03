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
import Menu from '@/components/Menu'
import { useFeedback } from '@/components/Feedback'
import type { StyleProfile } from '@/lib/types'

const blank = (): ProfileDraft => ({ name: '', emoji: '🌸', theme: 'vloset', style_for: 'any' })

function ProfilePicker() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [profiles, setProfiles] = useState<StyleProfile[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ProfileDraft>(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { confirm, toast } = useFeedback()

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

  async function deleteProfile(p: StyleProfile) {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      message: 'This permanently deletes this profile’s wardrobe photos, try-on photo, trips, looks and shopping lists. Other profiles are not affected.',
      confirmText: 'Delete profile',
      danger: true,
      typeToConfirm: p.name,
    })
    if (!ok) return
    try {
      const sb = supabase()
      const { data: items } = await sb.from('wardrobe_items').select('image_path').eq('profile_id', p.id)
      const paths = (items || []).map((i) => i.image_path)
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await sb.storage.from('wardrobe').remove(paths.slice(i, i + 100))
        if (error) throw error
      }
      if (p.body_photo_path) await sb.storage.from('people').remove([p.body_photo_path])
      const { error } = await sb.from('style_profiles').delete().eq('id', p.id)
      if (error) throw error
      toast(`${p.name} deleted`)
      load()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <div className="wrap">

      <main className="page-enter" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)' }}>
        <div className="page-title">
          <h1>Who’s planning?</h1>
          <p className="muted">Each profile has its own wardrobe, trips and look.</p>
        </div>

        {profiles === null ? (
          <div className="who-grid">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ minHeight: 190 }} />)}</div>
        ) : (
          <div className="who-grid stagger">
            {profiles.map((p, i) => (
              <div key={p.id} className="who-wrap" style={{ ['--i' as string]: i }}>
              <Link href={`/p/${p.id}`} className="who-tile" data-theme={p.theme}>
                <span className="emoji" aria-hidden>{p.emoji || '🌸'}</span>
                <span className="paper">
                  <strong>{p.name}</strong>
                  <span className="theme"><i aria-hidden />{themeInfo(p.theme)?.name}</span>
                </span>
              </Link>
              <div className="card-menu">
                <Menu
                  label={`Options for ${p.name}`}
                  items={[
                    { label: 'Edit name, icon and theme', icon: 'edit', onClick: () => router.push(`/p/${p.id}/style`) },
                    { label: 'Delete profile', icon: 'trash', onClick: () => deleteProfile(p), danger: true },
                  ]}
                />
              </div>
              </div>
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
                <span className="paper">
                  <span className="plus" aria-hidden><Icon name="plus" /></span>
                  <span>Add profile</span>
                </span>
              </button>
            )}
          </div>
        )}

        <p className="muted small" style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          Settings, AI and {isAdmin ? 'invites' : 'your account'} are in each profile’s <strong>Profile</strong> tab.{' '}
          <Link href="/account">Account</Link>
        </p>
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
