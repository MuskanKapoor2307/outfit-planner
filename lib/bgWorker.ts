// Runs the on-device background remover off the main thread, so the screen stays responsive.
// Messages in:  { id, type: 'preload', model } | { id, type: 'remove', model, image: Blob }
// Messages out: { id, ok: true, blob? } | { id, ok: false, error } | { id, progress: { key, current, total } }
import { preload, removeBackground } from '@imgly/background-removal'

type Model = 'isnet_fp16' | 'isnet_quint8'
type In = { id: number; type: 'preload'; model: Model } | { id: number; type: 'remove'; model: Model; image: Blob }

const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((e: MessageEvent<In>) => void) | null }

ctx.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data
  const progress = (key: string, current: number, total: number) => ctx.postMessage({ id: msg.id, progress: { key, current, total } })
  try {
    if (msg.type === 'preload') {
      await preload({ model: msg.model, progress })
      ctx.postMessage({ id: msg.id, ok: true })
    } else {
      const blob = await removeBackground(msg.image, { model: msg.model, output: { format: 'image/png' }, progress })
      ctx.postMessage({ id: msg.id, ok: true, blob })
    }
  } catch (err) {
    ctx.postMessage({ id: msg.id, ok: false, error: String((err as Error)?.message || err) })
  }
}
