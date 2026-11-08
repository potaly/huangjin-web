// PUT/DELETE /api/mall/manage/categories/{id}
import { addLog, handle, ok, readJson, requireId } from '@/lib/api'
import { deleteCategory, updateCategory, type CategoryInput } from '@/lib/content-service'
import { MANAGE_ROLES, mallActor, requireMallUser } from '@/lib/mall-auth'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    const body = await readJson<CategoryInput>(req)
    const updated = await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      const row = updateCategory(db, id, body, actor)
      addLog(db, actor, { module: '分类', action: '编辑', requestUri: `/api/mall/manage/categories/${id}`, requestBody: body })
      return row
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const id = requireId(params.id)
    await mutate((db) => {
      const actor = mallActor(requireMallUser(db, MANAGE_ROLES))
      deleteCategory(db, id)
      addLog(db, actor, { module: '分类', action: '删除', requestUri: `/api/mall/manage/categories/${id}` })
    })
    return ok(true, '删除成功')
  })
}
