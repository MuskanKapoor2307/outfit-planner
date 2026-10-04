'use client'
import { useBackgroundJobs } from '@/lib/backgroundJobs'

/** Small "Saving…" note while photos finish saving in the background. */
export default function SavingPill() {
  const jobs = useBackgroundJobs()
  if (!jobs.length) return null
  return (
    <div className="saving-pill" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      {jobs.length === 1 ? `Saving ${jobs[0]}…` : `Saving ${jobs.length} pieces…`}
    </div>
  )
}
