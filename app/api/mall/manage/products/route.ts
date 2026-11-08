// GET/POST /api/mall/manage/products — 商品分页与新增
import { addLog, handle, ok, pageParams, paginate, readJson } from '@/lib/api'
import { filterProducts, productFilterFromUrl, productRow } from '@/lib/manage-query'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { createProduct, type ProductInput } from '@/lib/product-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    const url = new URL(req.url)
    const { pageNum, pageSize } = pageParams(url)
    const page = paginate(filterProducts(db, productFilterFromUrl(url)), pageNum, pageSize)
    return ok({ ...page, records: page.records.map((p) => productRow(db, p)) })
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<ProductInput>(req)
    const created = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const product = createProduct(db, body, actor)
      addLog(db, actor, {
        module: '商品', action: '新增', requestUri: '/api/mall/manage/products',
        requestBody: { name: product.name, styleNo: product.styleNo },
      })
      return product
    })
    return ok({ id: created.id }, '新增成功')
  })
}
