// GET /api/admin/stocks — SKU 库存总览（总克数 / 预占 / 可售）
import { handle, ok, pageParams, paginate, requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { stockFilterFromUrl, stockRows, stockSummary } from '@/lib/manage-query'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('stock')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const rows = stockRows(db, stockFilterFromUrl(url))
    return ok({ ...paginate(rows, pageNum, pageSize), summary: stockSummary(rows) })
  })
}
