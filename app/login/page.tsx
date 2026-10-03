'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { friendlyError } from '@/lib/constants'
import AuthArt from '@/components/AuthArt'
import PasswordInput from '@/components/PasswordInput'
import Icon from '@/components/Icon'

export default function LoginPage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  useEffect(() => {
    if (!loading && session) router.replace('/')
  }, [loading, session, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      router.replace('/')
    } catch (err) {
      setError(friendlyError(err))
      setShakeKey((k) => k + 1)
      setBusy(false)
    }
  }

  return (
    <main className="auth" data-theme="studio">
      <AuthArt accent="pack the" title="perfect look" text="Your wardrobe, every trip day by day, and styling help whenever you want it." />
      <div className="auth-form">
        <form onSubmit={submit} key={shakeKey} className={shakeKey ? 'shake' : undefined} noValidate>
          <div className="stack" style={{ ['--gap' as string]: '0.4rem' }}>
            <h2>Welcome back</h2>
            <span className="lock"><Icon name="lock" /> Invite-only. Log in with the email you were invited with.</span>
          </div>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            <span>Password</span>
            <PasswordInput value={password} onChange={setPassword} required />
          </label>
          {error && (
            <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>
          )}
          <button className="btn primary block" disabled={busy || !email || !password}>
            {busy ? <><span className="spinner" aria-hidden /> Logging in</> : 'Log in'}
          </button>
          <p className="muted small">Forgot your password? Ask the person who invited you for a reset link.</p>
        </form>
      </div>
    </main>
  )
}
