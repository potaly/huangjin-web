// GET/POST /api/admin/products — 商品分页与新增
import { addLog, handle, ok, pageParams, paginate, readJson, requireAdmin } from '@/lib/api'
import { loadDB, mutate } from '@/lib/store'
import { createProduct, type ProductInput } from '@/lib/product-service'
import { filterProducts, productFilterFromUrl, productRow } from '@/lib/manage-query'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    requireAdmin('product')
    const db = await loadDB()
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const page = paginate(filterProducts(db, productFilterFromUrl(url)), pageNum, pageSize)
    return ok({ ...page, records: page.records.map((p) => productRow(db, p)) })
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
