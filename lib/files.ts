// ────────────────────────────────────────────────────────────────
// 图片存储
//
// 需求文档 §2.1 规划的是阿里云 OSS 直传；本期部署在 Vercel（无状态、
// 文件系统只读），因此改为：图片单独存一个键，不混进整库 JSON，
// 通过 /api/files/{id} 读取。上线接 OSS 时只需替换这一层。
// ────────────────────────────────────────────────────────────────

import crypto from 'crypto'

const PREFIX = 'huangjin:file:'
/** 单张图片上限，前端会先在浏览器里压缩 */
export const MAX_FILE_BYTES = 600 * 1024

export const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

/** 按文件头判断真实图片类型；小程序上传的 Content-Type 不可靠 */
export function sniffImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export interface StoredFile {
  id: string
  mime: string
  size: number
  /** base64 原文 */
  data: string
  name?: string
  createdAt: string
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

export async function saveFile(input: {
  mime: string
  buffer: Buffer
  name?: string
}): Promise<StoredFile> {
  if (!ALLOWED_MIME.has(input.mime)) {
    throw new Error('只支持 PNG / JPG / WEBP / GIF / SVG 图片')
  }
  if (input.buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(`图片不能超过 ${Math.round(MAX_FILE_BYTES / 1024)} KB，请压缩后重试`)
  }

  const file: StoredFile = {
    id: crypto.randomBytes(12).toString('hex'),
    mime: input.mime,
    size: input.buffer.byteLength,
    data: input.buffer.toString('base64'),
    name: input.name?.slice(0, 120),
    createdAt: new Date().toISOString(),
  }

  if (hasRedis) {
    await redis().set(`${PREFIX}${file.id}`, JSON.stringify(file))
  } else {
    memoryFiles.set(file.id, file)
  }
  return file
}

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
