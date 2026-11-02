// POST /api/admin/stocks/out — 出库
import { stockOpHandler } from '@/lib/stock-handler'

export const dynamic = 'force-dynamic'
export const POST = stockOpHandler('OUT')
