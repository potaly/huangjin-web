// POST /api/admin/admins/change-password — 修改自己的密码
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireString } from '@/lib/api'
import { mutate } from '@/lib/store'
import { ADMIN_COOKIE, hashPassword, verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin()
    const body = await readJson<{ oldPassword?: string; newPassword?: string }>(req)
    const oldPassword = requireString(body.oldPassword, '原密码', 100)
    const newPassword = requireString(body.newPassword, '新密码', 100)
    if (newPassword.length < 8) throw bad('新密码至少 8 位')
    if (newPassword === oldPassword) throw bad('新密码不能与原密码相同')

    await mutate((db) => {
      const admin = db.sysAdmin.find((a) => a.id === session.id && !a.deleted)
      if (!admin) throw notFound('账号不存在')
      if (!verifyPassword(oldPassword, admin.password)) throw bad('原密码错误')
      admin.password = hashPassword(newPassword)
      admin.updatedAt = new Date().toISOString()
      admin.updatedBy = admin.username
      addLog(db, session, {
        module: '管理员', action: '修改密码', requestUri: '/api/admin/admins/change-password',
      })
    })

    // 改密后强制重新登录
    const res = ok(true, '密码已修改，请重新登录')
    res.headers.append('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
    return res
  })
}
