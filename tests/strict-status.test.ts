import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strictStatus } from '../lib/api'

test('strictStatus：只有数字 0/1 合法', () => {
  assert.equal(strictStatus(0), 0)
  assert.equal(strictStatus(1), 1)
  for (const v of [null, '', [], false, true, '1', '0', undefined, 2, NaN]) assert.equal(strictStatus(v), null)
})
