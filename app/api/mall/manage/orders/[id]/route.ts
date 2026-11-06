// GET /api/mall/manage/orders/{id} — 本单业务员查看即标记已读，消除红点
import { handle, ok, requireId } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { findVisibleOrder, markSeen, orderView, shouldMarkSeen } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    const actor = requireMallUser(db, ['OWNER', 'SALES'])
    const o = findVisibleOrder(db, actor, id)
    if (!shouldMarkSeen(o, actor)) return ok(orderView(o))
    const view = await mutate((fresh) => {
      const a = requireMallUser(fresh, ['OWNER', 'SALES'])
      const cur = findVisibleOrder(fresh, a, id)
      markSeen(cur, a)
      return orderView(cur)
    })
    return ok(view)
  })
}
