import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { parseToken } from '../lib/auth'

test('旧格式后台令牌（无 purpose 前缀的 HMAC）仍可解析', () => {
  const payload = { uid: 7, exp: Date.now() + 60_000 }
  const secret = process.env.ADMIN_SESSION_SECRET || 'huangjin-dev-insecure-secret'
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  assert.deepEqual(parseToken(`${body}.${mac}`), payload)
})
