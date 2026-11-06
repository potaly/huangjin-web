// GET /api/mall/auth/me — 当前登录用户（含绑定业务员）
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { userView } from '@/lib/mall-user-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    const user = requireMallUser(db)
    return ok(userView(db, user))
  })
}
