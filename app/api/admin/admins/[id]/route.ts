// PUT/DELETE /api/admin/admins/{id}
import { addLog, bad, handle, notFound, ok, readJson, requireAdmin, requireId, requireString, toStatus } from '@/lib/api'
import { mutate } from '@/lib/store'
import type { Admin, RoleCode } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ROLES: RoleCode[] = ['SUPER', 'OPERATOR', 'WAREHOUSE']

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('system')
    const id = requireId(params.id)
    const body = await readJson<Partial<Admin>>(req)

    const updated = await mutate((db) => {
      const admin = db.sysAdmin.find((a) => a.id === id && !a.deleted)
      if (!admin) throw notFound('管理员不存在')

      if (body.realName !== undefined) admin.realName = requireString(body.realName, '姓名', 50)
      if (body.phone !== undefined) admin.phone = String(body.phone ?? '').slice(0, 20) || undefined
      if (body.roleCode !== undefined && ROLES.includes(body.roleCode as RoleCode)) {
        if (admin.id === session.id && body.roleCode !== 'SUPER') {
          throw bad('不能修改自己的角色')
        }
        admin.roleCode = body.roleCode as RoleCode
      }
      if (body.status !== undefined) {
        const next = toStatus(body.status, admin.status)
        if (admin.id === session.id && next === 0) throw bad('不能禁用自己的账号')
        if (next === 0 && admin.roleCode === 'SUPER') {
          const activeSupers = db.sysAdmin.filter(
            (a) => !a.deleted && a.roleCode === 'SUPER' && a.status === 1 && a.id !== admin.id,
          ).length
          if (activeSupers === 0) throw bad('必须保留至少一个启用的超级管理员')
        }
        admin.status = next
        if (next === 1) {
          // 启用时解除登录锁定
          admin.lockedUntil = undefined
          admin.failCount = 0
        }
      }

      admin.updatedAt = new Date().toISOString()
      admin.updatedBy = session.username
      addLog(db, session, {
        module: '管理员', action: '编辑', requestUri: `/api/admin/admins/${id}`,
        requestBody: { realName: admin.realName, roleCode: admin.roleCode, status: admin.status },
      })
      return admin
    })
    return ok({ id: updated.id }, '保存成功')
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = requireAdmin('system')
    const id = requireId(params.id)

    await mutate((db) => {
      const admin = db.sysAdmin.find((a) => a.id === id && !a.deleted)
      if (!admin) throw notFound('管理员不存在')
      if (admin.id === session.id) throw bad('不能删除自己的账号')
      if (admin.roleCode === 'SUPER') {
        const others = db.sysAdmin.filter(
          (a) => !a.deleted && a.roleCode === 'SUPER' && a.id !== admin.id,
        ).length
        if (others === 0) throw bad('必须保留至少一个超级管理员')
      }
      admin.deleted = true
      admin.updatedAt = new Date().toISOString()
      addLog(db, session, { module: '管理员', action: '删除', requestUri: `/api/admin/admins/${id}` })
    })
    return ok(true, '删除成功')
  })
}
