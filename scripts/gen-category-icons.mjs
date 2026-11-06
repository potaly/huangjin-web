// 生成首页一级分类图标（古铜单色线条 + 香槟底块，与前台香槟金色板一致）
// 用法：node scripts/gen-category-icons.mjs
// 输出 public/img/icon-cat-*.svg；文件名与旧版 cat-*.svg 不同，避免小程序 / 浏览器读到缓存的旧图
import fs from 'fs'
import path from 'path'

const OUT = path.join(process.cwd(), 'public', 'img')
fs.mkdirSync(OUT, { recursive: true })

const INK = '#8c6b3b' // gold-600
const TILE = '#f3ece2'

const icon = (name, label, inner) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="${label}">
  <rect width="72" height="72" rx="20" fill="${TILE}"/>
  <g fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>
`
  fs.writeFileSync(path.join(OUT, `icon-cat-${name}.svg`), svg, 'utf8')
  return `icon-cat-${name}.svg`
}

const made = [
  // 项链吊坠：链条弧线 + 菱形吊坠
  icon('necklace', '项链吊坠', `<path d="M20 18c0 16 7 24 16 24s16-8 16-24"/>
    <path d="M36 42v4"/>
    <path d="M36 47l6 7-6 8-6-8z"/>`),
  // 手镯手链：粗细双圈 + 顶部一颗珠
  icon('bracelet', '手镯手链', `<circle cx="36" cy="36" r="16"/>
    <circle cx="36" cy="36" r="11" stroke-width="1.5" opacity=".55"/>
    <circle cx="36" cy="20" r="3.5" fill="${INK}" stroke="none"/>`),
  // 戒指：戒圈 + 上方镶石（避免像电源 / 刷新图标）
  icon('ring', '戒指', `<ellipse cx="36" cy="44" rx="15" ry="13"/>
    <path d="M29 24h14l4 5-11 9-11-9z"/>
    <path d="M25 29h22" stroke-width="1.5"/>`),
  // 耳饰：一对耳钉 + 水滴坠
  icon('earring', '耳饰', `<circle cx="26" cy="22" r="3.5" fill="${INK}" stroke="none"/>
    <circle cx="46" cy="22" r="3.5" fill="${INK}" stroke="none"/>
    <path d="M26 26v6M46 26v6" stroke-width="2.5"/>
    <path d="M26 33c6 0 8 6 8 11a8 8 0 01-16 0c0-5 2-11 8-11z"/>
    <path d="M46 33c6 0 8 6 8 11a8 8 0 01-16 0c0-5 2-11 8-11z"/>`),
  // 系列套装：礼盒
  icon('set', '系列套装', `<rect x="18" y="30" width="36" height="24" rx="3"/>
    <rect x="16" y="24" width="40" height="8" rx="2"/>
    <path d="M36 24v30"/>
    <path d="M36 24c-3-7-12-8-11-2 1 4 8 3 11 2zM36 24c3-7 12-8 11-2-1 4-8 3-11 2z" stroke-width="2.5"/>`),
]

console.log('已生成：' + made.join('、'))
