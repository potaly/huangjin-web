// GET /api/mall/orders/{id} — 客户查看自己的订单
import { handle, ok, requireId } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { findVisibleOrder, orderView } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    const user = requireMallUser(db, ['CUSTOMER'])
    return ok(orderView(findVisibleOrder(db, user, id)))
  })
}
