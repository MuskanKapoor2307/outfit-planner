'use client'

export type Progress = (message: string, fraction?: number) => void

const MAX_INPUT = 1280 // px — size sent to the background remover (it works at ~1024 internally)
const MAX_OUTPUT = 1024 // px — size we store

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    // honours the phone's rotation flag
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This file can’t be opened as a photo. Try a JPG, PNG or WebP image (or a screenshot).')
  }
}

function canvasFor(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Your browser could not process the photo.')
  return { c, ctx }
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo.'))), type, quality),
  )
}

/** Shrinks the photo. Redrawing on a canvas also drops hidden data such as GPS location. */
async function downscale(file: Blob, max: number): Promise<HTMLCanvasElement> {
  const bmp = await loadBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const { c, ctx } = canvasFor(bmp.width * scale, bmp.height * scale)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c
}

/** Crops away empty transparent space around the cut-out. */
function trimTransparent(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const { width, height } = src
  const data = ctx.getImageData(0, 0, width, height).data
  let top = height, left = width, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return src // nothing visible: keep as is
  const pad = Math.round(Math.max(width, height) * 0.02)
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  right = Math.min(width - 1, right + pad)
  bottom = Math.min(height - 1, bottom + pad)
  const { c, ctx: out } = canvasFor(right - left + 1, bottom - top + 1)
  out.drawImage(src, left, top, c.width, c.height, 0, 0, c.width, c.height)
  return c
}

const NAMED_COLOURS: [string, number, number, number][] = [
  ['Black', 20, 20, 20], ['White', 245, 245, 242], ['Grey', 140, 140, 140], ['Beige', 222, 202, 170],
  ['Brown', 120, 80, 50], ['Red', 200, 35, 45], ['Maroon', 120, 25, 40], ['Pink', 240, 150, 180],
  ['Hot pink', 230, 50, 130], ['Orange', 240, 130, 40], ['Mustard', 210, 165, 40], ['Yellow', 245, 220, 70],
  ['Olive', 120, 125, 50], ['Green', 50, 140, 70], ['Mint', 160, 220, 190], ['Teal', 30, 130, 130],
  ['Sky blue', 135, 195, 235], ['Blue', 40, 90, 200], ['Navy', 25, 35, 80], ['Lavender', 190, 170, 225],
  ['Purple', 110, 50, 140], ['Gold', 200, 165, 80], ['Silver', 192, 192, 196],
]

/** Rough main colour of the visible pixels, as a friendly name. */
function guessColour(c: HTMLCanvasElement): string | null {
  const s = Math.min(1, 64 / Math.max(c.width, c.height))
  const { c: small, ctx } = canvasFor(c.width * s, c.height * s)
  ctx.drawImage(c, 0, 0, small.width, small.height)
  const d = ctx.getImageData(0, 0, small.width, small.height).data
  const buckets = new Map<string, number>()
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue
    let best = '', bestDist = Infinity
    for (const [name, r, g, b] of NAMED_COLOURS) {
      const dist = (d[i] - r) ** 2 * 0.3 + (d[i + 1] - g) ** 2 * 0.59 + (d[i + 2] - b) ** 2 * 0.11
      if (dist < bestDist) { bestDist = dist; best = name }
    }
    buckets.set(best, (buckets.get(best) || 0) + 1)
  }
  let top: string | null = null, n = 0
  for (const [k, v] of buckets) if (v > n) { n = v; top = k }
  return top
}

type Model = 'isnet_fp16' | 'isnet_quint8'
type ProgressFn = (key: string, current: number, total: number) => void

// The first model is the normal one; the fallback is a smaller download that needs less memory.
// They are different settings, so a failed first start-up is not reused by the library's cache.
// On phones the smaller model goes first: it's much lighter to run (less heat and battery) and the
// cut-outs look nearly the same. Computers start with the sharper one.
const isPhone = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const MODELS: readonly Model[] = isPhone ? ['isnet_quint8', 'isnet_fp16'] : ['isnet_fp16', 'isnet_quint8']

// The remover holds a large model in memory. Shut it down when it hasn't been used for a while,
// so the phone can free that memory and cool down.
const IDLE_MS = 90_000
let idleTimer: ReturnType<typeof setTimeout> | undefined
function scheduleIdleShutdown() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (pending.size || !worker) return
    worker.terminate()
    worker = null
    warmUp = null
  }, IDLE_MS)
}

/* ---------- background remover, run in a Web Worker (keeps the screen responsive) ---------- */

let worker: Worker | null = null
let workerBroken = false
let nextId = 1
const pending = new Map<number, { resolve: (b: Blob | undefined) => void; reject: (e: Error) => void; progress?: ProgressFn }>()

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./bgWorker.ts', import.meta.url), { type: 'module' })
  } catch (e) {
    console.warn('Background worker unavailable, using the main thread', e)
    workerBroken = true
    return null
  }
  worker.onmessage = (e: MessageEvent<{ id: number; ok?: boolean; blob?: Blob; error?: string; progress?: { key: string; current: number; total: number } }>) => {
    const m = e.data
    const job = pending.get(m.id)
    if (!job) return
    if (m.progress) return job.progress?.(m.progress.key, m.progress.current, m.progress.total)
    pending.delete(m.id)
    if (!pending.size) scheduleIdleShutdown()
    if (m.ok) job.resolve(m.blob)
    else job.reject(new Error(m.error || 'Background removal failed'))
  }
  worker.onerror = (e) => {
    // the worker itself could not start or crashed: fail its jobs and use the main thread from now on
    console.warn('Background worker failed', e)
    workerBroken = true
    worker?.terminate()
    worker = null
    for (const [, job] of pending) job.reject(new Error('worker-crashed'))
    pending.clear()
  }
  return worker
}

