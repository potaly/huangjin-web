// PUT /api/admin/products/{id}/status — 上架 / 下架
import { addLog, handle, ok, readJson, requireAdmin, requireId, toStatus } from '@/lib/api'
import { mutate } from '@/lib/store'
import { setProductStatus } from '@/lib/product-service'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('product')
    const id = requireId(params.id)
    const body = await readJson<{ status?: unknown }>(req)
    const status = toStatus(body.status, 0)

    await mutate((db) => {
      setProductStatus(db, id, status, session)
      addLog(db, session, {
        module: '商品', action: status === 1 ? '上架' : '下架',
        requestUri: `/api/admin/products/${id}/status`,
      })
    })
    return ok(true, status === 1 ? '已上架' : '已下架')
  })
}
