// 把 Redis 里的旧图片（/api/files/{id}）搬到腾讯云 COS，并把数据库里的地址换成 COS 地址
//
// 覆盖所有表：商品主图 / 图集 / 详情富文本、轮播图、公告封面 / 正文、分类图标、系统配置等，
// 只要字符串里出现 /api/files/{id} 都会替换。
//
// 用法（在 huangjin-web 目录下，.env.local 需同时有 Redis 和 TENCENT_COS_* 变量）：
//   npx tsx --env-file=.env.local scripts/migrate-images-to-cos.ts           # 试运行：只统计
//   npx tsx --env-file=.env.local scripts/migrate-images-to-cos.ts --apply   # 上传并改写数据库
//
// 可重复执行：旧图在 COS 上的 key 固定为 huangjin/legacy/{id}.{ext}，重跑只会覆盖同一对象；
// 已改写的地址不再含 /api/files/，不会重复处理。
// Redis 里的旧图片键（huangjin:file:*）不删除，留作备份；/api/files/{id} 仍可读取。

import { loadDB, mutate } from '../lib/store'
import { collectLegacyIds, legacyObjectKey, readFile, rewriteLegacyUrls } from '../lib/files'
import { cosConfig, cosPutObject } from '../lib/cos'
import { addLog } from '../lib/api'
import type { AdminSession } from '../lib/types'

const CONCURRENCY = 6

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++])
    }),
  )
}

async function main() {
  const apply = process.argv.includes('--apply')
  const cos = cosConfig()
  if (!cos) throw new Error('未配置 COS：需要 TENCENT_COS_SECRET_ID / SECRET_KEY / BUCKET / REGION')

  const db0 = await loadDB()
  const ids = collectLegacyIds(db0)
  console.log(`数据库中引用的旧图片：${ids.length} 张`)
  console.log(`目标：${cos.publicUrl}/${cos.prefix}legacy/`)
  if (!ids.length) return
  if (!apply) {
    console.log('\n试运行结束，未上传、未写入。加 --apply 执行。')
    return
  }

  // 1) 上传（不持有数据库锁）
  const map = new Map<string, string>()
  const missing: string[] = []
  const failed: Array<[string, string]> = []
  let done = 0
  await pool(ids, CONCURRENCY, async (id) => {
    try {
      const file = await readFile(id)
      if (!file) {
        missing.push(id)
        return
      }
      const url = await cosPutObject(cos, legacyObjectKey(cos.prefix, id, file.mime), Buffer.from(file.data, 'base64'), file.mime)
      map.set(id, url)
    } catch (e) {
      failed.push([id, e instanceof Error ? e.message : String(e)])
    }
    if (++done % 50 === 0) console.log(`  已处理 ${done}/${ids.length}`)
  })
  console.log(`上传成功 ${map.size} 张；Redis 中找不到 ${missing.length} 张；失败 ${failed.length} 张`)
  failed.slice(0, 10).forEach(([id, msg]) => console.log(`  失败 ${id}：${msg}`))
  if (!map.size) return

  // 2) 一次事务改写地址；找不到 / 失败的保留旧地址，下次重跑再处理
  const changed = await mutate((db) => {
    const n = rewriteLegacyUrls(db, map)
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (a && n) {
      const session: AdminSession = { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }
      addLog(db, session, {
        module: '系统',
        action: '图片迁移到腾讯云 COS',
        requestUri: 'script:migrate-images-to-cos',
        requestBody: { images: map.size, fields: n },
      })
    }
    return n
  })
  console.log(`已改写 ${changed} 个字段`)
  const left = collectLegacyIds(await loadDB()).length
  console.log(left ? `仍有 ${left} 张旧图未迁移（见上方失败/缺失），可重跑本脚本` : '全部旧图地址已换成 COS 地址')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
