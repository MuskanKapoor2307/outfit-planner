'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RequireAuth, useAuth } from '@/lib/auth'
import { apiFetch } from '@/lib/supabase'
import { useFeedback } from '@/components/Feedback'
import Icon from '@/components/Icon'

interface Row {
  id: string
  email: string
  status: 'active' | 'pending'
  isAdmin: boolean
  createdAt: string
  lastSignIn: string | null
}

function Admin() {
  const { session } = useAuth()
  const { confirm, toast } = useFeedback()
  const [users, setUsers] = useState<Row[] | null>(null)
  const [max, setMax] = useState(15)
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<{ url: string; label: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/admin/users')
      setUsers(r.users)
      setMax(r.maxUsers)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    setCopied(false)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sendInvite = (to: string) =>
    run(async () => {
      const r = await apiFetch('/api/admin/invite', { method: 'POST', body: JSON.stringify({ email: to }) })
      setLink({ url: r.link, label: `Invite link for ${r.email}` })
      setEmail('')
      await load()
    })
  const invite = (e: React.FormEvent) => {
    e.preventDefault()
    sendInvite(email)
  }
  const reset = (u: Row) =>
    run(async () => {
      const r = await apiFetch('/api/admin/reset', { method: 'POST', body: JSON.stringify({ userId: u.id }) })
      setLink({ url: r.link, label: `Password reset link for ${r.email}` })
    })
  const removeUser = async (u: Row) => {
    const ok = await confirm(
      u.status === 'pending'
        ? { title: `Cancel the invite for ${u.email}?`, message: 'The link stops working.', confirmText: 'Cancel invite', danger: true }
        : { title: `Remove ${u.email}?`, message: 'This permanently deletes their account, photos, trips and looks.', confirmText: 'Remove', danger: true, typeToConfirm: 'REMOVE' },
    )
    if (!ok) return
    run(async () => {
      await apiFetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' })
      setLink(null)
      toast('Done')
      await load()
    })
  }

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    toast('Link copied')
  }

  const waText = link ? encodeURIComponent(`Here's your invite to my Outfit Planner. The link works once: ${link.url}`) : ''

  return (
    <div className="wrap">
      <div className="sheet-page">
      <header className="topbar">
        <Link href="/" className="back"><Icon name="left" /> Back</Link>
      </header>
      <div className="page-title">
        <h1>Invites</h1>
        <p className="meter">{users ? `${users.length} of ${max} accounts used` : ' '}</p>
      </div>

      <div className="stack" style={{ ['--gap' as string]: '1.5rem' }}>
        <form className="card stack" onSubmit={invite}>
          <h3>Invite someone</h3>
          <label className="field">
            <span>Their email</span>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
          </label>
          <div><button className="btn primary" disabled={busy}>Create invite link</button></div>
          <p className="muted small">
            You’ll get a one-time link to send them yourself (for example on WhatsApp). It expires after the time set in Supabase (24 hours at most).
          </p>
        </form>

        {link && (
          <div className="card stack" aria-live="polite">
            <h3>{link.label}</h3>
            <div className="linkbox">
              <input className="input" readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Link" />
              <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className="row">
              <a className="btn small" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
            </div>
            <p className="muted small">Only send this to the person it’s for. Anyone with the link can use it once.</p>
          </div>
        )}

        {error && <p className="alert error" role="alert">{error}</p>}

        <div className="stack">
          <h3>People</h3>
          {!users && <p className="muted">Loading…</p>}
          <div className="list">
            {users?.map((u) => (
              <div key={u.id} className="list-row">
                <div>
                  <strong>{u.email}</strong>
                  <div className="row small muted">
                    <span className={`badge ${u.status === 'active' ? 'ok' : ''}`}>{u.status === 'active' ? 'Active' : 'Invite sent'}</span>
                    {u.isAdmin && <span className="badge">Admin</span>}
                    {u.lastSignIn && <span>Last login {new Date(u.lastSignIn).toLocaleDateString('en-IN')}</span>}
                  </div>
                </div>
                {u.id !== session?.user.id && !u.isAdmin && (
                  <div className="row">
                    {u.status === 'active' ? (
                      <button className="btn small" onClick={() => reset(u)} disabled={busy}>Reset link</button>
                    ) : (
                      <button className="btn small" onClick={() => sendInvite(u.email)} disabled={busy}>New link</button>
                    )}
                    <button className="btn small danger" onClick={() => removeUser(u)} disabled={busy}>
                      {u.status === 'pending' ? 'Cancel invite' : 'Remove'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <Admin />
    </RequireAuth>
  )
}
