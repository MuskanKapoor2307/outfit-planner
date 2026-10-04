'use client'
import { useSyncExternalStore } from 'react'

// Work that carries on after a sheet closes (e.g. saving a photo), so the person isn't kept waiting.
// While anything is running we warn before the page is closed or reloaded.

let running: string[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

export function runInBackground(label: string, task: () => Promise<void>) {
  running = [...running, label]
  if (running.length === 1) window.addEventListener('beforeunload', onBeforeUnload)
  emit()
  task()
    .catch((e) => console.error('Background task failed', e))
    .finally(() => {
      const i = running.indexOf(label)
      running = running.filter((_, j) => j !== i)
      if (!running.length) window.removeEventListener('beforeunload', onBeforeUnload)
      emit()
    })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const empty: string[] = []

/** Labels of the jobs still running. */
export function useBackgroundJobs() {
  return useSyncExternalStore(subscribe, () => running, () => empty)
}
