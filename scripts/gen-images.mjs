// 生成随仓库部署的本地 SVG 图：分类图标、商品图、轮播图、公告封面、客服二维码
// 用法：node scripts/gen-images.mjs
import fs from 'fs'
import path from 'path'

const OUT = path.join(process.cwd(), 'public', 'img')
fs.mkdirSync(OUT, { recursive: true })

const write = (name, svg) => {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg.trim() + '\n', 'utf8')
  return name
}

const GOLD = '#c9a227'
const GOLD_D = '#8a631d'
const GOLD_L = '#e9c461'
const PT = '#9aa7b4'

/** 商品图统一底板 */
function plate(id, { tint = '#fdf9ed', tint2 = '#f4e6c3', angle = 135 } = {}) {
  const rad = (angle * Math.PI) / 180
  const x2 = (0.5 + Math.cos(rad) / 2).toFixed(3)
  const y2 = (0.5 + Math.sin(rad) / 2).toFixed(3)
  return `
  <defs>
    <linearGradient id="bg${id}" x1="${(1 - x2).toFixed(3)}" y1="${(1 - y2).toFixed(3)}" x2="${x2}" y2="${y2}">
      <stop offset="0" stop-color="${tint}"/>
      <stop offset="1" stop-color="${tint2}"/>
    </linearGradient>
    <linearGradient id="mt${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_L}"/>
      <stop offset=".45" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="${GOLD_D}"/>
    </linearGradient>
    <linearGradient id="pt${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e3e9ef"/>
      <stop offset=".5" stop-color="${PT}"/>
      <stop offset="1" stop-color="#6b7885"/>
    </linearGradient>
    <radialGradient id="vg${id}" cx=".5" cy=".42" r=".72">
      <stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#8a631d" stop-opacity=".14"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg${id})"/>
  <rect width="800" height="800" fill="url(#vg${id})"/>`
}

const label = (styleNo, name) => `
  <g font-family="'PingFang SC','Helvetica Neue',Arial,sans-serif">
    <text x="56" y="722" font-size="30" fill="#8a631d" opacity=".85" letter-spacing="2">${styleNo}</text>
    <text x="56" y="762" font-size="24" fill="#8a631d" opacity=".55">${name}</text>
  </g>`

