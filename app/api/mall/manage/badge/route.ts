// GET /api/mall/manage/badge — { pendingUnseen }，非管理角色返回 0
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { managerBadge } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    const actor = requireMallUser(db)
    return ok({ pendingUnseen: managerBadge(db, actor) })
  })
}
