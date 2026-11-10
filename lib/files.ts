// ────────────────────────────────────────────────────────────────
// 图片存储
//
// 新上传的图片一律存腾讯云 COS（见 lib/cos.ts），数据库里只存 COS 的
// 完整 https 地址；H5 和小程序拿到绝对地址直接显示。
//
// 历史图片曾以 base64 存在 Redis（键 huangjin:file:{id}），通过
// /api/files/{id} 读取。这条读取路径保留为只读兼容：迁移脚本
// scripts/migrate-images-to-cos.ts 跑完之前，旧地址照常能显示。
//
// 未配置 COS 时：
//   - 本地内存模式（没有 Redis）存进进程内存，便于开发调试；
//   - 已连 Redis 的环境直接报错，不再往 Redis 写图片。
// ────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import { cosConfig, cosPutObject } from './cos'

const PREFIX = 'huangjin:file:'
/** 单张图片上限，前端会先在浏览器 / 小程序里压缩（长边 1280、JPEG 质量 0.8 左右，一般 150–350KB） */
export const MAX_FILE_BYTES = 600 * 1024

export const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

export function extOf(mime: string): string {
  return EXT[mime] ?? 'bin'
}

/** 旧版站内图片地址 /api/files/{24 位 hex} */
export const LEGACY_FILE_URL = /\/api\/files\/([a-f0-9]{24})/g

/** Redis / 内存里的旧格式文件 */
export interface StoredFile {
  id: string
  mime: string
  size: number
  /** base64 原文 */
  data: string
  name?: string
  createdAt: string
}

export interface SavedFile {
  id: string
  /** 可直接写进数据库、给前端用的地址：COS 为完整 https 地址，内存模式为 /api/files/{id} */
  url: string
  mime: string
  size: number
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || ''
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
const hasRedis = Boolean(redisUrl && redisToken)

let client: import('@upstash/redis').Redis | null = null
function redis() {
  if (!client) {
    const { Redis } = require('@upstash/redis') as typeof import('@upstash/redis')
    client = new Redis({ url: redisUrl, token: redisToken })
  }
  return client
}

const memoryFiles: Map<string, StoredFile> = ((globalThis as any).__huangjinFiles ??= new Map())

/** 新上传图片的 COS key：{前缀}uploads/{年月}/{随机}.{扩展名} */
export function newObjectKey(prefix: string, mime: string, now = new Date()): string {
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  return `${prefix}uploads/${ym}/${crypto.randomBytes(12).toString('hex')}.${extOf(mime)}`
}

/** 旧图迁移用的固定 key，同一张旧图重复迁移会覆盖同一个对象，可放心重跑 */
export function legacyObjectKey(prefix: string, id: string, mime: string): string {
  return `${prefix}legacy/${id}.${extOf(mime)}`
}

export async function saveFile(input: { mime: string; buffer: Buffer; name?: string }): Promise<SavedFile> {
  if (!ALLOWED_MIME.has(input.mime)) {
    throw new Error('只支持 PNG / JPG / WEBP / GIF / SVG 图片')
  }
  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`图片不能超过 ${Math.round(MAX_FILE_BYTES / 1024)} KB，请压缩后重试`)
  }

  const cos = cosConfig()
  if (cos) {
    const key = newObjectKey(cos.prefix, input.mime)
    const url = await cosPutObject(cos, key, input.buffer, input.mime)
    return { id: key, url, mime: input.mime, size: input.buffer.byteLength }
  }

  if (hasRedis) {
    throw new Error('图片存储未配置：请设置 TENCENT_COS_* 环境变量')
  }

  // 本地内存模式：仅开发调试用，重启即丢
  const id = crypto.randomBytes(12).toString('hex')
  memoryFiles.set(id, {
    id,
    mime: input.mime,
    size: input.buffer.byteLength,
    data: input.buffer.toString('base64'),
    name: input.name?.slice(0, 120),
    createdAt: new Date().toISOString(),
  })
  return { id, url: `/api/files/${id}`, mime: input.mime, size: input.buffer.byteLength }
}

/** 读取旧版图片（Redis 或内存），只读 */
export async function readFile(id: string): Promise<StoredFile | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null
  if (!hasRedis) return memoryFiles.get(id) ?? null

  const raw = await redis().get<StoredFile | string>(`${PREFIX}${id}`)
  if (raw == null) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as StoredFile
    } catch {
      return null
    }
  }
  return raw
}

/** 收集一段数据（任意嵌套对象）里出现的所有旧图片 id */
export function collectLegacyIds(value: unknown): string[] {
  const ids = new Set<string>()
  const text = JSON.stringify(value) ?? ''
  for (const m of text.matchAll(LEGACY_FILE_URL)) ids.add(m[1])
  return [...ids]
}

/**
 * 把对象里所有字符串中的 /api/files/{id} 换成新地址（就地修改）。
 * 也会替换带域名的写法（如 https://xiaojing.keyseal.top/api/files/{id}）。
 * 返回被改动的字符串字段数；没有映射的 id 保持原样。
 */
export function rewriteLegacyUrls(target: unknown, map: Map<string, string>): number {
  let changed = 0
  const fix = (s: string): string =>
    s.replace(/(?:https?:\/\/[^\s"'<>/]+)?\/api\/files\/([a-f0-9]{24})/g, (m, id: string) => map.get(id) ?? m)

  const walk = (node: any): void => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === 'string') {
          const next = fix(node[i])
          if (next !== node[i]) {
            node[i] = next
            changed++
          }
        } else if (node[i] && typeof node[i] === 'object') walk(node[i])
      }
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = node[k]
        if (typeof v === 'string') {
          const next = fix(v)
          if (next !== v) {
            node[k] = next
            changed++
          }
        } else if (v && typeof v === 'object') walk(v)
      }
    }
  }
  walk(target)
  return changed
}
