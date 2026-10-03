'use client'
import { createContext, useContext } from 'react'
import type { StyleProfile } from './types'

export const ProfileCtx = createContext<{ profile: StyleProfile; reload: () => void } | null>(null)

export function useProfile() {
  const v = useContext(ProfileCtx)
  if (!v) throw new Error('useProfile must be used inside a profile page')
  return v
}
