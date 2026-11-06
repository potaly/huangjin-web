// 写入前台用户（按手机号幂等）
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/seed-demo-users.ts --owner-phone=<手机号>              # 试运行，只打印
//   npx tsx --env-file=.env.local scripts/seed-demo-users.ts --owner-phone=<手机号> --yes        # 只创建/补全老板
//   ... --yes --with-demo   额外创建 2 个业务员和 4 个客户演示账号
//   ... --yes --force       允许覆盖已存在用户的角色/状态，并允许把已有用户升为老板
// 已存在的用户默认只补全缺失字段，不改角色和状态。存储为内存模式时不会落盘，脚本直接退出。
import { loadDB, mutate, nextId, storageDriver } from '../lib/store'
import { normalizePhone } from '../lib/mall-user-service'
import type { MallRole, MallUser } from '../lib/types'

const flags = new Set(process.argv.slice(2).filter((a) => !a.includes('=')))
const yes = flags.has('--yes')
const withDemo = flags.has('--with-demo')
const force = flags.has('--force')

const driver = storageDriver()
console.log(`存储：${driver}`)
if (driver === 'memory') {
  console.error('当前为内存存储，写入不会持久化。请配置 .env.local 中的 Redis 后再运行。')
  process.exit(1)
}

const arg = process.argv.find((a) => a.startsWith('--owner-phone='))
if (!arg) throw new Error('请用 --owner-phone=<手机号> 指定老板账号')
const ownerPhone = normalizePhone(arg.split('=')[1])

interface Demo { phone: string; name: string; role: MallRole; sales?: string }
const OWNER: Demo = { phone: ownerPhone, name: '老板', role: 'OWNER' }
const DEMO: Demo[] = [
  { phone: '13800000011', name: '业务员小王', role: 'SALES' },
  { phone: '13800000012', name: '业务员小李', role: 'SALES' },
  { phone: '13800000021', name: '深圳金福珠宝', role: 'CUSTOMER', sales: '13800000011' },
  { phone: '13800000022', name: '广州周记金行', role: 'CUSTOMER', sales: '13800000011' },
  { phone: '13800000023', name: '东莞福满堂', role: 'CUSTOMER', sales: '13800000012' },
  { phone: '13800000024', name: '佛山金玉坊', role: 'CUSTOMER', sales: '13800000012' },
]
const list: Demo[] = withDemo ? [OWNER, ...DEMO] : [OWNER]

async function main() {
  // 试运行只读库（不回写）
  const run: typeof mutate = yes ? mutate : async (fn) => fn(structuredClone(await loadDB()))
  const out = await run((db) => {
    const ts = new Date().toISOString()
    const byPhone = (p: string) => db.mallUser.find((u) => !u.deleted && u.phone === p)
    const lines: string[] = []
    const dry = !yes
    const tag = dry ? '[试运行] ' : ''
    const touched = new Set<string>()

    for (const d of list) {
      const u = byPhone(d.phone)
      if (!u) {
        lines.push(`${tag}新增 ${d.role} ${d.name} ${d.phone}`)
        if (dry) continue
        db.mallUser.push({
          id: nextId(db, 'mallUser'),
          createdAt: ts,
          updatedAt: ts,
          createdBy: 'script',
          phone: d.phone,
          name: d.name,
          role: d.role,
          salesId: null,
          openid: null,
          status: 1,
        } as MallUser)
        touched.add(d.phone)
        continue
      }
      if (u.role !== d.role && d.role === 'OWNER' && !force) {
        lines.push(`警告：${d.phone} 已是 ${u.role}，未加 --force，跳过（不会升为老板）`)
        continue
      }
      const changes: string[] = []
      if (!u.name) { changes.push('补姓名'); if (!dry) u.name = d.name }
      if (force && u.role !== d.role) { changes.push(`角色 ${u.role}→${d.role}`); if (!dry) u.role = d.role }
      if (force && u.status !== 1) { changes.push('启用'); if (!dry) u.status = 1 }
      lines.push(`${tag}已存在 ${u.role} ${u.name} ${d.phone}：${changes.length ? changes.join('、') : '无需改动'}`)
      if (!dry && changes.length) { u.updatedAt = ts; touched.add(d.phone) }
    }

    // 业务员绑定：仅对新建/被修改的客户，且尚未绑定时补全
    for (const d of list) {
      if (!d.sales || !touched.has(d.phone)) continue
      const u = byPhone(d.phone)
      const s = byPhone(d.sales)
      if (u && s && u.role === 'CUSTOMER' && !u.salesId) u.salesId = s.id
    }
    return lines
  })
  out.forEach((l) => console.log(l))
  if (!yes) console.log('以上为试运行，未写入。确认无误后加 --yes 执行。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
