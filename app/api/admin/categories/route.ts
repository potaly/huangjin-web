// GET/POST /api/admin/categories — 两级分类
import { addLog, bad, handle, ok, readJson, requireAdmin, requireString, toInt, toStatus } from '@/lib/api'
import { loadDB, mutate, nextId } from '@/lib/store'
import type { Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('category')
    const db = await loadDB()
    const all = db.category.filter((c) => !c.deleted)
    const countOf = (id: number) => db.product.filter((p) => !p.deleted && p.categoryId === id).length

    const tree = all
      .filter((c) => c.parentId === 0)
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((parent) => ({
        ...parent,
        productCount: countOf(parent.id),
        children: all
          .filter((c) => c.parentId === parent.id)
          .sort((a, b) => a.sort - b.sort || a.id - b.id)
          .map((c) => ({ ...c, productCount: countOf(c.id) })),
      }))
    return ok(tree)
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('category')
    const body = await readJson<Partial<Category>>(req)
    const name = requireString(body.name, '分类名称', 50)
    const parentId = toInt(body.parentId, 0)

    const created = await mutate((db) => {
      if (parentId !== 0) {
        const parent = db.category.find((c) => c.id === parentId && !c.deleted)
        if (!parent) throw bad('上级分类不存在')
        if (parent.parentId !== 0) throw bad('分类最多两级')
      }
      if (db.category.some((c) => !c.deleted && c.parentId === parentId && c.name === name)) {
        throw bad('同级下已存在同名分类')
      }
      const ts = new Date().toISOString()
      const category: Category = {
        id: nextId(db, 'category'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        parentId,
        name,
        icon: body.icon ? String(body.icon).slice(0, 500) : undefined,
        sort: toInt(body.sort, 100),
        status: toStatus(body.status),
      }
      db.category.push(category)
      addLog(db, session, { module: '分类', action: '新增', requestUri: '/api/admin/categories', requestBody: body })
      return category
    })
    return ok(created, '新增成功')
  })
}
