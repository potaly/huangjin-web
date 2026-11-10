// POST /api/mall/orders { items:[{skuId,qty}], remark, clientToken } — 客户下单
// GET  /api/mall/orders?status=                                      — 我的订单
import { handle, ok, readJson } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { orderView, placeOrder, visibleOrders, type PlaceOrderInput } from '@/lib/order-service'
import { notifyNewOrder, orderNotifyTargets } from '@/lib/order-notify'
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
    const { order, targets } = await mutate((db) => {
      const user = requireMallUser(db, ['CUSTOMER'])
      const before = db.order.length
      const order = placeOrder(db, user, input)
      // 重复提交返回的是旧单，不再通知
      const created = db.order.length > before
      return { order, targets: created ? orderNotifyTargets(db, order) : [] }
    })
    await notifyNewOrder(order, targets)
    const view = orderView(order)
    return ok(view, '订单已提交')
  })
}
