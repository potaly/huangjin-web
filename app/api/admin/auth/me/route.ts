// GET /api/admin/auth/me — 当前登录管理员
import { handle, ok, requireAdmin } from '@/lib/api'
import { loadDB, storageDriver } from '@/lib/store'
import { MODULE_ROLES, canAccess } from '@/lib/auth'
import { ROLE_LABEL } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(async () => {
    const session = requireAdmin()
    const db = await loadDB()
    const admin = db.sysAdmin.find((a) => a.id === session.id && !a.deleted)

    const modules: Record<string, boolean> = {}
    for (const key of Object.keys(MODULE_ROLES)) {
      modules[key] = canAccess(session.roleCode, key)
    }

    return ok({
      id: session.id,
      username: session.username,
      realName: session.realName,
      roleCode: session.roleCode,
      roleName: ROLE_LABEL[session.roleCode],
      phone: admin?.phone ?? '',
      lastLoginAt: admin?.lastLoginAt ?? null,
      modules,
      storageDriver: storageDriver(),
    })
  })
}
