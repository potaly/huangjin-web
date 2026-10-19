// ────────────────────────────────────────────────────────────────
// 种子数据：首次启动时写入，便于直接浏览与演示
// 商品图使用随仓库一起部署的本地 SVG，避免外链图失效
// ────────────────────────────────────────────────────────────────

import type {
  Admin, Banner, Category, Config, DB, Material, Notice, Product, Sku, StockLog,
} from './types'
import { hashPassword } from './auth'

const now = () => new Date().toISOString()

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

function daysLater(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString()
}

const img = (name: string) => `/img/${name}.svg`

export async function buildSeedDB(): Promise<DB> {
  const ts = now()
  const seq: Record<string, number> = {}

  const base = (id: number, createdAt = ts) => ({
    id,
    createdAt,
    updatedAt: createdAt,
    createdBy: 'system',
    updatedBy: 'system',
    deleted: false,
  })

  // ── 管理员 ──────────────────────────────────────────────────
  const adminPassword = process.env.INIT_ADMIN_PASSWORD || 'admin123456'
  const sysAdmin: Admin[] = [
    {
      ...base(1001),
      username: process.env.INIT_ADMIN_USERNAME || 'admin',
      password: hashPassword(adminPassword),
      realName: '超级管理员',
      phone: '13800000000',
      roleCode: 'SUPER',
      status: 1,
    },
    {
      ...base(1002),
      username: 'operator',
      password: hashPassword('operator123'),
      realName: '运营小李',
      phone: '13800000001',
      roleCode: 'OPERATOR',
      status: 1,
    },
    {
      ...base(1003),
      username: 'warehouse',
      password: hashPassword('warehouse123'),
      realName: '仓库老张',
      phone: '13800000002',
      roleCode: 'WAREHOUSE',
      status: 1,
    },
  ]
  seq.sysAdmin = 1003

  // ── 系统参数（§5.3）────────────────────────────────────────
  const configDefs: Array<[string, string, string]> = [
    ['stock.display.mode', 'EXACT', '前台库存展示：EXACT 精确克数 / LEVEL 充足、少量、售罄'],
    ['contact.phone', '400-888-6688', '客服电话'],
    ['contact.wechat', 'goldwholesale88', '客服微信号'],
    ['contact.wechat.qrcode', img('qrcode'), '客服微信二维码图片'],
    ['contact.work.time', '周一至周六 9:00–18:00', '工作时间'],
    ['company.address', '深圳市罗湖区水贝珠宝大厦 18 楼 1801', '公司地址'],
    ['site.name', '金源首饰批发', '站点名称'],
    ['site.slogan', '源头工厂 · 按克批发 · 当日发货', '站点标语'],
    ['order.pay.timeout.minutes', '30', '【二期】待支付超时自动取消（分钟）'],
    ['order.auto.confirm.days', '7', '【二期】发货后自动确认收货（天）'],
    ['order.weigh.tolerance.percent', '0', '【二期】实际克数超出预估的容差比例'],
    ['price.allow.order.without.today', 'false', '【二期】当天未录入金价是否允许下单'],
  ]
  const sysConfig: Config[] = configDefs.map(([configKey, configValue, remark], i) => ({
    ...base(2001 + i),
    configKey,
    configValue,
    remark,
  }))
  seq.sysConfig = 2000 + configDefs.length

  // ── 材质字典（§3.2 初始数据）────────────────────────────────
  const materialDefs: Array<[string, string, string]> = [
    ['AU999', '足金999', '999‰'],
    ['AU9999', '足金9999', '9999‰'],
    ['AU750', '18K金（Au750）', '750‰'],
    ['PT950', 'Pt950铂金', '950‰'],
  ]
  const goldMaterial: Material[] = materialDefs.map(([code, name, purity], i) => ({
    ...base(3001 + i),
    code,
    name,
    purity,
    sort: (i + 1) * 10,
    status: 1,
  }))
  seq.goldMaterial = 3000 + materialDefs.length
  const M = (code: string) => goldMaterial.find((m) => m.code === code)!.id

  // ── 分类（两级）─────────────────────────────────────────────
  const category: Category[] = []
  let catId = 4000
  const catTree: Array<[string, string, string[]]> = [
    ['项链吊坠', 'necklace', ['素金项链', '转运珠吊坠', '锁骨链']],
    ['手镯手链', 'bracelet', ['实心手镯', '空心手镯', '转运珠手链']],
    ['戒指', 'ring', ['素圈戒指', '镶嵌戒指', '对戒']],
    ['耳饰', 'earring', ['耳钉', '耳环', '耳线']],
    ['金条金章', 'bar', ['投资金条', '生肖金章']],
  ]
  const catIdByName: Record<string, number> = {}
  catTree.forEach(([name, icon, children], i) => {
    const parentId = ++catId
    category.push({ ...base(parentId), parentId: 0, name, icon: img(`cat-${icon}`), sort: (i + 1) * 10, status: 1 })
    catIdByName[name] = parentId
    children.forEach((child, j) => {
      const cid = ++catId
      category.push({ ...base(cid), parentId, name: child, sort: (j + 1) * 10, status: 1 })
      catIdByName[child] = cid
    })
  })
  seq.category = catId

  // ── 商品与 SKU ──────────────────────────────────────────────
  const product: Product[] = []
  const productSku: Sku[] = []
  const stockLog: StockLog[] = []
  let pid = 5000
  let sid = 6000
  let logId = 7000

  interface SeedSku {
    spec: string
    refWeight?: number
    refQty?: number
    stock: number
    warn: number
  }
  interface SeedProduct {
    name: string
    styleNo: string
    category: string
    material: string
    image: string
    purity: string
    sizeDesc: string
    attrs: Array<[string, string]>
    detail: string
    recommend?: boolean
    status?: 0 | 1
    skus: SeedSku[]
  }

  const seedProducts: SeedProduct[] = [
    {
      name: '足金999 古法转运珠手链',
      styleNo: 'SL-2201',
      category: '转运珠手链',
      material: 'AU999',
      image: 'bracelet-beads',
      purity: '999‰',
      sizeDesc: '手围 15–17cm 可调',
      attrs: [['工艺', '古法哑光'], ['珠径', '6mm'], ['适用人群', '女士']],
      detail: '古法工艺哑光转运珠，颗颗手工打磨，可按克拼配。适合日常佩戴与节庆赠礼，量大可定制珠径。',
      recommend: true,
      skus: [
        { spec: '6mm · 8 珠', refWeight: 3.6, refQty: 120, stock: 1250.36, warn: 300 },
        { spec: '8mm · 8 珠', refWeight: 5.8, refQty: 86, stock: 860.5, warn: 300 },
      ],
    },
    {
      name: '足金9999 素圈光面戒指',
      styleNo: 'RG-1108',
      category: '素圈戒指',
      material: 'AU9999',
      image: 'ring-plain',
      purity: '9999‰',
      sizeDesc: '圈口 10–20 号',
      attrs: [['工艺', '镜面抛光'], ['宽度', '2.5mm'], ['可改圈口', '支持']],
      detail: '9999 足金素圈，镜面抛光，男女同款。支持按圈口分拣发货，批量采购可刻字。',
      recommend: true,
      skus: [
        { spec: '圈口 12', refWeight: 2.8, refQty: 150, stock: 420.0, warn: 100 },
        { spec: '圈口 14', refWeight: 3.1, refQty: 130, stock: 403.1, warn: 100 },
        { spec: '圈口 16', refWeight: 3.4, refQty: 90, stock: 306.0, warn: 100 },
        { spec: '圈口 18', refWeight: 3.7, refQty: 20, stock: 74.0, warn: 100 },
      ],
    },
    {
      name: '18K金 蛇骨锁骨链',
      styleNo: 'NK-3305',
      category: '锁骨链',
      material: 'AU750',
      image: 'necklace-snake',
      purity: '750‰',
      sizeDesc: '长度 40cm + 5cm 延长链',
      attrs: [['颜色', '玫瑰金 / 白金 / 黄金'], ['链宽', '1.2mm'], ['扣型', 'O 字扣']],
      detail: '18K 蛇骨链，柔韧顺滑不易打结，三色可选。适合搭配吊坠，支持按色分单。',
      recommend: true,
      skus: [
        { spec: '黄金色 · 40cm', refWeight: 2.2, refQty: 160, stock: 352.0, warn: 80 },
        { spec: '玫瑰金色 · 40cm', refWeight: 2.2, refQty: 110, stock: 242.0, warn: 80 },
        { spec: '白金色 · 40cm', refWeight: 2.2, refQty: 30, stock: 66.0, warn: 80 },
      ],
    },
    {
      name: '足金999 实心麻花手镯',
      styleNo: 'BG-5501',
      category: '实心手镯',
      material: 'AU999',
      image: 'bangle-twist',
      purity: '999‰',
      sizeDesc: '内径 56 / 58 / 60mm',
      attrs: [['工艺', '麻花拉丝'], ['开口', '活口可微调'], ['适用人群', '女士']],
      detail: '实心麻花手镯，份量足、不易变形，婚庆与长辈礼首选。按克计价，现货充足。',
      recommend: true,
      skus: [
        { spec: '内径 56mm', refWeight: 18.5, refQty: 40, stock: 740.0, warn: 200 },
        { spec: '内径 58mm', refWeight: 19.8, refQty: 45, stock: 891.0, warn: 200 },
        { spec: '内径 60mm', refWeight: 21.2, refQty: 25, stock: 530.0, warn: 200 },
      ],
    },
    {
      name: '足金999 空心玻璃珠手镯',
      styleNo: 'BG-5520',
      category: '空心手镯',
      material: 'AU999',
      image: 'bangle-hollow',
      purity: '999‰',
      sizeDesc: '内径 58mm',
      attrs: [['工艺', '电铸空心'], ['份量', '轻克重'], ['适用人群', '年轻女士']],
      detail: '电铸空心工艺，视觉饱满而克重轻，适合预算型与年轻客群，走量款。',
      skus: [
        { spec: '内径 58mm · 窄版', refWeight: 4.2, refQty: 200, stock: 840.0, warn: 150 },
        { spec: '内径 58mm · 宽版', refWeight: 6.5, refQty: 120, stock: 780.0, warn: 150 },
      ],
    },
    {
      name: '足金999 五帝钱转运珠吊坠',
      styleNo: 'PD-7701',
      category: '转运珠吊坠',
      material: 'AU999',
      image: 'pendant-coin',
      purity: '999‰',
      sizeDesc: '直径 12mm',
      attrs: [['题材', '五帝钱'], ['工艺', '古法做旧'], ['是否含链', '不含链']],
      detail: '古法做旧五帝钱吊坠，寓意招财纳福，单只起批，可搭配各类素链销售。',
      recommend: true,
      skus: [{ spec: '直径 12mm', refWeight: 1.8, refQty: 300, stock: 540.0, warn: 120 }],
    },
    {
      name: 'Pt950 铂金素链',
      styleNo: 'NK-3390',
      category: '素金项链',
      material: 'PT950',
      image: 'necklace-pt',
      purity: '950‰',
      sizeDesc: '长度 45cm',
      attrs: [['链型', '十字链'], ['链宽', '1.0mm'], ['扣型', '龙虾扣']],
      detail: 'Pt950 铂金素链，色泽冷白、亲肤不过敏，婚戒搭配款。现货少量，建议提前预订。',
      skus: [
        { spec: '45cm · 1.0mm', refWeight: 3.2, refQty: 25, stock: 80.0, warn: 100 },
      ],
    },
    {
      name: '18K金 群镶莫桑钻戒指',
      styleNo: 'RG-1180',
      category: '镶嵌戒指',
      material: 'AU750',
      image: 'ring-gem',
      purity: '750‰',
      sizeDesc: '圈口 11–18 号',
      attrs: [['主石', '莫桑钻 3mm'], ['镶嵌', '爪镶'], ['证书', '可配 GRA']],
      detail: '18K 群镶莫桑钻戒指，火彩接近天然钻，性价比高。空托按克计价，石料另计。',
      skus: [
        { spec: '圈口 12 · 玫瑰金', refWeight: 2.6, refQty: 60, stock: 156.0, warn: 60 },
        { spec: '圈口 14 · 玫瑰金', refWeight: 2.8, refQty: 55, stock: 154.0, warn: 60 },
      ],
    },
    {
      name: '足金999 四叶草耳钉',
      styleNo: 'ER-9901',
      category: '耳钉',
      material: 'AU999',
      image: 'earring-clover',
      purity: '999‰',
      sizeDesc: '直径 6mm',
      attrs: [['题材', '四叶草'], ['耳针', '足金耳针'], ['规格', '一对'] ],
      detail: '四叶草造型耳钉，轻克重好出货，学生与年轻白领客群热销款。',
      recommend: true,
      skus: [
        { spec: '6mm · 一对', refWeight: 1.2, refQty: 400, stock: 480.0, warn: 100 },
        { spec: '8mm · 一对', refWeight: 1.8, refQty: 150, stock: 270.0, warn: 100 },
      ],
    },
    {
      name: '足金9999 投资金条',
      styleNo: 'BR-0101',
      category: '投资金条',
      material: 'AU9999',
      image: 'bar-invest',
      purity: '9999‰',
      sizeDesc: '10g / 20g / 50g / 100g',
      attrs: [['类型', '投资金条'], ['包装', '独立封装 + 证书'], ['回购', '支持'] ],
      detail: '9999 投资金条，独立封装附证书，支持原厂回购。大额采购可预约提货。',
      skus: [
        { spec: '10g 条', refWeight: 10, refQty: 100, stock: 1000.0, warn: 200 },
        { spec: '50g 条', refWeight: 50, refQty: 40, stock: 2000.0, warn: 200 },
        { spec: '100g 条', refWeight: 100, refQty: 12, stock: 1200.0, warn: 200 },
      ],
    },
    {
      name: '足金999 生肖马金章',
      styleNo: 'BR-0220',
      category: '生肖金章',
      material: 'AU999',
      image: 'bar-zodiac',
      purity: '999‰',
      sizeDesc: '直径 25mm',
      attrs: [['题材', '生肖马'], ['工艺', '浮雕'], ['包装', '礼盒']],
      detail: '生肖主题金章，浮雕工艺立体感强，礼盒装适合年节渠道。',
      skus: [{ spec: '5g 章', refWeight: 5, refQty: 0, stock: 0, warn: 50 }],
    },
    {
      name: '18K金 几何耳线（下架待补货）',
      styleNo: 'ER-9950',
      category: '耳线',
      material: 'AU750',
      image: 'earring-line',
      purity: '750‰',
      sizeDesc: '长度 55mm',
      attrs: [['风格', '极简几何'], ['规格', '一对']],
      detail: '几何造型耳线，设计款小单试销中，暂时下架待补货。',
      status: 0,
      skus: [{ spec: '55mm · 一对', refWeight: 1.4, refQty: 0, stock: 0, warn: 40 }],
    },
  ]

  seedProducts.forEach((sp, i) => {
    const id = ++pid
    const createdAt = daysAgo(seedProducts.length - i)
    product.push({
      ...base(id, createdAt),
      name: sp.name,
      styleNo: sp.styleNo,
      categoryId: catIdByName[sp.category],
      materialId: M(sp.material),
      cover: img(sp.image),
      images: [img(sp.image), img(`${sp.image}-2`)],
      purity: sp.purity,
      sizeDesc: sp.sizeDesc,
      attrs: sp.attrs.map(([name, value]) => ({ name, value })),
      detailHtml: `<p>${sp.detail}</p><p><strong>批发说明：</strong>按克计价、按克发货，支持混批。具体价格请联系客服。</p>`,
      isRecommend: Boolean(sp.recommend),
      status: sp.status ?? 1,
      sort: (i + 1) * 10,
      laborFeePerG: null,
      extraFeePerG: null,
    })

    sp.skus.forEach((ss, j) => {
      const skuId = ++sid
      productSku.push({
        ...base(skuId, createdAt),
        productId: id,
        skuCode: `${sp.styleNo}-${String(j + 1).padStart(2, '0')}`,
        specName: ss.spec,
        refWeight: ss.refWeight ?? null,
        refQty: ss.refQty ?? null,
        stockWeight: ss.stock,
        lockedWeight: 0,
        warnWeight: ss.warn,
        minOrderWeight: null,
        stepWeight: null,
        status: 1,
        version: 0,
      })

      if (ss.stock > 0) {
        stockLog.push({
          ...base(++logId, createdAt),
          skuId,
          productId: id,
          productName: sp.name,
          skuCode: `${sp.styleNo}-${String(j + 1).padStart(2, '0')}`,
          specName: ss.spec,
          type: 'IN',
          changeWeight: ss.stock,
          beforeWeight: 0,
          afterWeight: ss.stock,
          refNo: `INIT-${sp.styleNo}`,
          reason: '商品建档初始入库',
          operator: '超级管理员',
        })
      }
    })
  })
  seq.product = pid
  seq.productSku = sid
  seq.stockLog = logId

  // ── 公告 ────────────────────────────────────────────────────
  const notice: Notice[] = [
    {
      ...base(8001, daysAgo(1)),
      title: '国庆中秋双节发货安排',
      cover: img('notice-1'),
      contentHtml:
        '<p>双节期间仓库发货安排如下：</p><ul><li>10 月 1 日至 10 月 3 日：仅接单，不发货</li><li>10 月 4 日起：按下单顺序正常发货</li></ul><p>节前最后一批发货时间为 9 月 30 日 15:00，请各位客户提前安排订货。</p>',
      isTop: true,
      isPopup: true,
      status: 1,
      publishAt: daysAgo(1),
      expireAt: daysLater(30),
    },
    {
      ...base(8002, daysAgo(3)),
      title: '新到古法转运珠系列，现货充足',
      contentHtml:
        '<p>古法哑光转运珠系列已到货，6mm / 8mm 两种珠径现货充足，可按克拼配混批。</p><p>欢迎联系客服索取实拍视频与克重明细。</p>',
      isTop: true,
      isPopup: false,
      status: 1,
      publishAt: daysAgo(3),
      expireAt: daysLater(60),
    },
    {
      ...base(8003, daysAgo(7)),
      title: '关于按克批发与称重发货的说明',
      contentHtml:
        '<p>本商城所有商品均<strong>按克批发</strong>，库存以克为单位展示，保留 3 位小数。</p><p>发货前统一复称，以实际克重为准结算，多退少补。参考件数仅供估算，不作为结算依据。</p>',
      isTop: false,
      isPopup: false,
      status: 1,
      publishAt: daysAgo(7),
      expireAt: daysLater(180),
    },
    {
      ...base(8004, daysAgo(10)),
      title: '水贝实体档口地址变更通知',
      contentHtml:
        '<p>我司档口已搬迁至 <strong>水贝珠宝大厦 18 楼 1801</strong>，欢迎各位客户到店看货。</p><p>到店前请提前与客服预约，以便备货。</p>',
      isTop: false,
      isPopup: false,
      status: 1,
      publishAt: daysAgo(10),
      expireAt: daysLater(365),
    },
    {
      ...base(8005, daysAgo(12)),
      title: '【草稿】2026 春季新品预告',
      contentHtml: '<p>内部草稿，暂不发布。</p>',
      isTop: false,
      isPopup: false,
      status: 0,
    },
  ]
  seq.notice = 8005

  // ── 轮播图 ──────────────────────────────────────────────────
  const banner: Banner[] = [
    {
      ...base(9001),
      image: img('banner-1'),
      title: '源头工厂 · 按克批发',
      linkType: 'NOTICE',
      linkValue: '8002',
      sort: 10,
      status: 1,
    },
    {
      ...base(9002),
      image: img('banner-2'),
      title: '古法转运珠新到货',
      linkType: 'PRODUCT',
      linkValue: '5001',
      sort: 20,
      status: 1,
    },
    {
      ...base(9003),
      image: img('banner-3'),
      title: '投资金条 现货供应',
      linkType: 'PRODUCT',
      linkValue: '5010',
      sort: 30,
      status: 1,
    },
  ]
  seq.banner = 9003
  seq.sysOperationLog = 10_000

  return {
    schemaVersion: 1,
    seq,
    sysAdmin,
    sysConfig,
    sysOperationLog: [],
    goldMaterial,
    category,
    product,
    productSku,
    stockLog,
    notice,
    banner,
  }
}
