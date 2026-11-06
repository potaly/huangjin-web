// POST /api/mall/manage/orders/{id}/{confirm|complete|cancel} { reason? }
import { bad, handle, ok, readJson, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { requireMallUser } from '@/lib/mall-auth'
import { changeOrderStatus, orderView, type OrderAction } from '@/lib/order-service'

export const dynamic = 'force-dynamic'
const ACTIONS: OrderAction[] = ['confirm', 'complete', 'cancel']
const DONE: Record<OrderAction, string> = { confirm: '已确认', complete: '已完成', cancel: '已取消' }

export async function POST(req: Request, { params }: { params: { id: string; action: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const action = params.action as OrderAction
    if (!ACTIONS.includes(action)) throw bad('不支持的操作')
    const body = action === 'cancel' ? await readJson<{ reason?: string }>(req) : {}
    const view = await mutate((db) => {
      const actor = requireMallUser(db, ['OWNER', 'SALES'])
      return orderView(changeOrderStatus(db, actor, id, action, body.reason))
    })
    return ok(view, DONE[action])
  })
}
