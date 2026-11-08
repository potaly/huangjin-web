// 前台请求鉴权：Authorization: Bearer <mall token>
import { headers } from 'next/headers'
import { forbidden, unauthorized } from './api'
import { parseMallToken } from './mall-token'
import { findUser } from './mall-user-service'
import type { AdminSession, DB, MallRole, MallSession, MallUser } from './types'

export function loginRequired(db: DB): boolean {
  const c = db.sysConfig.find((x) => !x.deleted && x.configKey === 'mall.login.required')
  return c?.configValue === 'true'
}

export function currentMallSession(): MallSession | null {
  const auth = headers().get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  return parseMallToken(token)
}

/** 会话对应的用户必须存在且启用；角色以库中最新值为准（改角色、停用立即生效） */
export function resolveMallUser(db: DB, session: MallSession | null): MallUser | null {
  if (!session) return null
  const user = findUser(db, session.uid)
  return user && user.status === 1 ? user : null
}

export function requireMallUser(db: DB, roles?: MallRole[]): MallUser {
  const user = resolveMallUser(db, currentMallSession())
  if (!user) throw unauthorized('请先登录')
  if (roles && !roles.includes(user.role)) throw forbidden()
  return user
}

/** 商品类接口的门槛：开启登录要求时必须是已登录的启用用户 */
export function requireMallAccess(db: DB): void {
  if (loginRequired(db)) requireMallUser(db)
}

/** 商品与库存管理接口允许的角色 */
export const MANAGE_ROLES: MallRole[] = ['OWNER', 'SALES']

/** 把小程序用户转换成服务函数和操作日志需要的会话结构 */
export function mallActor(user: MallUser): AdminSession {
  return {
    id: user.id,
    username: `mall:${user.id}`,
    realName: `${user.name}（小程序）`,
    roleCode: 'OPERATOR',
    exp: 0,
  }
}
