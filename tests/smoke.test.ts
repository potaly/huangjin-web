import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDB } from './helpers'

test('emptyDB 有 mallUser 表', () => {
  assert.deepEqual(emptyDB().mallUser, [])
})
