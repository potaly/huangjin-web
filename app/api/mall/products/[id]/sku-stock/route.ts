// GET /api/mall/products/{id}/sku-stock — 加购弹层用：各启用规格的可售件数（与库存展示方式无关）
import { handle, notFound, ok, requireId } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { requireMallAccess } from '@/lib/mall-auth'
import { sellableQty } from '@/lib/order-service'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const db = await loadDB()
    requireMallAccess(db)
    const product = db.product.find((p) => p.id === id && !p.deleted && p.status === 1)
    if (!product) throw notFound('商品不存在或已下架')
    const skus = db.productSku
      .filter((s) => !s.deleted && s.productId === id && s.status === 1)
      .map((s) => ({ skuId: s.id, specName: s.specName, unitWeight: s.refWeight ?? null, availableQty: sellableQty(s) }))
    return ok({ productId: id, laborFeePerG: product.laborFeePerG ?? null, skus })
  })
}
