// POST /api/admin/stocks/in — 入库
import { stockOpHandler } from '@/lib/stock-handler'

export const dynamic = 'force-dynamic'
export const POST = stockOpHandler('IN')
