// POST /api/mall/orders/{id}/cancel — 客户取消待确认的本人订单
import { handle, ok, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { changeOrderStatus, orderView } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const view = await mutate((db) => {
      const user = requireMallUser(db, ['CUSTOMER'])
      return orderView(changeOrderStatus(db, user, id, 'cancel'))
    })
    return ok(view, '订单已取消')
  })
}
