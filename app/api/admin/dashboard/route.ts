// GET /api/admin/dashboard — 统计卡片与库存预警
import { handle, ok, requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { dashboardData } from '@/lib/manage-query'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('dashboard')
    const db = await loadDB()
    return ok(dashboardData(db))
  })
}
