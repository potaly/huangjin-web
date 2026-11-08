import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDB } from './helpers'
import { listConfigs, queryOperationLogs, saveConfigs } from '../lib/config-service'
import type { AdminSession, OperationLog } from '../lib/types'

const actor: AdminSession = { id: 1, username: 'mall:1', realName: '老板（小程序）', roleCode: 'OPERATOR', exp: 0 }

test('saveConfigs：新增和更新，返回保存数量，listConfigs 按 key 排序', () => {
  const db = emptyDB()
  assert.equal(saveConfigs(db, [{ configKey: 'b.key', configValue: '1' }, { configKey: 'a.key', configValue: '2' }], actor), 2)
  assert.deepEqual(listConfigs(db).map((c) => c.configKey), ['a.key', 'b.key'])
  assert.equal(saveConfigs(db, [{ configKey: 'a.key', configValue: '9' }], actor), 1)
  assert.equal(db.sysConfig.length, 2)
  const a = db.sysConfig.find((c) => c.configKey === 'a.key')!
  assert.equal(a.configValue, '9')
  assert.equal(a.updatedBy, 'mall:1')
})

test('saveConfigs：空 key 跳过不计数，值截断 2000', () => {
  const db = emptyDB()
  assert.equal(saveConfigs(db, [{ configKey: ' ', configValue: 'x' }, { configKey: 'k', configValue: 'y'.repeat(2500) }], actor), 1)
  assert.equal(db.sysConfig[0].configValue.length, 2000)
})

test('saveConfigs：stock.display.mode 只能是 EXACT 或 LEVEL', () => {
  const db = emptyDB()
  assert.throws(() => saveConfigs(db, [{ configKey: 'stock.display.mode', configValue: 'X' }], actor), /EXACT 或 LEVEL/)
  assert.equal(saveConfigs(db, [{ configKey: 'stock.display.mode', configValue: 'LEVEL' }], actor), 1)
})

test('saveConfigs：空 items 报错', () => {
  assert.throws(() => saveConfigs(emptyDB(), [], actor), /没有需要保存的参数/)
})

function log(id: number, module: string, adminName: string, action: string, uri: string): OperationLog {
  return { id, createdAt: '', updatedAt: '', adminId: 1, adminName, module, action, requestUri: uri, requestBody: '' }
}

test('queryOperationLogs：关键词和模块筛选，modules 为全量去重', () => {
  const db = emptyDB()
  db.sysOperationLog.push(
    log(1, '商品', '张三', '新增', '/api/a'),
    log(2, '系统参数', '李四', '保存', '/api/b'),
    log(3, '商品', '李四', '批量上架', '/api/c'),
  )
  const all = queryOperationLogs(db, new URL('http://x/y'))
  assert.equal(all.records.length, 3)
  assert.deepEqual(all.modules, ['商品', '系统参数'])
  const kw = queryOperationLogs(db, new URL('http://x/y?keyword=李四'))
  assert.deepEqual(kw.records.map((l) => l.id), [2, 3])
  const mod = queryOperationLogs(db, new URL('http://x/y?module=商品&keyword=/api/c'))
  assert.deepEqual(mod.records.map((l) => l.id), [3])
  assert.deepEqual(mod.modules, ['商品', '系统参数'])
})
