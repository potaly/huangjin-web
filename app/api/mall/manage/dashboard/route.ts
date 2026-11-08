// GET /api/mall/manage/dashboard — 工作台统计
import { handle, ok } from '@/lib/api'
import { dashboardData } from '@/lib/manage-query'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    return ok(dashboardData(db))
  })
}
