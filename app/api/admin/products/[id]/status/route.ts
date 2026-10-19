// PUT /api/admin/products/{id}/status — 上架 / 下架
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId, toStatus } from '@/lib/api'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('product')
    const id = requireId(params.id)
    const body = await readJson<{ status?: unknown }>(req)
    const status = toStatus(body.status, 0)

    await mutate((db) => {
      const product = db.product.find((p) => p.id === id && !p.deleted)
      if (!product) throw notFound('商品不存在')
      if (status === 1) {
        if (!product.cover) throw bad('上架前请先上传主图')
        const hasActiveSku = db.productSku.some(
          (s) => !s.deleted && s.productId === id && s.status === 1,
        )
        if (!hasActiveSku) throw bad('上架前请至少启用一个 SKU')
      }
      product.status = status
      product.updatedAt = new Date().toISOString()
      product.updatedBy = session.username
      addLog(db, session, {
        module: '商品', action: status === 1 ? '上架' : '下架',
        requestUri: `/api/admin/products/${id}/status`,
      })
    })
    return ok(true, status === 1 ? '已上架' : '已下架')
  })
}
