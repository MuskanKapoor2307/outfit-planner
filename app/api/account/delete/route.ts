import { supabaseAdmin, requireUser, jsonError, HttpError, deleteUserCompletely, isAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/** Deletes the logged-in person's account, photos and plans. */
export async function POST(req: Request) {
  try {
    const me = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.')
    if (await isAdmin(me.id)) {
      const { count } = await supabaseAdmin().from('app_admins').select('user_id', { count: 'exact', head: true })
      if ((count ?? 0) <= 1) throw new HttpError(400, 'You are the only admin. Make someone else admin first, or delete the project in Supabase.')
    }
    await deleteUserCompletely(me.id)
    return Response.json({ ok: true })
  } catch (e) {
    return jsonError(e)
  }
}
