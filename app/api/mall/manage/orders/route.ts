// GET /api/mall/manage/orders?status= — 老板看全部，业务员看自己客户的单
import { handle, ok } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { orderView, visibleOrders } from '@/lib/order-service'
import type { OrderStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const s = new URL(req.url).searchParams.get('status') as OrderStatus | null
    return ok(visibleOrders(db, actor, s && STATUSES.includes(s) ? s : undefined).map(orderView))
  })
}
