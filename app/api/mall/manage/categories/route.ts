// GET/POST /api/mall/manage/categories — 分类树与新增
import { addLog, handle, ok, readJson } from '@/lib/api'
import { createCategory, categoryTree, type CategoryInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const db = await loadDB()
    requireMallUser(db, MANAGE_ROLES)
    return ok(categoryTree(db))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<CategoryInput>(req)
    const created = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const row = createCategory(db, body, actor)
      addLog(db, actor, { module: '分类', action: '新增', requestUri: '/api/mall/manage/categories', requestBody: body })
      return row
    })
    return ok(created, '新增成功')
  })
}