function inWorker(w: Worker, msg: { type: 'preload'; model: Model } | { type: 'remove'; model: Model; image: Blob }, progress?: ProgressFn) {
  const id = nextId++
  return new Promise<Blob | undefined>((resolve, reject) => {
    pending.set(id, { resolve, reject, progress })
    w.postMessage({ id, ...msg })
  })
}

type Remover = typeof import('@imgly/background-removal')
let removerModule: Promise<Remover> | null = null
function loadRemover(): Promise<Remover> {
  if (!removerModule) {
    removerModule = import('@imgly/background-removal').catch((e) => {
      removerModule = null // let the next try load it again
      throw e
    })
  }
  return removerModule
}

/** Runs one removal: in the worker when possible, otherwise on the main thread. */
async function removeOnce(image: Blob, model: Model, progress: ProgressFn): Promise<Blob> {
  const w = getWorker()
  if (w) {
    try {
      const b = await inWorker(w, { type: 'remove', model, image }, progress)
      if (b) return b
    } catch (e) {
      if ((e as Error).message !== 'worker-crashed') throw e
    }
  }
  const mod = await loadRemover().catch(() => {
    throw new Error('The background remover could not load. Check your connection, or turn off “Remove background”.')
  })
  return mod.removeBackground(image, { model, output: { format: 'image/png' }, progress })
}

let warmUp: Promise<void> | null = null

/**
 * Starts downloading and starting the background remover in the background, so the first photo
 * doesn't have to wait for it (and isn't the one that fails if the phone is slow).
 */
export function preloadBackgroundRemover() {
  if (warmUp) return warmUp
  const w = getWorker()
  const run = w
    ? inWorker(w, { type: 'preload', model: MODELS[0] }).then(() => undefined)
    : loadRemover().then((m) => m.preload({ model: MODELS[0] }))
  warmUp = run.catch((e) => {
    console.warn('Background remover warm-up failed', e)
    warmUp = null
  })
  return warmUp
}

async function removeBackgroundWithRetry(input: Blob, onProgress?: Progress): Promise<Blob> {
  // if a warm-up is still running, let it finish rather than starting a second download
  if (warmUp) await warmUp
  const progress: ProgressFn = (key, current, total) => {
    if (key.startsWith('fetch')) onProgress?.('Downloading the background remover', total ? current / total : undefined)
    else onProgress?.('Removing the background', undefined)
  }
  let lastError: unknown
  for (const model of MODELS) {
    try {
      return await removeOnce(input, model, progress)
    } catch (e) {
      console.error('Background removal failed with', model, e)
      lastError = e
      if ((e as Error).message?.startsWith('The background remover could not load')) throw e
      onProgress?.('Trying again', undefined)
    }
  }
  console.error(lastError)
  throw new Error('Background removal failed on this device. You can save the photo without removing it.')
}

export interface PreparedImage {
  blob: Blob
  url: string
  colour: string | null
  extension: 'webp' | 'png' | 'jpg'
}

/**
 * Full pipeline: shrink → (optionally) remove background on this device → trim → resize → WebP.
 * The photo never leaves the device until the person taps Save.
 */
export async function prepareImage(file: Blob, removeBg: boolean, onProgress?: Progress): Promise<PreparedImage> {
  if (file.size > 25 * 1024 * 1024) throw new Error('That photo is over 25 MB. Please pick a smaller one.')
  onProgress?.('Getting the photo ready', 0)
  let canvas = await downscale(file, MAX_INPUT)

  if (removeBg) {
    onProgress?.('Loading the background remover (first time takes a minute)', 0)
    const input = await toBlob(canvas, 'image/png')
    const result = await removeBackgroundWithRetry(input, onProgress)
    const bmp = await loadBitmap(result)
    const { c, ctx } = canvasFor(bmp.width, bmp.height)
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    canvas = trimTransparent(c)
  }

  onProgress?.('Saving a smaller copy', 1)
  const scale = Math.min(1, MAX_OUTPUT / Math.max(canvas.width, canvas.height))
  const { c: out, ctx } = canvasFor(canvas.width * scale, canvas.height * scale)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, out.width, out.height)

  let blob = await toBlob(out, 'image/webp', 0.85)
  let extension: PreparedImage['extension'] = 'webp'
  if (blob.type !== 'image/webp') {
    // Some Safari versions can't make WebP; PNG keeps the transparent background.
    blob = await toBlob(out, 'image/png')
    extension = 'png'
  }
  if (blob.size > 2 * 1024 * 1024) {
    blob = await toBlob(out, 'image/jpeg', 0.82)
    extension = 'jpg'
  }
  return { blob, url: URL.createObjectURL(blob), colour: guessColour(out), extension }
}
