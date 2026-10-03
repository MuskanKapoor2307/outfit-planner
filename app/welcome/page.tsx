'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AuthArt from '@/components/AuthArt'
import PasswordInput from '@/components/PasswordInput'
import Icon from '@/components/Icon'

/**
 * Invite and password-reset links land here.
 * The one-time code is only used when the person taps the button, so link
 * previews in WhatsApp or email can't use it up by "visiting" the link.
 */
function Welcome() {
  const params = useSearchParams()
  const router = useRouter()
  const [tokenHash] = useState(() => params.get('token_hash') || '')
  const [type] = useState(() => (params.get('type') === 'recovery' ? 'recovery' : 'invite'))
  const [step, setStep] = useState<'accept' | 'password'>('accept')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (tokenHash) window.history.replaceState(null, '', '/welcome')
  }, [tokenHash])

  async function accept() {
    setBusy(true)
    setError('')
    await supabase().auth.signOut({ scope: 'local' })
    const { error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type })
    setBusy(false)
    if (error) return setError('This link has expired or was already used. Ask for a new one.')
    setStep('password')
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 10) return setError('Use at least 10 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    setError('')
    const { error } = await supabase().auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    router.replace('/')
  }

  const strength = password.length >= 16 ? 3 : password.length >= 12 ? 2 : password.length >= 10 ? 1 : 0

  return (
    <div className="auth-form">
      {!tokenHash && step === 'accept' ? (
        <div className="panel">
          <h2>Link incomplete</h2>
          <p className="muted">Open the full link you were sent, or ask for a new one.</p>
        </div>
      ) : step === 'accept' ? (
        <div className="panel">
          <h2>{type === 'invite' ? 'You’re invited' : 'Reset your password'}</h2>
          <p className="muted">{type === 'invite' ? 'Accept the invite, then choose a password to finish setting up.' : 'Continue to choose a new password.'}</p>
          {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
          <button className="btn primary block" onClick={accept} disabled={busy}>
            {busy ? <><span className="spinner" aria-hidden /> Checking</> : type === 'invite' ? 'Accept invite' : 'Continue'}
          </button>
        </div>
      ) : (
        <form onSubmit={savePassword}>
          <h2>Choose a password</h2>
          <label className="field">
            <span>New password</span>
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" required minLength={10} autoFocus />
            <div className="progress" aria-hidden><i style={{ width: `${(strength / 3) * 100}%` }} /></div>
            <small>At least 10 characters. A short sentence works well, like “goa trip in december”.</small>
          </label>
          <label className="field">
            <span>Type it again</span>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" required />
          </label>
          {error && <p className="alert error" role="alert"><Icon name="alert" /> {error}</p>}
          <button className="btn primary block" disabled={busy}>
            {busy ? <><span className="spinner" aria-hidden /> Saving</> : 'Save password'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function WelcomePage() {
  return (
    <main className="auth" data-theme="studio">
      <AuthArt accent="welcome to your" title="style book" text="Set up your account in a few seconds." />
      <Suspense fallback={<div className="auth-form"><p className="muted">Loading…</p></div>}>
        <Welcome />
      </Suspense>
    </main>
  )
}
