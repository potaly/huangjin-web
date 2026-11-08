import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sniffImageMime } from '../lib/files'

test('sniffImageMime：按文件头识别', () => {
  assert.equal(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg')
  assert.equal(sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(sniffImageMime(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp')
})

test('sniffImageMime：SVG、GIF 和其他内容返回 null', () => {
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null)
  assert.equal(sniffImageMime(Buffer.from('GIF89a')), null)
  assert.equal(sniffImageMime(Buffer.from([])), null)
})
