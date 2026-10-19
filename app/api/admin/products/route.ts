// GET/POST /api/admin/products — 商品分页与新增
import { addLog, handle, ok, pageParams, paginate, readJson, requireAdmin } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { createProduct, type ProductInput } from '@/lib/product-service'
import { availableWeight, productStockLevel } from '@/lib/stock'
import { sumWeight } from '@/lib/num'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('product')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)

    const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
    const categoryId = Number(url.searchParams.get('categoryId') ?? 0) || 0
    const materialId = Number(url.searchParams.get('materialId') ?? 0) || 0
    const statusParam = url.searchParams.get('status')

    let list = db.product.filter((p) => !p.deleted)
    if (keyword) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(keyword) || p.styleNo.toLowerCase().includes(keyword),
      )
    }
    if (categoryId) {
      const scope = [categoryId, ...db.category.filter((c) => c.parentId === categoryId).map((c) => c.id)]
      list = list.filter((p) => scope.includes(p.categoryId))
    }
    if (materialId) list = list.filter((p) => p.materialId === materialId)
    if (statusParam === '0' || statusParam === '1') {
      list = list.filter((p) => p.status === Number(statusParam))
    }

    list = [...list].sort((a, b) => a.sort - b.sort || b.id - a.id)
    const page = paginate(list, pageNum, pageSize)

    return ok({
      ...page,
      records: page.records.map((p) => {
        const skus = db.productSku.filter((s) => !s.deleted && s.productId === p.id)
        return {
          id: p.id,
          name: p.name,
          styleNo: p.styleNo,
          cover: p.cover,
          categoryName: db.category.find((c) => c.id === p.categoryId)?.name ?? '',
          materialName: db.goldMaterial.find((m) => m.id === p.materialId)?.name ?? '',
          isRecommend: p.isRecommend,
          status: p.status,
          sort: p.sort,
          skuCount: skus.length,
          stockWeight: sumWeight(skus.map((s) => s.stockWeight)),
          availableWeight: sumWeight(skus.map((s) => availableWeight(s))),
          stockLevel: productStockLevel(skus),
          updatedAt: p.updatedAt,
        }
      }),
    })
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('product')
    const body = await readJson<ProductInput>(req)
    const created = await mutate((db) => {
      const product = createProduct(db, body, session)
      addLog(db, session, {
        module: '商品', action: '新增', requestUri: '/api/admin/products',
        requestBody: { name: product.name, styleNo: product.styleNo },
      })
      return product
    })
    return ok({ id: created.id }, '新增成功')
  })
}
