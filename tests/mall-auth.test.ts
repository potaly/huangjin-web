import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addUser, emptyDB } from './helpers'
import { loginRequired, resolveMallUser } from '../lib/mall-auth'

test('登录门槛按系统参数开关', () => {
  const db = emptyDB()
  assert.equal(loginRequired(db), false)
  db.sysConfig.push({ id: 1, createdAt: '', updatedAt: '', configKey: 'mall.login.required', configValue: 'true' })
  assert.equal(loginRequired(db), true)
})

test('resolveMallUser：会话有效且用户启用才返回，以库里最新角色为准', () => {
  const db = emptyDB()
  const u = addUser(db, { phone: '13800000001', role: 'SALES' })
  const session = { uid: u.id, role: 'CUSTOMER' as const, exp: Date.now() + 1000 }
  assert.equal(resolveMallUser(db, session)?.role, 'SALES')
  u.status = 0
  assert.equal(resolveMallUser(db, session), null)
  assert.equal(resolveMallUser(db, null), null)
})
