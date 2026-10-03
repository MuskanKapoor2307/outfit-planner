'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  isAdmin: boolean
}

const AuthCtx = createContext<AuthState>({ session: null, loading: true, isAdmin: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, isAdmin: false })

  useEffect(() => {
    let alive = true
    const sb = supabase()
    async function load(session: Session | null) {
      let admin = false
      if (session) {
        const { data } = await sb.from('app_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
        admin = !!data
      }
      if (alive) setState({ session, loading: false, isAdmin: admin })
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
  const { session, loading, isAdmin } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!session) router.replace('/login')
    else if (admin && !isAdmin) router.replace('/')
  }, [loading, session, isAdmin, admin, router])

  if (loading || !session || (admin && !isAdmin)) {
    return (
      <div className="page-center" aria-busy="true">
        <p className="muted">Loading…</p>
      </div>
    )
  }
  return <>{children}</>
}
