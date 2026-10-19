// ────────────────────────────────────────────────────────────────
// 存储适配层
//
// 与参考项目 activation-service 的做法一致：
//   · 配置了 Upstash Redis / Vercel KV 时，使用 Redis 持久化
//   · 未配置时降级为内存存储（读取 data/seed.json 初始化）
//
// 一期数据量小（商品、SKU、公告、轮播、参数），整库以单个 JSON 文档
// 保存在 Redis 的 `huangjin:db` 键下，写操作用 Redis 分布式锁串行化。
// ────────────────────────────────────────────────────────────────

import type { DB } from './types'
import { buildSeedDB } from './seed'

const DB_KEY = 'huangjin:db'
const LOCK_KEY = 'huangjin:db:lock'
const LOCK_TTL_MS = 8000

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || ''
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''

export const hasRedis = Boolean(redisUrl && redisToken)

export function storageDriver(): 'redis' | 'memory' {
  return hasRedis ? 'redis' : 'memory'
}

type RedisClient = import('@upstash/redis').Redis

let redisClient: RedisClient | null = null

function redis(): RedisClient {
  if (!redisClient) {
    // 延迟引入，内存模式下不加载 SDK
    const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis')
    redisClient = new Redis({ url: redisUrl, token: redisToken })
  }
  return redisClient
}

// ── 内存模式：挂在 globalThis 上，避免 dev 热更新时丢失 ──
interface MemoryHolder {
  db: DB | null
}

const memory: MemoryHolder = ((globalThis as any).__huangjinMemory ??= {
  db: null,
})

async function readRaw(): Promise<DB | null> {
  if (!hasRedis) return memory.db

  const value = await redis().get<DB | string>(DB_KEY)
  if (value == null) return null
  // Upstash 会自动反序列化 JSON，但老数据可能是字符串
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as DB
    } catch {
      return null
    }
  }
  return value
}

async function writeRaw(db: DB): Promise<void> {
  if (!hasRedis) {
    memory.db = db
    return
  }
  await redis().set(DB_KEY, JSON.stringify(db))
}

/** 读取整库，首次访问时自动写入种子数据 */
export async function loadDB(): Promise<DB> {
  const existing = await readRaw()
  if (existing) return migrate(existing)

  const seeded = await buildSeedDB()

  if (!hasRedis) {
    memory.db = seeded
    return seeded
  }

  // 多个冷启动实例可能同时发现空库：用 NX 写入，先到者胜，
  // 失败方回读已有数据，避免把别人刚写入的内容覆盖掉。
  const won = await redis().set(DB_KEY, JSON.stringify(seeded), { nx: true })
  if (won) return seeded

  const current = await readRaw()
  return current ? migrate(current) : seeded
}

/** 覆盖写入整库（仅供初始化 / 重置使用） */
export async function overwriteDB(db: DB): Promise<void> {
  await writeRaw(db)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function acquireLock(): Promise<string | null> {
  if (!hasRedis) return 'memory'
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  for (let i = 0; i < 25; i++) {
    const ok = await redis().set(LOCK_KEY, token, { nx: true, px: LOCK_TTL_MS })
    if (ok) return token
    await sleep(80)
  }
  return null
}

async function releaseLock(token: string): Promise<void> {
  if (!hasRedis) return
  const current = await redis().get<string>(LOCK_KEY)
  if (current === token) await redis().del(LOCK_KEY)
}

/**
 * 串行化的读-改-写事务。
 * 回调内直接修改传入的 DB 对象，返回值会原样传给调用方。
 */
export async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const token = await acquireLock()
  if (!token) throw new Error('系统繁忙，请稍后重试')
  try {
    const db = await loadDB()
    const result = await fn(db)
    await writeRaw(db)
    return result
  } finally {
    await releaseLock(token)
  }
}

/** 自增主键 */
export function nextId(db: DB, table: string): number {
  const current = db.seq[table] ?? 1000
  const next = current + 1
  db.seq[table] = next
  return next
}

/** 结构升级：补齐后续版本新增的字段 / 表 */
function migrate(db: DB): DB {
  db.seq ??= {}
  db.sysAdmin ??= []
  db.sysConfig ??= []
  db.sysOperationLog ??= []
  db.goldMaterial ??= []
  db.category ??= []
  db.product ??= []
  db.productSku ??= []
  db.stockLog ??= []
  db.notice ??= []
  db.banner ??= []
  db.schemaVersion ??= 1
  return db
}
