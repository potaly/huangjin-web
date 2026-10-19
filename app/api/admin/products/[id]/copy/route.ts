// POST /api/admin/products/{id}/copy — 复制商品（库存清零、默认下架）
import { addLog, handle, ok, requireAdmin, requireId } from '@/lib/api'
import { mutate } from '@/lib/store'
import { copyProduct } from '@/lib/product-service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('product')
    const id = requireId(params.id)
    const created = await mutate((db) => {
      const product = copyProduct(db, id, session)
      addLog(db, session, {
        module: '商品', action: '复制', requestUri: `/api/admin/products/${id}/copy`,
        requestBody: { from: id, to: product.id },
      })
      return product
    })
    return ok({ id: created.id, styleNo: created.styleNo }, '复制成功，已生成下架副本')
  })
}
