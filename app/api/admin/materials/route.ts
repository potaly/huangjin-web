// GET/POST /api/admin/materials — 材质字典
import { addLog, bad, handle, ok, readJson, requireAdmin, requireString, toInt, toStatus } from '@/lib/api'
import { loadDB, mutate, nextId } from '@/lib/store'
import type { Material } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    requireAdmin('material')
    const db = await loadDB()
    const records = db.goldMaterial
      .filter((m) => !m.deleted)
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((m) => ({
        ...m,
        productCount: db.product.filter((p) => !p.deleted && p.materialId === m.id).length,
      }))
    return ok(records)
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('material')
    const body = await readJson<Partial<Material>>(req)
    const code = requireString(body.code, '材质编码', 30).toUpperCase()
    const name = requireString(body.name, '材质名称', 50)

    const created = await mutate((db) => {
      if (db.goldMaterial.some((m) => !m.deleted && m.code === code)) {
        throw bad(`材质编码 ${code} 已存在`)
      }
      const ts = new Date().toISOString()
      const material: Material = {
        id: nextId(db, 'goldMaterial'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        code,
        name,
        purity: body.purity ? String(body.purity).slice(0, 30) : undefined,
        sort: toInt(body.sort, 100),
        status: toStatus(body.status),
      }
      db.goldMaterial.push(material)
      addLog(db, session, { module: '材质', action: '新增', requestUri: '/api/admin/materials', requestBody: body })
      return material
    })
    return ok(created, '新增成功')
  })
}
