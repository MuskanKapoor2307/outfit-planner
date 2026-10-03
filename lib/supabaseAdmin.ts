import 'server-only'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

/**
 * SERVER ONLY. Uses the secret service key, which bypasses Row Level Security.
 * 'server-only' makes the build fail if this file is ever imported into browser code.
 */
let admin: SupabaseClient | null = null
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Server is missing Supabase settings')
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return admin
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/** Reads the "Authorization: Bearer <token>" header and returns the logged-in user. */
export async function requireUser(req: Request): Promise<User> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) throw new HttpError(401, 'Please log in again.')
  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Please log in again.')
  return data.user
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from('app_admins').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function requireAdmin(req: Request): Promise<User> {
  const user = await requireUser(req)
  if (!(await isAdmin(user.id))) throw new HttpError(403, 'Only the admin can do this.')
  return user
}

/** Removes every photo in a user's folder, then the user (their rows are deleted automatically). */
export async function deleteUserCompletely(userId: string) {
  const sb = supabaseAdmin()
  for (let i = 0; i < 50; i++) {
    const { data: files, error } = await sb.storage.from('wardrobe').list(userId, { limit: 100 })
    if (error) throw error
    if (!files || files.length === 0) break
    const { error: rmErr } = await sb.storage.from('wardrobe').remove(files.map((f) => `${userId}/${f.name}`))
    if (rmErr) throw rmErr
  }
  const { error } = await sb.auth.admin.deleteUser(userId)
  if (error) throw error
}

export function jsonError(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status })
  console.error(e)
  return Response.json({ error: 'Something went wrong on the server.' }, { status: 500 })
}

export function appUrl() {
  const u = process.env.APP_URL
  if (!u) throw new Error('APP_URL is not set')
  return u.replace(/\/$/, '')
}
