// ────────────────────────────────────────────────────────────────
// 统一返回、鉴权守卫、分页与操作日志
// 需求文档 §7：统一返回 {code, msg, data}，code 为 0 表示成功
// ────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import type { DB, OperationLog, Page, AdminSession } from './types'
import { currentAdmin, canAccess } from './auth'
import { nextId } from './store'

export interface ApiResult<T> {
  code: number
  msg: string
  data: T | null
}

export function ok<T>(data: T, msg = 'success'): NextResponse {
  return NextResponse.json<ApiResult<T>>({ code: 0, msg, data })
}

export function fail(msg: string, code = 500, status = 200): NextResponse {
  return NextResponse.json<ApiResult<null>>({ code, msg, data: null }, { status })
}

/** 业务异常：由 handle() 捕获后转为 {code, msg} */
export class BizError extends Error {
  code: number
  status: number
  constructor(msg: string, code = 400, status = 200) {
    super(msg)
    this.code = code
    this.status = status
  }
}

export const bad = (msg: string) => new BizError(msg, 400)
export const notFound = (msg = '数据不存在') => new BizError(msg, 404)
export const unauthorized = (msg = '登录已过期，请重新登录') => new BizError(msg, 401, 401)
export const forbidden = (msg = '没有该操作权限') => new BizError(msg, 403, 403)

/** 包裹路由处理函数，统一异常转换 */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof BizError) return fail(e.message, e.code, e.status)
    console.error('[api] unexpected error:', e)
    const msg = e instanceof Error ? e.message : '服务器内部错误'
    return fail(msg, 500)
  }
}

// ── 鉴权 ────────────────────────────────────────────────────────

/** 要求已登录；传入 moduleKey 时同时校验角色 */
export function requireAdmin(moduleKey?: string): AdminSession {
  const session = currentAdmin()
  if (!session) throw unauthorized()
  if (moduleKey && !canAccess(session.roleCode, moduleKey)) throw forbidden()
  return session
}

// ── 分页 ────────────────────────────────────────────────────────

export function pageParams(url: URL): { pageNum: number; pageSize: number } {
  const pageNum = Math.max(1, Number(url.searchParams.get('pageNum') ?? 1) || 1)
  const rawSize = Number(url.searchParams.get('pageSize') ?? 10) || 10
  const pageSize = Math.min(200, Math.max(1, rawSize))
  return { pageNum, pageSize }
}

export function paginate<T>(records: T[], pageNum: number, pageSize: number): Page<T> {
  const total = records.length
  const start = (pageNum - 1) * pageSize
  return { records: records.slice(start, start + pageSize), total, pageNum, pageSize }
}

// ── 操作日志 ────────────────────────────────────────────────────
// 在同一个 mutate 事务内写入，避免嵌套加锁

const LOG_KEEP = 500

export function addLog(
  db: DB,
  session: AdminSession,
  entry: { module: string; action: string; requestUri: string; requestBody?: unknown },
): void {
  const ts = new Date().toISOString()
  let body = ''
  if (entry.requestBody !== undefined) {
    try {
      body = JSON.stringify(entry.requestBody, (key, value) =>
        /password|secret|token/i.test(key) ? '***' : value,
      )
      if (body.length > 2000) body = `${body.slice(0, 2000)}…`
    } catch {
      body = ''
    }
  }

  const log: OperationLog = {
    id: nextId(db, 'sysOperationLog'),
    createdAt: ts,
    updatedAt: ts,
    adminId: session.id,
    adminName: session.realName || session.username,
    module: entry.module,
    action: entry.action,
    requestUri: entry.requestUri,
    requestBody: body,
  }
  db.sysOperationLog.unshift(log)
  if (db.sysOperationLog.length > LOG_KEEP) {
    db.sysOperationLog.length = LOG_KEEP
  }
}

// ── 入参校验 ────────────────────────────────────────────────────

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw bad('请求体不是合法的 JSON')
  }
}

export function requireString(value: unknown, field: string, maxLen = 200): string {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v) throw bad(`${field}不能为空`)
  if (v.length > maxLen) throw bad(`${field}长度不能超过 ${maxLen} 个字符`)
  return v
}

export function optionalString(value: unknown, maxLen = 2000): string | undefined {
  if (value === null || value === undefined) return undefined
  const v = String(value).trim()
  if (!v) return undefined
  return v.length > maxLen ? v.slice(0, maxLen) : v
}

export function requireId(value: unknown, field = 'ID'): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw bad(`${field}不合法`)
  return n
}

export function toInt(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function toStatus(value: unknown, fallback: 0 | 1 = 1): 0 | 1 {
  return Number(value) === 0 ? 0 : Number(value) === 1 ? 1 : fallback
}

export function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}
