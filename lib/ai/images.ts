'use client'
import type { AiImage } from './providers'

/** Loads a stored photo and makes a small JPEG (white background) for the AI. */
export async function toAiImage(url: string, max = 768): Promise<{ ai: AiImage; blob: Blob }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not load a photo.')
  const bmp = await createImageBitmap(await res.blob())
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob: Blob = await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare a photo.'))), 'image/jpeg', 0.82))
  const base64 = c.toDataURL('image/jpeg', 0.82).split(',')[1]
  return { ai: { mime: 'image/jpeg', base64 }, blob }
}
