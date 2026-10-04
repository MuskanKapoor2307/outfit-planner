'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearSignedUrls } from './signedUrls'
import { clearCache } from './tabCache'

interface AuthState {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  /** false until we know whether this user is an admin (only admin pages wait for it) */
  adminKnown: boolean
}

const AuthCtx = createContext<AuthState>({ session: null, loading: true, isAdmin: false, adminKnown: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, isAdmin: false, adminKnown: false })

  useEffect(() => {
    let alive = true
    const sb = supabase()
    let adminFor: string | null = null // user id whose admin status we already know
    let admin = false
    async function load(session: Session | null) {
      if (!session) {
        adminFor = null
        admin = false
        clearSignedUrls()
        clearCache()
        if (alive) setState({ session: null, loading: false, isAdmin: false, adminKnown: true })
        return
      }
      const known = adminFor === session.user.id
      // show the page straight away; the admin check runs in the background
      if (alive) setState({ session, loading: false, isAdmin: known && admin, adminKnown: known })
      if (known) return
      const { data } = await sb.from('app_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
      adminFor = session.user.id
      admin = !!data
      if (alive) setState((s) => (s.session?.user.id === session.user.id ? { ...s, isAdmin: admin, adminKnown: true } : s))
    }
    sb.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      // defer so we don't call Supabase inside its own callback
      setTimeout(() => load(session), 0)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

/** Wrap any page that needs a logged-in user. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, isAdmin, adminKnown } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!session) router.replace('/login')
    else if (admin && adminKnown && !isAdmin) router.replace('/')
  }, [loading, session, isAdmin, adminKnown, admin, router])

  if (loading || !session || (admin && !isAdmin)) {
    return (
      <div className="wrap" style={{ paddingTop: '1.2rem' }} aria-busy="true">
        <div className="skel" style={{ height: 44, width: 180, marginBottom: 28 }} />
        <div className="skel" style={{ height: 180 }} />
      </div>
    )
  }
  return <>{children}</>
}
