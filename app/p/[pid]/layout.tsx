'use client'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { RequireAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { ProfileCtx } from '@/lib/profile'
import ThemeScope from '@/components/ThemeScope'
import Icon from '@/components/Icon'
import type { StyleProfile } from '@/lib/types'

function ProfileShell({ children }: { children: ReactNode }) {
  const { pid } = useParams<{ pid: string }>()
  const pathname = usePathname()
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [missing, setMissing] = useState(false)

  const reload = useCallback(async () => {
    const { data } = await supabase().from('style_profiles').select('*').eq('id', pid).maybeSingle()
    if (data) setProfile(data as StyleProfile)
    else setMissing(true)
  }, [pid])

  useEffect(() => {
    reload()
  }, [reload])

  if (missing)
    return (
      <div className="page-center">
        <div className="empty-state">
          <h2>Profile not found</h2>
          <Link className="btn primary" href="/">Back to profiles</Link>
        </div>
      </div>
    )
  if (!profile)
    return (
      <div className="wrap" style={{ paddingTop: '1.2rem' }}>
        <div className="skel" style={{ height: 44, width: 180, marginBottom: 28 }} />
        <div className="skel" style={{ height: 56, width: '60%', marginBottom: 20 }} />
        <div className="skel" style={{ height: 180 }} />
      </div>
    )

  const base = `/p/${profile.id}`
  const tabs = [
    { href: base, label: 'Trips', icon: 'suitcase', active: pathname === base || pathname.startsWith(`${base}/trip`) },
    { href: `${base}/wardrobe`, label: 'Wardrobe', icon: 'hanger', active: pathname.startsWith(`${base}/wardrobe`) },
    { href: `${base}/style`, label: 'Profile', icon: 'user', active: pathname.startsWith(`${base}/style`) },
  ]

  return (
    <ProfileCtx.Provider value={{ profile, reload }}>
      <ThemeScope theme={profile.theme} />
      <div className="wrap">
        <header className="topbar">
          <Link href={base} className="who">
            <span className="avatar" aria-hidden>{profile.emoji || '🌸'}</span>
            <strong>{profile.name}</strong>
          </Link>
          <Link href="/" className="btn ghost small">Switch profile</Link>
        </header>
        <nav className="tabs" aria-label="Sections">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.active ? 'page' : undefined}>
              <Icon name={t.icon} />
              {t.label}
            </Link>
          ))}
        </nav>
        <main key={pathname} className="page-enter">{children}</main>
      </div>
    </ProfileCtx.Provider>
  )
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ProfileShell>{children}</ProfileShell>
    </RequireAuth>
  )
}
