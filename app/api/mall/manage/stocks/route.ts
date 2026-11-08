// GET /api/mall/manage/stocks — SKU 库存总览
import { handle, ok, pageParams, paginate } from '@/lib/api'
import { stockFilterFromUrl, stockRows, stockSummary } from '@/lib/manage-query'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const rows = stockRows(db, stockFilterFromUrl(url))
    return ok({ ...paginate(rows, pageNum, pageSize), summary: stockSummary(rows) })
  })
}
