// POST /api/mall/orders { items:[{skuId,qty}], remark, clientToken } — 客户下单
// GET  /api/mall/orders?status=                                      — 我的订单
import { handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { orderView, placeOrder, visibleOrders, type PlaceOrderInput } from '@/lib/order-service'
import type { OrderStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const user = requireMallUser(db, ['CUSTOMER'])
    const s = new URL(req.url).searchParams.get('status') as OrderStatus | null
    return ok(visibleOrders(db, user, s && STATUSES.includes(s) ? s : undefined).map(orderView))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson<PlaceOrderInput>(req)
    const view = await mutate((db) => {
      const user = requireMallUser(db, ['CUSTOMER'])
      return orderView(placeOrder(db, user, input))
    })
    return ok(view, '订单已提交')
  })
}
