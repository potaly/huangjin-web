import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signToken, verifyToken } from '../lib/sign'

test('签发后可校验并取回载荷', () => {
  const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, 'mall')
  assert.equal(verifyToken<{ uid: number; exp: number }>(t, 'mall')?.uid, 1)
})

test('purpose 不同则校验失败', () => {
  const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, 'mall')
  assert.equal(verifyToken(t, 'wxbind'), null)
  assert.equal(verifyToken(t), null)
})

test('篡改载荷校验失败', () => {
  const t = signToken({ uid: 1, exp: Date.now() + 60_000 }, 'mall')
  const [, mac] = t.split('.')
  const forged = Buffer.from(JSON.stringify({ uid: 2, exp: Date.now() + 60_000 })).toString('base64url')
  assert.equal(verifyToken(`${forged}.${mac}`, 'mall'), null)
})

test('过期令牌校验失败', () => {
  const t = signToken({ uid: 1, exp: Date.now() - 1 }, 'mall')
  assert.equal(verifyToken(t, 'mall'), null)
})

test('空值与格式错误返回 null', () => {
  assert.equal(verifyToken(undefined), null)
  assert.equal(verifyToken('abc'), null)
})
