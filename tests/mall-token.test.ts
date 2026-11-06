import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBindTicket, createMallToken, parseBindTicket, parseMallToken } from '../lib/mall-token'
import { createToken } from '../lib/auth'

test('前台令牌往返', () => {
  const s = parseMallToken(createMallToken(7, 'CUSTOMER'))
  assert.equal(s?.uid, 7)
  assert.equal(s?.role, 'CUSTOMER')
  assert.ok(s!.exp > Date.now() + 29 * 24 * 3600 * 1000)
})

test('后台令牌不能当前台令牌用', () => {
  const admin = createToken({ id: 1, username: 'admin', realName: 'a', roleCode: 'SUPER' })
  assert.equal(parseMallToken(admin), null)
})

test('绑定凭证往返，且不能当登录令牌', () => {
  const t = createBindTicket('openid-x')
  assert.equal(parseBindTicket(t), 'openid-x')
  assert.equal(parseMallToken(t), null)
})
