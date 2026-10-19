// ────────────────────────────────────────────────────────────────
// 后台鉴权：口令派生 + 签名会话 Cookie
//
// 需求文档 §8.1：管理后台 token 2 小时；§7.2：连续 5 次失败锁定 15 分钟。
// 前台一期免登录，不存在 customer token，故只实现 admin 账号体系。
// ────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import { cookies } from 'next/headers'
import type { AdminSession, RoleCode } from './types'

export const ADMIN_COOKIE = 'hj_admin_token'
/** 会话有效期：2 小时 */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000
/** 登录失败锁定：15 分钟 */
export const LOCK_DURATION_MS = 15 * 60 * 1000
export const MAX_FAIL_COUNT = 5

const PBKDF2_ITERATIONS = 120_000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha256'

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    // 仅用于未配置密钥的本地 / 预览环境，生产必须设置 ADMIN_SESSION_SECRET
    'huangjin-dev-insecure-secret'
  )
}

// ── 口令 ────────────────────────────────────────────────────────

/** 生成 `pbkdf2$<iterations>$<saltHex>$<hashHex>` */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(
    plain,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST,
  )
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = Buffer.from(parts[2], 'hex')
  const expected = Buffer.from(parts[3], 'hex')
  const actual = crypto.pbkdf2Sync(
    plain,
    salt,
    iterations,
    expected.length,
    PBKDF2_DIGEST,
  )
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

// ── 会话令牌 ────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function sign(payload: string): string {
  return b64url(crypto.createHmac('sha256', secret()).update(payload).digest())
}

export function createToken(session: Omit<AdminSession, 'exp'>): string {
  const payload: AdminSession = { ...session, exp: Date.now() + SESSION_TTL_MS }
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${body}.${sign(body)}`
}

export function parseToken(token: string | undefined | null): AdminSession | null {
  if (!token) return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null

  const expectedMac = sign(body)
  const a = Buffer.from(mac)
  const b = Buffer.from(expectedMac)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const session = JSON.parse(fromB64url(body).toString('utf8')) as AdminSession
    if (!session?.exp || session.exp < Date.now()) return null
    return session
  } catch {
    return null
  }
}

/** 从请求 Cookie 中解析当前登录管理员 */
export function currentAdmin(): AdminSession | null {
  return parseToken(cookies().get(ADMIN_COOKIE)?.value)
}

// ── 角色授权 ────────────────────────────────────────────────────

/** 各模块允许的角色，SUPER 始终放行 */
export const MODULE_ROLES: Record<string, RoleCode[]> = {
  dashboard: ['SUPER', 'OPERATOR', 'WAREHOUSE'],
  category: ['SUPER', 'OPERATOR'],
  material: ['SUPER', 'OPERATOR'],
  product: ['SUPER', 'OPERATOR'],
  stock: ['SUPER', 'WAREHOUSE'],
  content: ['SUPER', 'OPERATOR'],
  system: ['SUPER'],
}

export function canAccess(role: RoleCode, moduleKey: string): boolean {
  if (role === 'SUPER') return true
  return (MODULE_ROLES[moduleKey] ?? ['SUPER']).includes(role)
}
