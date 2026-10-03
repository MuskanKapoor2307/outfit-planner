'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RequireAuth, useAuth } from '@/lib/auth'
import { apiFetch, supabase } from '@/lib/supabase'
import { getSignedUrls } from '@/lib/signedUrls'
import { lockAllKeys, removeAllKeys } from '@/lib/ai/settings'
import { useFeedback } from '@/components/Feedback'
import Icon from '@/components/Icon'
import PasswordInput from '@/components/PasswordInput'

function Account() {
  const { session } = useAuth()
  const router = useRouter()
  const { confirm, toast } = useFeedback()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 10) return setError('Use at least 10 characters.')
    setBusy('pw')
    setError('')
    const { error } = await supabase().auth.updateUser({ password: pw })
    setBusy('')
    if (error) return setError(error.message)
    setPw('')
    toast('Password changed')
  }

  async function exportData() {
    setBusy('export')
    setError('')
    setMsg('Preparing your download…')
    try {
      const sb = supabase()
      const [p, w, t, o, oi] = await Promise.all([
        sb.from('style_profiles').select('*'),
        sb.from('wardrobe_items').select('*'),
        sb.from('trips').select('*'),
        sb.from('outfits').select('*'),
        sb.from('outfit_items').select('*'),
      ])
      for (const r of [p, w, t, o, oi]) if (r.error) throw r.error
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      zip.file(
        'data.json',
        JSON.stringify(
          { exported_at: new Date().toISOString(), profiles: p.data, wardrobe_items: w.data, trips: t.data, outfits: o.data, outfit_items: oi.data },
          null,
          2,
        ),
      )
      const paths = (w.data || []).map((i: { image_path: string }) => i.image_path)
      const urls = await getSignedUrls(paths)
      let done = 0
      for (const path of paths) {
        const res = await fetch(urls[path])
        if (res.ok) zip.file(`photos/${path.split('/').pop()}`, await res.blob())
        done++
        setMsg(`Adding photos… ${done} of ${paths.length}`)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `outfit-planner-export-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10000)
      setMsg('')
      toast('Download ready')
    } catch (e) {
      setError((e as Error).message)
      setMsg('')
    } finally {
      setBusy('')
    }
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: 'Delete your account?',
      message: 'This permanently deletes your account, all profiles, photos, trips and looks.',
      confirmText: 'Delete my account',
      danger: true,
      typeToConfirm: 'DELETE',
    })
    if (!ok) return
    setBusy('delete')
    setError('')
    try {
      await apiFetch('/api/account/delete', { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) })
      await supabase().auth.signOut({ scope: 'local' })
      removeAllKeys()
      router.replace('/login')
    } catch (e) {
      setError((e as Error).message)
      setBusy('')
    }
  }

  async function logout() {
    lockAllKeys()
    await supabase().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="wrap">
      <header className="topbar">
        <Link href="/" className="back"><Icon name="left" /> Back</Link>
        <button className="btn small" onClick={logout}><Icon name="logout" /> Log out</button>
      </header>
      <main className="page-enter">
      <div className="page-title">
        <h1>Account</h1>
        <p className="muted">{session?.user.email}</p>
      </div>
      <div className="stack" style={{ ['--gap' as string]: '1.2rem', maxWidth: 560 }}>
        {msg && <p className="alert" role="status">{msg}</p>}
        {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}

        <form className="card stack" onSubmit={changePassword}>
          <h3>Change password</h3>
          <label className="field">
            <span>New password</span>
            <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" />
          </label>
          <div><button className="btn" disabled={!!busy}>Change password</button></div>
        </form>

        <div className="card stack">
          <h3>AI features</h3>
          <p className="muted small">Choose which AI to use, add keys, or turn AI off completely on this device.</p>
          <div><Link className="btn ai" href="/settings/ai"><Icon name="sparkle" /> AI settings</Link></div>
        </div>

        <div className="card stack">
          <h3>Download my data</h3>
          <p className="muted small">A zip file with all your profiles, trips, looks and wardrobe photos. Good to do once a month as a backup.</p>
          <div><button className="btn" onClick={exportData} disabled={!!busy}>{busy === 'export' ? 'Preparing…' : 'Download my data'}</button></div>
        </div>

        <div className="card stack">
          <h3>Delete my account</h3>
          <p className="muted small">Permanently removes everything. This can’t be undone.</p>
          <div><button className="btn danger" onClick={deleteAccount} disabled={!!busy}>Delete my account</button></div>
        </div>

        <div className="card stack">
          <h3>Your privacy</h3>
          <p className="muted small">
            Your photos and plans are private to your account. Background removal runs on your own device. The app owner runs
            the database, so they can technically see stored data from the Supabase dashboard, though not through the app.
          </p>
        </div>
      </div>
      </main>
    </div>
  )
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  )
}