/** 各类首饰线稿 */
const art = {
  'bracelet-beads': (id) => {
    let s = `<circle cx="400" cy="380" r="190" fill="none" stroke="url(#mt${id})" stroke-width="5" opacity=".45"/>`
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 - Math.PI / 2
      const x = 400 + Math.cos(a) * 190
      const y = 380 + Math.sin(a) * 190
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" fill="url(#mt${id})"/>
      <circle cx="${(x - 10).toFixed(1)}" cy="${(y - 12).toFixed(1)}" r="9" fill="#fff" opacity=".4"/>`
    }
    return s
  },
  'ring-plain': (id) => `
    <ellipse cx="400" cy="400" rx="185" ry="185" fill="none" stroke="url(#mt${id})" stroke-width="46"/>
    <ellipse cx="400" cy="400" rx="185" ry="185" fill="none" stroke="#fff" stroke-width="6" opacity=".35"/>
    <path d="M250 300a200 200 0 0 1 120-78" fill="none" stroke="#fff" stroke-width="16" opacity=".45" stroke-linecap="round"/>`,
  'ring-gem': (id) => `
    <ellipse cx="400" cy="470" rx="170" ry="170" fill="none" stroke="url(#mt${id})" stroke-width="34"/>
    <path d="M400 170l78 74-78 104-78-104z" fill="#eef5fb" stroke="url(#mt${id})" stroke-width="8"/>
    <path d="M322 244h156M400 170v178" stroke="${GOLD}" stroke-width="5" opacity=".7"/>`,
  'necklace-snake': (id) => `
    <path d="M160 230c0 190 80 300 240 300s240-110 240-300" fill="none" stroke="url(#mt${id})" stroke-width="30" stroke-linecap="round"/>
    <path d="M160 230c0 190 80 300 240 300s240-110 240-300" fill="none" stroke="#fff" stroke-width="7" opacity=".4" stroke-linecap="round"/>
    <circle cx="400" cy="568" r="46" fill="url(#mt${id})"/>
    <circle cx="386" cy="552" r="13" fill="#fff" opacity=".45"/>`,
  'necklace-pt': (id) => {
    let s = `<path d="M170 240c0 186 78 292 230 292s230-106 230-292" fill="none" stroke="url(#pt${id})" stroke-width="12"/>`
    for (let i = 0; i <= 22; i++) {
      const t = i / 22
      const x = 170 + 460 * t
      const y = 240 + Math.sin(t * Math.PI) * 300
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="none" stroke="url(#pt${id})" stroke-width="7"/>`
    }
    return s
  },
  'bangle-twist': (id) => {
    let s = `<circle cx="400" cy="400" r="200" fill="none" stroke="url(#mt${id})" stroke-width="54"/>`
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const x1 = 400 + Math.cos(a) * 176
      const y1 = 400 + Math.sin(a) * 176
      const x2 = 400 + Math.cos(a + 0.16) * 224
      const y2 = 400 + Math.sin(a + 0.16) * 224
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-width="7" opacity=".32"/>`
    }
    return s
  },
  'bangle-hollow': (id) => `
    <circle cx="400" cy="400" r="196" fill="none" stroke="url(#mt${id})" stroke-width="72"/>
    <circle cx="400" cy="400" r="196" fill="none" stroke="#fff" stroke-width="10" opacity=".3"/>
    <path d="M248 262a215 215 0 0 1 112-70" fill="none" stroke="#fff" stroke-width="22" opacity=".5" stroke-linecap="round"/>`,
  'pendant-coin': (id) => `
    <circle cx="400" cy="430" r="170" fill="url(#mt${id})"/>
    <circle cx="400" cy="430" r="170" fill="none" stroke="#fff" stroke-width="7" opacity=".35"/>
    <rect x="348" y="378" width="104" height="104" rx="8" fill="#fdf9ed"/>
    <circle cx="400" cy="430" r="132" fill="none" stroke="#fdf9ed" stroke-width="5" opacity=".55"/>
    <path d="M400 190v70" stroke="url(#mt${id})" stroke-width="18" stroke-linecap="round"/>
    <circle cx="400" cy="178" r="34" fill="none" stroke="url(#mt${id})" stroke-width="16"/>`,
  'earring-clover': (id) => {
    const petal = (cx, cy) => `
      <g transform="translate(${cx} ${cy})">
        ${[0, 90, 180, 270]
          .map(
            (d) =>
              `<ellipse cx="0" cy="-52" rx="40" ry="54" fill="url(#mt${id})" transform="rotate(${d})"/>`,
          )
          .join('')}
        <circle cx="0" cy="0" r="22" fill="#fdf9ed"/>
      </g>`
    return `${petal(258, 400)}${petal(542, 400)}`
  },
  'earring-line': (id) => {
    const one = (x) => `
      <circle cx="${x}" cy="208" r="20" fill="url(#mt${id})"/>
      <path d="M${x} 228v300" stroke="url(#mt${id})" stroke-width="9"/>
      <rect x="${x - 46}" y="528" width="92" height="92" rx="10" fill="none" stroke="url(#mt${id})" stroke-width="18" transform="rotate(45 ${x} 574)"/>`
    return `${one(272)}${one(528)}`
  },
  'bar-invest': (id) => `
    <g transform="translate(400 400)">
      <path d="M-230-120L-170-170H170L230-120Z" fill="url(#mt${id})" opacity=".82"/>
      <rect x="-230" y="-120" width="460" height="246" rx="12" fill="url(#mt${id})"/>
      <rect x="-230" y="-120" width="460" height="246" rx="12" fill="none" stroke="#fff" stroke-width="5" opacity=".35"/>
      <text x="0" y="-26" text-anchor="middle" font-family="'PingFang SC',Arial" font-size="56" fill="#fdf9ed" letter-spacing="4">9999</text>
      <text x="0" y="48" text-anchor="middle" font-family="'PingFang SC',Arial" font-size="38" fill="#fdf9ed" opacity=".85">FINE GOLD</text>
      <path d="M-200-104L-120-150" stroke="#fff" stroke-width="14" opacity=".4" stroke-linecap="round"/>
    </g>`,
  'bar-zodiac': (id) => `
    <circle cx="400" cy="400" r="200" fill="url(#mt${id})"/>
    <circle cx="400" cy="400" r="200" fill="none" stroke="#fff" stroke-width="7" opacity=".35"/>
    <circle cx="400" cy="400" r="162" fill="none" stroke="#fdf9ed" stroke-width="5" opacity=".6"/>
    <path d="M400 282l34 72 79 11-57 56 14 78-70-38-70 38 14-78-57-56 79-11z" fill="#fdf9ed" opacity=".92"/>`,
}

const PRODUCTS = [
  ['bracelet-beads', 'SL-2201', '足金999 古法转运珠手链'],
  ['ring-plain', 'RG-1108', '足金9999 素圈光面戒指'],
  ['necklace-snake', 'NK-3305', '18K金 蛇骨锁骨链'],
  ['bangle-twist', 'BG-5501', '足金999 实心麻花手镯'],
  ['bangle-hollow', 'BG-5520', '足金999 空心玻璃珠手镯'],
  ['pendant-coin', 'PD-7701', '足金999 五帝钱转运珠吊坠'],
  ['necklace-pt', 'NK-3390', 'Pt950 铂金素链'],
  ['ring-gem', 'RG-1180', '18K金 群镶莫桑钻戒指'],
  ['earring-clover', 'ER-9901', '足金999 四叶草耳钉'],
  ['bar-invest', 'BR-0101', '足金9999 投资金条'],
  ['bar-zodiac', 'BR-0220', '足金999 生肖马金章'],
  ['earring-line', 'ER-9950', '18K金 几何耳线'],
]

const made = []
for (const [key, styleNo, name] of PRODUCTS) {
  const draw = art[key]
  made.push(
    write(
      key,
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="${name}">
${plate('a')}${draw('a')}${label(styleNo, name)}</svg>`,
    ),
  )
  made.push(
    write(
      `${key}-2`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="${name} 细节图">
${plate('b', { tint: '#ffffff', tint2: '#ede0c4', angle: 45 })}
<g transform="translate(400 400) scale(1.18) translate(-400 -400)">${draw('b')}</g>
${label(styleNo, '细节实拍参考图')}</svg>`,
    ),
  )
}

// ── 分类图标 72x72 ──
const catIcon = (name, inner) =>
  write(
    `cat-${name}`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${GOLD_L}"/><stop offset="1" stop-color="${GOLD_D}"/>
  </linearGradient></defs>
  <rect width="72" height="72" rx="20" fill="#fdf9ed"/>
  ${inner}
</svg>`,
  )

catIcon('necklace', `<path d="M16 22c0 20 9 30 20 30s20-10 20-30" fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="56" r="6" fill="url(#g)"/>`)
catIcon('bracelet', `<circle cx="36" cy="36" r="19" fill="none" stroke="url(#g)" stroke-width="3"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i / 8) * Math.PI * 2; return `<circle cx="${(36 + Math.cos(a) * 19).toFixed(1)}" cy="${(36 + Math.sin(a) * 19).toFixed(1)}" r="5" fill="url(#g)"/>` }).join('')}`)
catIcon('ring', `<circle cx="36" cy="40" r="17" fill="none" stroke="url(#g)" stroke-width="6"/><path d="M36 14l8 8-8 10-8-10z" fill="url(#g)"/>`)
catIcon('earring', `<circle cx="26" cy="20" r="4" fill="url(#g)"/><path d="M26 24v14" stroke="url(#g)" stroke-width="3"/><circle cx="26" cy="46" r="9" fill="none" stroke="url(#g)" stroke-width="4"/><circle cx="48" cy="20" r="4" fill="url(#g)"/><path d="M48 24v14" stroke="url(#g)" stroke-width="3"/><circle cx="48" cy="46" r="9" fill="none" stroke="url(#g)" stroke-width="4"/>`)
catIcon('bar', `<path d="M14 30l6-6h32l6 6z" fill="url(#g)" opacity=".75"/><rect x="14" y="30" width="44" height="22" rx="3" fill="url(#g)"/>`)

// ── 轮播图 1200x600 ──
const banner = (name, title, sub, draw, tint, tint2) =>
  write(
    name,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bb" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${tint2}"/>
    </linearGradient>
    <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD_L}"/><stop offset=".5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_D}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="600" fill="url(#bb)"/>
  <g opacity=".9" transform="translate(880 300) scale(1.5) translate(-400 -400)">${draw}</g>
  <g font-family="'PingFang SC','Helvetica Neue',Arial,sans-serif">
    <text x="80" y="268" font-size="76" font-weight="700" fill="#5b3f14" letter-spacing="4">${title}</text>
    <text x="80" y="340" font-size="38" fill="#7a5a21" opacity=".9" letter-spacing="2">${sub}</text>
    <rect x="80" y="392" width="230" height="68" rx="34" fill="#c9a227"/>
    <text x="195" y="436" font-size="30" fill="#fff" text-anchor="middle" letter-spacing="2">立即咨询</text>
  </g>
