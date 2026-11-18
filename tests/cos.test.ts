import test from 'node:test'
import assert from 'node:assert/strict'
import { cosAuthorization, cosConfig } from '../lib/cos'
import {
  collectLegacyIds,
  legacyObjectKey,
  newObjectKey,
  rewriteLegacyUrls,
  saveFile,
} from '../lib/files'

// 期望值由腾讯云官方 SDK cos-nodejs-sdk-v5 的 COS.getAuthorization 用同样输入算出
test('COS 签名与官方 SDK 一致（PUT + 签 host/content-type）', () => {
  const auth = cosAuthorization({
    secretId: 'AKIDtest',
    secretKey: 'secretTEST',
    method: 'PUT',
    pathname: '/huangjin/uploads/202611/ab_c-1.jpg',
    headers: { host: 'huangjin-1259254304.cos.ap-guangzhou.myqcloud.com', 'content-type': 'image/jpeg' },
    start: 1700000000,
    expires: 600,
  })
  assert.equal(
    auth,
    'q-sign-algorithm=sha1&q-ak=AKIDtest&q-sign-time=1700000000;1700000600&q-key-time=1700000000;1700000600' +
      '&q-header-list=content-type;host&q-url-param-list=&q-signature=f6fe04f745168cbedc16360eb0fde3aca4e255f0',
  )
})

test('COS 签名与官方 SDK 一致（带查询参数、需编码的路径）', () => {
  const auth = cosAuthorization({
    secretId: 'AKIDtest',
    secretKey: 'secretTEST',
    method: 'GET',
    pathname: '/huangjin/a b(1).jpg',
    headers: { Host: 'x.cos.ap-guangzhou.myqcloud.com' },
    query: { 'response-content-type': 'image/jpeg', acl: '' },
    start: 1700000000,
    expires: 600,
  })
  assert.match(auth, /q-header-list=host&q-url-param-list=acl;response-content-type&/)
  assert.match(auth, /q-signature=c73711922c662e5c0406ed9e35e8ecd7bda747c7$/)
})

test('cosConfig：缺必填项视为未启用；默认域名与前缀', () => {
  assert.equal(cosConfig({ TENCENT_COS_SECRET_ID: 'a' } as any), null)
  const cfg = cosConfig({
    TENCENT_COS_SECRET_ID: 'id',
    TENCENT_COS_SECRET_KEY: 'key',
    TENCENT_COS_BUCKET: 'huangjin-1259254304',
    TENCENT_COS_REGION: 'ap-guangzhou',
  } as any)!
  assert.equal(cfg.publicUrl, 'https://huangjin-1259254304.cos.ap-guangzhou.myqcloud.com')
  assert.equal(cfg.prefix, 'huangjin/')
  const custom = cosConfig({
    TENCENT_COS_SECRET_ID: 'id',
    TENCENT_COS_SECRET_KEY: 'key',
    TENCENT_COS_BUCKET: 'b',
    TENCENT_COS_REGION: 'r',
    TENCENT_COS_PUBLIC_URL: 'https://img.example.com/',
    TENCENT_COS_PREFIX: '/huangjin/test',
  } as any)!
  assert.equal(custom.publicUrl, 'https://img.example.com')
  assert.equal(custom.prefix, 'huangjin/test/')
})

test('对象 key 都在 huangjin/ 前缀下', () => {
  const key = newObjectKey('huangjin/', 'image/jpeg', new Date('2026-11-10T00:00:00Z'))
  assert.match(key, /^huangjin\/uploads\/202611\/[a-f0-9]{24}\.jpg$/)
  assert.equal(legacyObjectKey('huangjin/', 'a'.repeat(24), 'image/png'), `huangjin/legacy/${'a'.repeat(24)}.png`)
})

test('未配置 COS、无 Redis 时存内存，返回站内地址', async () => {
  const saved = await saveFile({ mime: 'image/png', buffer: Buffer.from('x') })
  assert.equal(saved.url, `/api/files/${saved.id}`)
  await assert.rejects(saveFile({ mime: 'text/plain', buffer: Buffer.from('x') }))
})

test('收集并改写旧图片地址（含富文本与带域名写法）', () => {
  const a = 'a'.repeat(24)
  const b = 'b'.repeat(24)
  const c = 'c'.repeat(24)
  const db = {
    product: [
      {
        cover: `/api/files/${a}`,
        images: [`/api/files/${a}`, `/api/files/${b}`, 'https://cdn.example.com/x.jpg'],
        detailHtml: `<p><img src="/api/files/${b}"><img src="https://xiaojing.keyseal.top/api/files/${c}"></p>`,
      },
    ],
    banner: [{ image: `/api/files/${c}` }],
    seq: { product: 1 },
  }
  assert.deepEqual(collectLegacyIds(db).sort(), [a, b, c])

  const map = new Map([
    [a, 'https://cos/huangjin/legacy/a.jpg'],
    [b, 'https://cos/huangjin/legacy/b.jpg'],
  ])
  const n = rewriteLegacyUrls(db, map)
  assert.equal(n, 4)
  assert.equal(db.product[0].cover, 'https://cos/huangjin/legacy/a.jpg')
  assert.deepEqual(db.product[0].images, [
    'https://cos/huangjin/legacy/a.jpg',
    'https://cos/huangjin/legacy/b.jpg',
    'https://cdn.example.com/x.jpg',
  ])
  // c 没有映射：保留原样，下次重跑再处理
  assert.equal(
    db.product[0].detailHtml,
    `<p><img src="https://cos/huangjin/legacy/b.jpg"><img src="https://xiaojing.keyseal.top/api/files/${c}"></p>`,
  )
  assert.equal(db.banner[0].image, `/api/files/${c}`)
  assert.deepEqual(collectLegacyIds(db), [c])
})
