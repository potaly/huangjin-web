// GET/POST /api/admin/categories — 两级分类
import { addLog, handle, ok, readJson, requireAdmin } from '@/lib/api'
import { categoryTree, createCategory, type CategoryInput } from '@/lib/content-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('category')
    const db = await loadDB()
    return ok(categoryTree(db))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('category')
    const body = await readJson<CategoryInput>(req)
    const created = await mutate((db) => {
      const category = createCategory(db, body, session)
      addLog(db, session, { module: '分类', action: '新增', requestUri: '/api/admin/categories', requestBody: body })
      return category
    })
    return ok(created, '新增成功')
  })
}
