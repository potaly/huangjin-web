// GET /api/mall/manage/dashboard — 工作台统计
import { handle, ok } from '@/lib/api'
import { dashboardData, stockRows, stockSummary } from '@/lib/manage-query'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    const { storageDriver: _driver, ...data } = dashboardData(db)
    return ok({ ...data, warnCount: stockSummary(stockRows(db, {})).warnCount })
  })
}
