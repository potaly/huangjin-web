// GET/PUT/DELETE /api/mall/manage/products/{id}
import { addLog, handle, ok, readJson, requireId } from '@/lib/api'
import { productDetail } from '@/lib/manage-query'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { deleteProduct, updateProduct, type ProductInput } from '@/lib/product-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    return ok(productDetail(db, requireId(params.id)))
  })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const body = await readJson<ProductInput>(req)
    await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const product = updateProduct(db, id, body, actor)
      addLog(db, actor, {
        module: '商品', action: '编辑', requestUri: `/api/mall/manage/products/${id}`,
        requestBody: { name: product.name, styleNo: product.styleNo },
      })
    })
    return ok(true, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      deleteProduct(db, id, actor)
      addLog(db, actor, { module: '商品', action: '删除', requestUri: `/api/mall/manage/products/${id}` })
    })
    return ok(true, '删除成功')
  })
}
