'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/lib/profile'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/lib/constants'
import ProfileForm, { type ProfileDraft } from '@/components/ProfileForm'
import { useFeedback } from '@/components/Feedback'
import Icon from '@/components/Icon'

export default function ProfileSettingsPage() {
  const { profile, reload } = useProfile()
  const router = useRouter()
  const { confirm, toast } = useFeedback()
  const [draft, setDraft] = useState<ProfileDraft>({ name: profile.name, emoji: profile.emoji || '🌸', theme: profile.theme, style_for: profile.style_for || 'any' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!draft.name.trim()) return setError('The profile needs a name.')
    setBusy(true)
    setError('')
    const { error } = await supabase().from('style_profiles').update({ name: draft.name.trim(), emoji: draft.emoji, theme: draft.theme, style_for: draft.style_for }).eq('id', profile.id)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast('Profile saved')
    reload()
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete ${profile.name}?`,
      message: 'This permanently deletes this profile’s wardrobe photos, trips and looks.',
      confirmText: 'Delete profile',
      danger: true,
      typeToConfirm: profile.name,
    })
    if (!ok) return
    setBusy(true)
    try {
      const sb = supabase()
      const { data: items } = await sb.from('wardrobe_items').select('image_path').eq('profile_id', profile.id)
      const paths = (items || []).map((i) => i.image_path)
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await sb.storage.from('wardrobe').remove(paths.slice(i, i + 100))
        if (error) throw error
      }
      const { error } = await sb.from('style_profiles').delete().eq('id', profile.id)
      if (error) throw error
      toast('Profile deleted')
      router.replace('/')
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ ['--gap' as string]: '1.4rem' }}>
      <div className="page-title">
        <h1>Profile</h1>
        <p className="muted">Pick a look for the app. It only changes how things look for this profile.</p>
      </div>
      <ProfileForm initial={draft} onChange={setDraft} />
      {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
      <div className="row">
        <button className="btn primary" onClick={save} disabled={busy}>Save profile</button>
      </div>
      <div className="card stack">
        <h3>Delete this profile</h3>
        <p className="muted small">Removes this profile’s wardrobe photos, trips and looks. Other profiles are not affected.</p>
        <div><button className="btn danger" onClick={remove} disabled={busy}>Delete profile</button></div>
      </div>
    </div>
  )
}
