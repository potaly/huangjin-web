// 前台用户（白名单）业务规则：纯函数，调用方负责放进 mutate() 事务
import { bad, forbidden, notFound } from './api'
import { nextId } from './store'
import { MALL_ROLE_LABEL, type DB, type MallRole, type MallUser } from './types'

const ROLES: MallRole[] = ['OWNER', 'SALES', 'CUSTOMER']

export function normalizePhone(raw: unknown): string {
  const phone = String(raw ?? '').replace(/[\s-]/g, '')
  if (!/^1\d{10}$/.test(phone)) throw bad('请输入 11 位手机号')
  return phone
}

const alive = (db: DB) => db.mallUser.filter((u) => !u.deleted)

export function findUser(db: DB, id: number): MallUser | undefined {
  return alive(db).find((u) => u.id === id)
}

/** 白名单手机号登录；带 openid 时把微信绑到该用户（从其他客户上解绑；管理账号的微信不可被抢绑） */
export function loginByPhone(db: DB, rawPhone: string, openid?: string): MallUser {
  const phone = normalizePhone(rawPhone)
  const user = alive(db).find((u) => u.phone === phone)
  if (!user) throw bad('该手机号未开通，请联系店家')
  if (user.status !== 1) throw bad('账号已停用，请联系店家')
  const ts = new Date().toISOString()
  const managed = user.role === 'OWNER' || user.role === 'SALES'
  if (managed && user.openid && user.openid !== openid) {
    throw bad('管理账号已绑定微信，请在小程序内用本人微信登录')
  }
  if (openid) {
    const holders = db.mallUser.filter((o) => o.id !== user.id && o.openid === openid)
    // 老板账号的微信不能被换走；业务员与客户之间允许同一微信切换（旧账号随之解绑）
    if (holders.some((o) => o.role === 'OWNER')) {
      throw bad('该微信已绑定老板账号，不能再绑定其他账号')
    }
    for (const other of holders) {
      other.openid = null
      other.updatedAt = ts
    }
    user.openid = openid
  }
  user.lastLoginAt = ts
  user.updatedAt = ts
  return user
}

/** 微信一键登录：openid 已绑定启用用户时返回该用户，否则 null */
export function loginByOpenid(db: DB, openid: string): MallUser | null {
  const user = alive(db).find((u) => u.openid === openid && u.status === 1)
  if (!user) return null
  user.lastLoginAt = new Date().toISOString()
  return user
}

export interface UserInput {
  phone?: unknown
  name?: unknown
  role?: unknown
  salesId?: unknown
  status?: unknown
}

function checkRole(role: unknown): MallRole {
  if (!ROLES.includes(role as MallRole)) throw bad('角色不合法')
  return role as MallRole
}

function checkSales(db: DB, salesId: unknown): number | null {
  if (salesId === null || salesId === undefined || salesId === '' || salesId === 0) return null
  const s = findUser(db, Number(salesId))
  if (!s || s.role !== 'SALES' || s.status !== 1) throw bad('绑定的业务员不存在或已停用')
  return s.id
}

function checkName(name: unknown): string {
  const v = String(name ?? '').trim()
  if (!v) throw bad('姓名不能为空')
  if (v.length > 20) throw bad('姓名不能超过 20 个字')
  return v
}

function requireOwner(actor: MallUser) {
  if (actor.role !== 'OWNER') throw forbidden('只有老板有用户管理权限')
}

export function createUser(db: DB, actor: MallUser, input: UserInput): MallUser {
  requireOwner(actor)
  const phone = normalizePhone(input.phone)
  if (alive(db).some((u) => u.phone === phone)) throw bad('该手机号已存在')
  const role = checkRole(input.role)
  const ts = new Date().toISOString()
  const user: MallUser = {
    id: nextId(db, 'mallUser'),
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.name,
    updatedBy: actor.name,
    phone,
    name: checkName(input.name),
    role,
    salesId: role === 'CUSTOMER' ? checkSales(db, input.salesId) : null,
    openid: null,
    status: Number(input.status) === 0 ? 0 : 1,
  }
  db.mallUser.push(user)
  return user
}

export function updateUser(db: DB, actor: MallUser, id: number, input: UserInput): MallUser {
  requireOwner(actor)
  const user = findUser(db, id)
  if (!user) throw notFound('用户不存在')
  const isSelf = user.id === actor.id

  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone)
    if (alive(db).some((u) => u.phone === phone && u.id !== id)) throw bad('该手机号已存在')
    if (phone !== user.phone) user.openid = null
    user.phone = phone
  }
  if (input.name !== undefined) user.name = checkName(input.name)
  if (input.role !== undefined) {
    const role = checkRole(input.role)
    if (role !== user.role) {
      if (isSelf) throw bad('不能修改自己的角色')
      if (user.role === 'SALES') {
        const n = alive(db).filter((u) => u.salesId === user.id).length
        if (n > 0) throw bad(`该业务员名下还有 ${n} 个客户，请先改绑`)
      }
      user.role = role
    }
  }
  if (user.role === 'CUSTOMER') {
    if (input.salesId !== undefined) user.salesId = checkSales(db, input.salesId)
  } else {
    user.salesId = null
  }
  if (input.status !== undefined) {
    const status = Number(input.status) === 0 ? 0 : 1
    if (isSelf && status === 0) throw bad('不能停用自己')
    user.status = status
  }
  user.updatedAt = new Date().toISOString()
  user.updatedBy = actor.name
  return user
}

/** 老板看全部（可按角色筛），业务员只看自己的客户 */
export function listUsers(db: DB, actor: MallUser, role?: MallRole): MallUser[] {
  let list = alive(db)
  if (actor.role === 'SALES') list = list.filter((u) => u.role === 'CUSTOMER' && u.salesId === actor.id)
  else if (actor.role !== 'OWNER') return []
  if (role) list = list.filter((u) => u.role === role)
  return list.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.id - b.id)
}

export function userView(db: DB, u: MallUser) {
  const sales = u.salesId ? findUser(db, u.salesId) : undefined
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: u.role,
    roleLabel: MALL_ROLE_LABEL[u.role],
    salesId: u.salesId ?? null,
    salesName: sales?.name ?? '',
    salesPhone: sales?.phone ?? '',
    status: u.status,
    wxBound: Boolean(u.openid),
    lastLoginAt: u.lastLoginAt ?? '',
  }
}

export type MallUserView = ReturnType<typeof userView>
