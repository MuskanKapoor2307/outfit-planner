import { supabaseAdmin, requireAdmin, jsonError, HttpError, appUrl } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: Request) {
  try {
    const me = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.')

    const sb = supabaseAdmin()
    const { data: list, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listErr) throw listErr
    const existing = list.users.find((u) => u.email?.toLowerCase() === email)

    if (existing?.email_confirmed_at) {
      throw new HttpError(409, 'This person already has an account. Use “Reset link” if they forgot their password.')
    }
    if (existing) {
      // Pending invite: replace it with a fresh one (the old link stops working).
      const { error } = await sb.auth.admin.deleteUser(existing.id)
      if (error) throw error
    } else {
      const max = Number(process.env.MAX_USERS || 15)
      if (list.users.length >= max) {
        throw new HttpError(409, `The app is full (${max} accounts). Remove someone or raise MAX_USERS.`)
      }
    }

    const { data, error } = await sb.auth.admin.generateLink({ type: 'invite', email })
    if (error) throw error
    const tokenHash = data.properties?.hashed_token
    if (!tokenHash || !data.user) throw new Error('No invite token returned')

    await sb.from('invites').upsert(
      { email, user_id: data.user.id, invited_by: me.id, last_link_at: new Date().toISOString() },
      { onConflict: 'email' },
    )

    const link = `${appUrl()}/welcome?type=invite&token_hash=${encodeURIComponent(tokenHash)}`
    return Response.json({ link, email })
  } catch (e) {
    return jsonError(e)
  }
}
