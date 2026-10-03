'use client'
import type { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth'
import { FeedbackProvider } from './Feedback'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FeedbackProvider>{children}</FeedbackProvider>
    </AuthProvider>
  )
}
