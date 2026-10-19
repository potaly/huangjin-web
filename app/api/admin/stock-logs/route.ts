// GET /api/admin/stock-logs — 库存流水分页
import { handle, ok, pageParams, paginate, requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { filterLogs } from '@/lib/stock-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('stock')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    return ok(paginate(filterLogs(db.stockLog, url), pageNum, pageSize))
  })
}
