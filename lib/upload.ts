'use client'
import { supabase } from './supabase'

/**
 * Uploads a photo to a private bucket. If the first try fails (often a login that went stale
 * while the phone was busy removing the background), refresh the login and try once more.
 */
export async function uploadPhoto(bucket: 'wardrobe' | 'people', path: string, blob: Blob) {
  const sb = supabase()
  const opts = { contentType: blob.type, upsert: false }
  let res = await sb.storage.from(bucket).upload(path, blob, opts)
  if (!res.error) return
  await sb.auth.refreshSession()
  res = await sb.storage.from(bucket).upload(path, blob, opts)
  // the first try may have worked even though its answer got lost
  if (res.error && !/exist/i.test(res.error.message)) throw res.error
}
