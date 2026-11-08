// PUT/DELETE /api/admin/categories/{id}
import { addLog, handle, ok, readJson, requireAdmin, requireId } from '@/lib/api'
import { deleteCategory, updateCategory, type CategoryInput } from '@/lib/content-service'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('category')
    const id = requireId(params.id)
    const body = await readJson<CategoryInput>(req)
    const updated = await mutate((db) => {
      const category = updateCategory(db, id, body, session)
      addLog(db, session, { module: '分类', action: '编辑', requestUri: `/api/admin/categories/${id}`, requestBody: body })
      return category
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('category')
    const id = requireId(params.id)
    await mutate((db) => {
      deleteCategory(db, id)
      addLog(db, session, { module: '分类', action: '删除', requestUri: `/api/admin/categories/${id}` })
    })
    return ok(true, '删除成功')
  })
}
