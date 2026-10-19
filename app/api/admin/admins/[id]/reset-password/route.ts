// POST /api/admin/admins/{id}/reset-password — 超管重置他人密码
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId, requireString } from '@/lib/api'
import { mutate } from '@/lib/store'
import { hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('system')
    const id = requireId(params.id)
    const body = await readJson<{ password?: string }>(req)
    const password = requireString(body.password, '新密码', 100)
    if (password.length < 8) throw bad('密码至少 8 位')

    await mutate((db) => {
      const admin = db.sysAdmin.find((a) => a.id === id && !a.deleted)
      if (!admin) throw notFound('管理员不存在')
      admin.password = hashPassword(password)
      admin.failCount = 0
      admin.lockedUntil = undefined
      admin.updatedAt = new Date().toISOString()
      admin.updatedBy = session.username
      addLog(db, session, {
        module: '管理员', action: '重置密码',
        requestUri: `/api/admin/admins/${id}/reset-password`,
      })
    })
    return ok(true, '密码已重置')
  })
}