</svg>`,
  )

banner('banner-1', '源头工厂 · 按克批发', '足金 / 18K / 铂金 现货充足 · 当日发货',
  `<g transform="scale(.62) translate(240 240)">${art['bangle-twist']('bm0')}</g>`.replace(/url\(#mta\)|url\(#mtbm0\)/g, 'url(#bm)'),
  '#fdf6e3', '#f0dfb6')
banner('banner-2', '古法转运珠 新到货', '6mm / 8mm 两种珠径 · 可按克拼配混批',
  `<g transform="scale(.62) translate(240 240)">${art['bracelet-beads']('bm0')}</g>`.replace(/url\(#mtbm0\)/g, 'url(#bm)'),
  '#fffaf0', '#ecdcb8')
banner('banner-3', '投资金条 现货供应', '10g / 50g / 100g · 独立封装附证书',
  `<g transform="scale(.62) translate(240 240)">${art['bar-invest']('bm0')}</g>`.replace(/url\(#mtbm0\)/g, 'url(#bm)'),
  '#fdf9ed', '#e9d7ad')

// ── 公告封面 ──
write(
  'notice-1',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs><linearGradient id="n" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff7e6"/><stop offset="1" stop-color="#f1e0ba"/></linearGradient></defs>
  <rect width="1200" height="600" fill="url(#n)"/>
  <g font-family="'PingFang SC',Arial" text-anchor="middle">
    <text x="600" y="282" font-size="92" font-weight="700" fill="#8a631d" letter-spacing="8">双节发货安排</text>
    <text x="600" y="368" font-size="40" fill="#a1792c" letter-spacing="4">节前最后一批 9/30 15:00 截单</text>
  </g>
</svg>`,
)

