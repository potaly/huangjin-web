// PUT /api/mall/manage/products/{id}/status — 上架 / 下架
import { addLog, handle, ok, readJson, requireId, toStatus } from '@/lib/api'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { setProductStatus } from '@/lib/product-service'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const body = await readJson<{ status?: unknown }>(req)
    const status = toStatus(body.status, 0)
    await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      setProductStatus(db, id, status, actor)
      addLog(db, actor, {
        module: '商品', action: status === 1 ? '上架' : '下架',
        requestUri: `/api/mall/manage/products/${id}/status`,
      })
    })
    return ok(true, status === 1 ? '已上架' : '已下架')
  })
}
