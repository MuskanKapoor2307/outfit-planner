'use client'
import { GEMINI_FALLBACK_MODEL, countRequest, type KeyProvider } from './settings'

export interface AiImage {
  mime: string
  base64: string
}

export class AiError extends Error {
  constructor(message: string, public code: 'key' | 'quota' | 'network' | 'model' | 'other') {
    super(message)
  }
}

async function readError(res: Response) {
  try {
    const j = await res.json()
    return j?.error?.message || j?.message || JSON.stringify(j).slice(0, 200)
  } catch {
    return res.statusText
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown, who: string) {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  } catch {
    throw new AiError(`Couldn’t reach ${who}. Check your internet connection.`, 'network')
  }
  if (res.ok) return res.json()
  const detail = await readError(res)
  if (res.status === 401 || res.status === 403 || /api key/i.test(detail)) throw new AiError(`${who} rejected the API key. Check it in AI settings.`, 'key')
  if (res.status === 429) throw new AiError(`${who} limit reached for now.`, 'quota')
  if (res.status === 404 || /model/i.test(detail)) throw new AiError(`${who} doesn’t recognise the model name. Change it in AI settings. (${detail})`, 'model')
  throw new AiError(`${who} error: ${detail}`, 'other')
}

async function gemini(key: string, model: string, system: string, text: string, images: AiImage[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text }, ...images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } }))] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
  }
  // key goes in a header, never in the URL
  const j = await post(url, { 'x-goog-api-key': key }, body, 'Gemini')
  const parts = j?.candidates?.[0]?.content?.parts || []
  return parts.map((p: { text?: string }) => p.text || '').join('')
}

async function claude(key: string, model: string, system: string, text: string, images: AiImage[]) {
  const body = {
    model,
    max_tokens: 3000, // room for 2-3 outfit options
    system,
    messages: [{
      role: 'user',
      content: [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.base64 } })),
        { type: 'text', text },
      ],
    }],
  }
  const j = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body,
    'Claude',
  )
  return (j?.content || []).map((c: { type: string; text?: string }) => (c.type === 'text' ? c.text : '')).join('')
}

async function openai(key: string, model: string, system: string, text: string, images: AiImage[]) {
  const body = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: [{ type: 'text', text }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } }))] },
    ],
  }
  const j = await post('https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${key}` }, body, 'OpenAI')
  return j?.choices?.[0]?.message?.content || ''
}

export async function callProvider(
  p: KeyProvider,
  key: string,
  model: string,
  system: string,
  text: string,
  images: AiImage[],
): Promise<{ text: string; model: string }> {
  countRequest(p)
  if (p === 'gemini') {
    try {
      return { text: await gemini(key, model, system, text, images), model }
    } catch (e) {
      // free limit for the main model used up: try the lighter model once
      if (e instanceof AiError && e.code === 'quota' && model !== GEMINI_FALLBACK_MODEL) {
        countRequest(p)
        return { text: await gemini(key, GEMINI_FALLBACK_MODEL, system, text, images), model: GEMINI_FALLBACK_MODEL }
      }
      throw e
    }
  }
  if (p === 'claude') return { text: await claude(key, model, system, text, images), model }
  return { text: await openai(key, model, system, text, images), model }
}
