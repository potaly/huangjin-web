import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addUser, emptyDB } from './helpers'
import {
  createUser, listUsers, loginByOpenid, loginByPhone, normalizePhone, updateUser, userView,
} from '../lib/mall-user-service'
import { BizError } from '../lib/api'

test('手机号规范化', () => {
  assert.equal(normalizePhone(' 138-0000 0001 '), '13800000001')
  assert.throws(() => normalizePhone('12345'), BizError)
})

test('白名单外手机号不能登录', () => {
  const db = emptyDB()
  assert.throws(() => loginByPhone(db, '13800000001'), /未开通/)
})

test('停用用户不能登录', () => {
  const db = emptyDB()
  addUser(db, { phone: '13800000001', role: 'CUSTOMER', status: 0 })
  assert.throws(() => loginByPhone(db, '13800000001'), /已停用/)
})

test('手机号登录并绑定 openid，openid 从旧用户转移', () => {
  const db = emptyDB()
  const a = addUser(db, { phone: '13800000001', role: 'CUSTOMER', openid: 'wx1' })
  const b = addUser(db, { phone: '13800000002', role: 'CUSTOMER' })
  const u = loginByPhone(db, '13800000002', 'wx1')
  assert.equal(u.id, b.id)
  assert.equal(b.openid, 'wx1')
  assert.equal(a.openid, null)
  assert.ok(b.lastLoginAt)
})

test('openid 登录只认启用用户', () => {
  const db = emptyDB()
  const a = addUser(db, { phone: '13800000001', role: 'CUSTOMER', openid: 'wx1' })
  assert.equal(loginByOpenid(db, 'wx1')?.id, a.id)
  a.status = 0
  assert.equal(loginByOpenid(db, 'wx1'), null)
  assert.equal(loginByOpenid(db, 'nobody'), null)
})

test('新增用户：手机号唯一、客户只能绑业务员', () => {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER' })
  const sales = addUser(db, { phone: '13800000011', role: 'SALES' })
  const c = createUser(db, owner, { phone: '13800000021', name: '客户甲', role: 'CUSTOMER', salesId: sales.id })
  assert.equal(c.salesId, sales.id)
  assert.throws(() => createUser(db, owner, { phone: '13800000021', name: '重复', role: 'CUSTOMER' }), /已存在/)
  assert.throws(
    () => createUser(db, owner, { phone: '13800000022', name: 'x', role: 'CUSTOMER', salesId: owner.id }),
    /业务员/,
  )
})

test('只有老板能新增和修改用户', () => {
  const db = emptyDB()
  const sales = addUser(db, { phone: '13800000011', role: 'SALES' })
  assert.throws(() => createUser(db, sales, { phone: '13800000021', name: 'x', role: 'CUSTOMER' }), /权限/)
})

test('老板不能停用自己或改自己角色；业务员名下有客户时不能改角色', () => {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER' })
  const sales = addUser(db, { phone: '13800000011', role: 'SALES' })
  addUser(db, { phone: '13800000021', role: 'CUSTOMER', salesId: sales.id })
  assert.throws(() => updateUser(db, owner, owner.id, { status: 0 }), /自己/)
  assert.throws(() => updateUser(db, owner, owner.id, { role: 'SALES' }), /自己/)
  assert.throws(() => updateUser(db, owner, sales.id, { role: 'CUSTOMER' }), /名下还有 1 个客户/)
  const u = updateUser(db, owner, sales.id, { name: '小王' })
  assert.equal(u.name, '小王')
})

test('列表可见范围：老板全部，业务员只看自己的客户', () => {
  const db = emptyDB()
  const owner = addUser(db, { phone: '13800000000', role: 'OWNER' })
  const s1 = addUser(db, { phone: '13800000011', role: 'SALES' })
  const s2 = addUser(db, { phone: '13800000012', role: 'SALES' })
  addUser(db, { phone: '13800000021', role: 'CUSTOMER', salesId: s1.id })
  addUser(db, { phone: '13800000022', role: 'CUSTOMER', salesId: s2.id })
  assert.equal(listUsers(db, owner).length, 5)
  const mine = listUsers(db, s1)
  assert.equal(mine.length, 1)
  assert.equal(mine[0].phone, '13800000021')
  assert.equal(listUsers(db, owner, 'SALES').length, 2)
})

test('userView 带业务员姓名与角色名', () => {
  const db = emptyDB()
  const s = addUser(db, { phone: '13800000011', role: 'SALES', name: '小王' })
  const c = addUser(db, { phone: '13800000021', role: 'CUSTOMER', salesId: s.id, openid: 'wx' })
  const v = userView(db, c)
  assert.equal(v.salesName, '小王')
  assert.equal(v.roleLabel, '客户')
  assert.equal(v.wxBound, true)
})
