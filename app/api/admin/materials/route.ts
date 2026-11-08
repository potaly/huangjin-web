// GET/POST /api/admin/materials — 材质字典
import { addLog, handle, ok, readJson, requireAdmin } from '@/lib/api'
import { createMaterial, listMaterials, type MaterialInput } from '@/lib/content-service'
import { loadDB, mutate } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('material')
    const db = await loadDB()
    return ok(listMaterials(db))
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('material')
    const body = await readJson<MaterialInput>(req)
    const created = await mutate((db) => {
      const material = createMaterial(db, body, session)
      addLog(db, session, { module: '材质', action: '新增', requestUri: '/api/admin/materials', requestBody: body })
      return material
    })
    return ok(created, '新增成功')
  })
}
