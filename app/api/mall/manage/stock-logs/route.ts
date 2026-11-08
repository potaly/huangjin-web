// GET /api/mall/manage/stock-logs — 库存流水分页
import { handle, ok, pageParams, paginate } from '@/lib/api'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'
import { filterLogs } from '@/lib/stock-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    return ok(paginate(filterLogs(db.stockLog, url), pageNum, pageSize))
  })
}
