// PUT/DELETE /api/admin/materials/{id}
import { addLog, handle, ok, readJson, requireAdmin, requireId } from '@/lib/api'
import { deleteMaterial, updateMaterial, type MaterialInput } from '@/lib/content-service'
import { mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('material')
    const id = requireId(params.id)
    const body = await readJson<MaterialInput>(req)
    const updated = await mutate((db) => {
      const material = updateMaterial(db, id, body, session)
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
      deleteMaterial(db, id, session)
      addLog(db, session, { module: '材质', action: '删除', requestUri: `/api/admin/materials/${id}` })
    })
    return ok(true, '删除成功')
  })
}
