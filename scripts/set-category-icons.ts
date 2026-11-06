// 切换一级分类图标：默认商品实拍图，--line 切回古铜线条图标
// 先部署包含新图标文件的版本，再执行本脚本，否则前台会短暂显示裂图。
//
// 用法（在 huangjin-web 目录下）：
//   npx tsx --env-file=.env.local scripts/set-category-icons.ts          # 实拍图
//   npx tsx --env-file=.env.local scripts/set-category-icons.ts --line   # 线条图标

import { mutate } from '../lib/store'
import { addLog } from '../lib/api'

// 默认使用商品实拍分类图（public/img/cat-photo-*.png，由 scripts/category-photo/ 下的工具从微购相册商品图抠图生成）；
// 加 --line 参数切回古铜线条图标（public/img/icon-cat-*.svg）
const STYLE = process.argv.includes('--line') ? 'line' : 'photo'
const KEYS: Record<string, string> = {
  项链吊坠: 'necklace',
  手镯手链: 'bracelet',
  戒指: 'ring',
  耳饰: 'earring',
  系列套装: 'set',
}
const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(KEYS).map(([name, key]) => [
    name,
    STYLE === 'line' ? `/img/icon-cat-${key}.svg` : `/img/cat-photo-${key}.png`,
  ]),
)

async function main() {
  const changes = await mutate((db) => {
    const a = db.sysAdmin.find((x) => !x.deleted && x.roleCode === 'SUPER' && x.status === 1)
    if (!a) throw new Error('找不到可用的超级管理员')
    const ts = new Date().toISOString()
    const by = 'script:set-category-icons'
    const out: string[] = []
    for (const c of db.category) {
      if (c.deleted || c.parentId !== 0) continue
      const icon = ICONS[c.name]
      if (!icon || c.icon === icon) continue
      out.push(`${c.name}: ${c.icon ?? '(无)'} → ${icon}`)
      c.icon = icon
      c.updatedAt = ts
      c.updatedBy = by
    }
    addLog(db, { id: a.id, username: a.username, realName: a.realName, roleCode: a.roleCode, exp: 0 }, {
      module: '商品分类', action: '更换一级分类图标', requestUri: by, requestBody: { count: out.length },
    })
    return out
  })
  console.log(changes.length ? changes.join('\n') : '没有需要更新的分类')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
