// GET /api/mall/manage/product-options — 商品表单的分类和材质选项
import { handle, ok } from '@/lib/api'
import { productOptions } from '@/lib/manage-query'
import { MANAGE_ROLES, requireMallUser } from '@/lib/mall-auth'
import { loadDB } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    return ok(productOptions(db))
  })
}
