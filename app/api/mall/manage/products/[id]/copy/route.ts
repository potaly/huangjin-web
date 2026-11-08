// POST /api/mall/manage/products/{id}/copy — 复制商品（库存清零、默认下架）
import { addLog, handle, ok, requireId } from '@/lib/api'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { copyProduct } from '@/lib/product-service'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const created = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const product = copyProduct(db, id, actor)
      addLog(db, actor, {
        module: '商品', action: '复制', requestUri: `/api/mall/manage/products/${id}/copy`,
        requestBody: { from: id, to: product.id },
      })
      return product
    })
    return ok({ id: created.id, styleNo: created.styleNo }, '复制成功，已生成下架副本')
  })
}
