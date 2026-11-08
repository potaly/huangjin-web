// GET /api/admin/stock-logs/export — 导出库存流水（CSV，Excel 可直接打开）
import { requireAdmin } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { filterLogs, stockLogsCsv, stockLogsFilename } from '@/lib/stock-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    requireAdmin('stock')
  } catch {
    return new Response('未登录或无权限', { status: 401 })
  }

  const db = await loadDB()
  const rows = filterLogs(db.stockLog, new URL(req.url))

  return new Response(stockLogsCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stockLogsFilename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