// ── 客服二维码（示意图，上线请在后台替换为真实二维码）──
let qr = ''
const cells = 25
const cell = 400 / cells
// 以固定种子生成确定性图案，保证构建产物稳定
let s0 = 20_261_018
const rnd = () => ((s0 = (s0 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
for (let y = 0; y < cells; y++) {
  for (let x = 0; x < cells; x++) {
    const inFinder =
      (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7)
    if (inFinder) continue
    if (rnd() > 0.52) {
      qr += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="#1f2937"/>`
    }
  }
}
const finder = (fx, fy) => `
  <rect x="${fx}" y="${fy}" width="${(cell * 7).toFixed(2)}" height="${(cell * 7).toFixed(2)}" fill="#1f2937"/>
  <rect x="${(fx + cell).toFixed(2)}" y="${(fy + cell).toFixed(2)}" width="${(cell * 5).toFixed(2)}" height="${(cell * 5).toFixed(2)}" fill="#fff"/>
  <rect x="${(fx + cell * 2).toFixed(2)}" y="${(fy + cell * 2).toFixed(2)}" width="${(cell * 3).toFixed(2)}" height="${(cell * 3).toFixed(2)}" fill="#1f2937"/>`
write(
  'qrcode',
  `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="500" viewBox="0 0 440 500">
  <rect width="440" height="500" rx="20" fill="#fff"/>
  <g transform="translate(20 20)">${qr}${finder(0, 0)}${finder(cell * (cells - 7), 0)}${finder(0, cell * (cells - 7))}</g>
  <text x="220" y="462" text-anchor="middle" font-family="'PingFang SC',Arial" font-size="26" fill="#6b7280">示意图 · 请在后台替换</text>
</svg>`,
)

console.log(`generated ${fs.readdirSync(OUT).length} svg files in public/img`)
