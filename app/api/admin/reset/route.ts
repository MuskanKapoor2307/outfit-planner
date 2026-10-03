import { supabaseAdmin, requireAdmin, jsonError, HttpError, appUrl } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/** Creates a one-time "set a new password" link for someone who forgot theirs. */
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = String(body.userId || '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Invalid user.')

    const sb = supabaseAdmin()
    const { data: u, error: getErr } = await sb.auth.admin.getUserById(id)
    if (getErr || !u.user?.email) throw new HttpError(404, 'User not found.')
    if (!u.user.email_confirmed_at) throw new HttpError(400, 'This invite hasn’t been accepted yet. Send a new invite instead.')

    const { data, error } = await sb.auth.admin.generateLink({ type: 'recovery', email: u.user.email })
    if (error) throw error
    const tokenHash = data.properties?.hashed_token
    if (!tokenHash) throw new Error('No reset token returned')

    const link = `${appUrl()}/welcome?type=recovery&token_hash=${encodeURIComponent(tokenHash)}`
    return Response.json({ link, email: u.user.email })
  } catch (e) {
    return jsonError(e)
  }
}
