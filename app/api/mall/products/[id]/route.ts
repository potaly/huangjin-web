// GET /api/mall/products/{id} — 商品详情：属性、SKU 列表与库存
import { handle, notFound, ok, requireId } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { productCard, productDetail, stockDisplayMode, onSaleProducts } from '@/lib/mall'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const db = await loadDB()
    const id = requireId(params.id, '商品 ID')
    const product = db.product.find((p) => p.id === id && !p.deleted)
    // 已下架商品仍可查看详情（§4.3：置灰但仍可进入），但需标记
    if (!product) throw notFound('商品不存在')

    const mode = stockDisplayMode(db)
    const related = onSaleProducts(db)
      .filter((p) => p.id !== id && p.categoryId === product.categoryId)
      .slice(0, 4)
      .map((p) => productCard(db, p, mode))

    return ok({
      ...productDetail(db, product, mode),
      offSale: product.status === 0,
      related,
    })
  })
}
