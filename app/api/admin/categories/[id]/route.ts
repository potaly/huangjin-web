// PUT/DELETE /api/admin/categories/{id}
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId, requireString, toInt, toStatus } from '@/lib/api'
import { mutate } from '@/lib/store'
import type { Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('category')
    const id = requireId(params.id)
    const body = await readJson<Partial<Category>>(req)

    const updated = await mutate((db) => {
      const category = db.category.find((c) => c.id === id && !c.deleted)
      if (!category) throw notFound('分类不存在')

      if (body.name !== undefined) {
        const name = requireString(body.name, '分类名称', 50)
        if (db.category.some((c) => !c.deleted && c.parentId === category.parentId && c.name === name && c.id !== id)) {
          throw bad('同级下已存在同名分类')
        }
        category.name = name
      }
      if (body.icon !== undefined) category.icon = String(body.icon ?? '').slice(0, 500) || undefined
      if (body.sort !== undefined) category.sort = toInt(body.sort, category.sort)
      if (body.status !== undefined) {
        category.status = toStatus(body.status, category.status)
        // 停用一级分类时同步停用其二级分类
        if (category.status === 0 && category.parentId === 0) {
          for (const child of db.category) {
            if (!child.deleted && child.parentId === id) child.status = 0
          }
        }
      }
      category.updatedAt = new Date().toISOString()
      category.updatedBy = session.username
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
      const category = db.category.find((c) => c.id === id && !c.deleted)
      if (!category) throw notFound('分类不存在')
      const children = db.category.filter((c) => !c.deleted && c.parentId === id).length
      if (children > 0) throw bad(`请先删除该分类下的 ${children} 个二级分类`)
      const used = db.product.filter((p) => !p.deleted && p.categoryId === id).length
      if (used > 0) throw bad(`该分类下还有 ${used} 个商品，不能删除`)
      category.deleted = true
      category.updatedAt = new Date().toISOString()
      addLog(db, session, { module: '分类', action: '删除', requestUri: `/api/admin/categories/${id}` })
    })
    return ok(true, '删除成功')
  })
}
