// POST /api/admin/stocks/adjust — 盘点调整（传调整后的总克重）
import { stockOpHandler } from '@/lib/stock-handler'

export const dynamic = 'force-dynamic'
export const POST = stockOpHandler('ADJUST')
