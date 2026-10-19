// GET /api/mall/products — 商品分页：keyword、categoryId、materialId、sort
import { handle, ok, pageParams, paginate } from '@/lib/api'
import { loadDB } from '@/lib/store'
import { categoryScope, onSaleProducts, productCard, skusOf, stockDisplayMode } from '@/lib/mall'
import { availableWeight } from '@/lib/stock'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const mode = stockDisplayMode(db)

    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
    const categoryId = Number(url.searchParams.get('categoryId') ?? 0) || 0
    const materialId = Number(url.searchParams.get('materialId') ?? 0) || 0
    const sort = url.searchParams.get('sort') ?? 'default'
    const onlyRecommend = url.searchParams.get('recommend') === '1'

    const scope = categoryId ? categoryScope(db, categoryId) : null

    let list = onSaleProducts(db)
    if (keyword) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(keyword) ||
          p.styleNo.toLowerCase().includes(keyword),
      )
    }
    if (scope) list = list.filter((p) => scope.includes(p.categoryId))
    if (materialId) list = list.filter((p) => p.materialId === materialId)
    if (onlyRecommend) list = list.filter((p) => p.isRecommend)

    const totalStock = (productId: number) =>
      skusOf(db, productId)
        .filter((s) => s.status === 1)
        .reduce((sum, s) => sum + availableWeight(s), 0)

    if (sort === 'stock') {
      list = [...list].sort((a, b) => totalStock(b.id) - totalStock(a.id))
    } else if (sort === 'new') {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    } else {
      // 默认：售罄置后，再按排序值、推荐、ID
      list = [...list].sort((a, b) => {
        const sa = totalStock(a.id) > 0 ? 0 : 1
        const sb = totalStock(b.id) > 0 ? 0 : 1
        if (sa !== sb) return sa - sb
        if (a.isRecommend !== b.isRecommend) return a.isRecommend ? -1 : 1
        return a.sort - b.sort || b.id - a.id
      })
    }

    const page = paginate(list, pageNum, pageSize)
    return ok({
      ...page,
      records: page.records.map((p) => productCard(db, p, mode)),
      stockDisplayMode: mode,
    })
  })
}
