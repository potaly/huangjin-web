// PUT/DELETE /api/admin/materials/{id}
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId, requireString, toInt, toStatus } from '@/lib/api'
import { mutate } from '@/lib/store'
import type { Material } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('material')
    const id = requireId(params.id)
    const body = await readJson<Partial<Material>>(req)

    const updated = await mutate((db) => {
      const material = db.goldMaterial.find((m) => m.id === id && !m.deleted)
      if (!material) throw notFound('材质不存在')

      if (body.code !== undefined) {
        const code = requireString(body.code, '材质编码', 30).toUpperCase()
        if (db.goldMaterial.some((m) => !m.deleted && m.code === code && m.id !== id)) {
          throw bad(`材质编码 ${code} 已存在`)
        }
        material.code = code
      }
      if (body.name !== undefined) material.name = requireString(body.name, '材质名称', 50)
      if (body.purity !== undefined) material.purity = String(body.purity).slice(0, 30)
      if (body.sort !== undefined) material.sort = toInt(body.sort, material.sort)
      if (body.status !== undefined) material.status = toStatus(body.status, material.status)

      material.updatedAt = new Date().toISOString()
      material.updatedBy = session.username
      addLog(db, session, { module: '材质', action: '编辑', requestUri: `/api/admin/materials/${id}`, requestBody: body })
      return material
    })
    return ok(updated, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('material')
    const id = requireId(params.id)

    await mutate((db) => {
      const material = db.goldMaterial.find((m) => m.id === id && !m.deleted)
      if (!material) throw notFound('材质不存在')
      const used = db.product.filter((p) => !p.deleted && p.materialId === id).length
      if (used > 0) throw bad(`该材质已被 ${used} 个商品使用，不能删除，可改为停用`)
      material.deleted = true
      material.updatedAt = new Date().toISOString()
      material.updatedBy = session.username
      addLog(db, session, { module: '材质', action: '删除', requestUri: `/api/admin/materials/${id}` })
    })
    return ok(true, '删除成功')
  })
}
