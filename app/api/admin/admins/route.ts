// GET/POST /api/admin/admins — 管理员账号
import { addLog, bad, handle, ok, readJson, requireAdmin, requireString, toStatus } from '@/lib/api'
import { loadDB, mutate, nextId } from '@/lib/store'
import { hashPassword } from '@/lib/auth'
import { ROLE_LABEL, type Admin, type RoleCode } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ROLES: RoleCode[] = ['SUPER', 'OPERATOR', 'WAREHOUSE']

export async function GET() {
  return handle(async () => {
    requireAdmin('system')
    const db = await loadDB()
    const records = db.sysAdmin
      .filter((a) => !a.deleted)
      .sort((a, b) => a.id - b.id)
      .map((a) => ({
        id: a.id,
        username: a.username,
        realName: a.realName,
        phone: a.phone ?? '',
        roleCode: a.roleCode,
        roleName: ROLE_LABEL[a.roleCode],
        status: a.status,
        lastLoginAt: a.lastLoginAt ?? null,
        locked: Boolean(a.lockedUntil && a.lockedUntil > Date.now()),
        createdAt: a.createdAt,
      }))
    return ok(records)
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = requireAdmin('system')
    const body = await readJson<Partial<Admin>>(req)
    const username = requireString(body.username, '用户名', 50)
    const realName = requireString(body.realName, '姓名', 50)
    const password = requireString(body.password, '初始密码', 100)
    if (password.length < 8) throw bad('密码至少 8 位')
    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
      throw bad('用户名只能是 3–50 位字母、数字、下划线、点或短横线')
    }
    const roleCode = (ROLES.includes(body.roleCode as RoleCode) ? body.roleCode : 'OPERATOR') as RoleCode

    const created = await mutate((db) => {
      if (db.sysAdmin.some((a) => !a.deleted && a.username === username)) {
        throw bad(`用户名 ${username} 已存在`)
      }
      const ts = new Date().toISOString()
      const admin: Admin = {
        id: nextId(db, 'sysAdmin'),
        createdAt: ts,
        updatedAt: ts,
        createdBy: session.username,
        updatedBy: session.username,
        deleted: false,
        username,
        password: hashPassword(password),
        realName,
        phone: body.phone ? String(body.phone).slice(0, 20) : undefined,
        roleCode,
        status: toStatus(body.status),
      }
      db.sysAdmin.push(admin)
      addLog(db, session, {
        module: '管理员', action: '新增', requestUri: '/api/admin/admins',
        requestBody: { username, realName, roleCode },
      })
      return admin
    })
    return ok({ id: created.id }, '新增成功')
  })
}
