import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hitLimit } from '../lib/rate-limit'

test('窗口内超过次数被限流，窗口过后恢复', () => {
  const key = `k-${Math.random()}`
  for (let i = 0; i < 3; i++) assert.equal(hitLimit(key, 3, 1000, 0), false)
  assert.equal(hitLimit(key, 3, 1000, 10), true)
  assert.equal(hitLimit(key, 3, 1000, 2000), false)
})
