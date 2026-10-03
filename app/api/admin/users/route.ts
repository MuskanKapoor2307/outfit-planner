import { supabaseAdmin, requireAdmin, jsonError, HttpError, deleteUserCompletely, isAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await requireAdmin(req)
    const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw error
    const { data: admins } = await supabaseAdmin().from('app_admins').select('user_id')
    const adminIds = new Set((admins || []).map((a) => a.user_id))
    const users = data.users
      .map((u) => ({
        id: u.id,
        email: u.email,
        status: u.email_confirmed_at ? 'active' : 'pending',
        isAdmin: adminIds.has(u.id),
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    return Response.json({ users, maxUsers: Number(process.env.MAX_USERS || 15) })
  } catch (e) {
    return jsonError(e)
  }
}

/** Cancel a pending invite, or remove someone completely (photos included). */
export async function DELETE(req: Request) {
  try {
    const me = await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id') || ''
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Invalid user.')
    if (id === me.id) throw new HttpError(400, 'To delete your own account, use the Account page.')
    if (await isAdmin(id)) throw new HttpError(400, 'Admins can’t be removed from here.')
    await deleteUserCompletely(id)
    return Response.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}
