// GET /api/mall/manage/orders/{id} — 查看即标记已读，消除红点
import { handle, ok, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { findVisibleOrder, orderView } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER', 'SALES'])
      const o = findVisibleOrder(db, actor, id)
      o.seenBySales = true
      return orderView(o)
    })
    return ok(view)
  })
}
