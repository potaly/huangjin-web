// ────────────────────────────────────────────────────────────────
// 黄金首饰批发商城 · 一期数据模型
// 对应需求文档 §6 数据库设计（一期 10 张表）
// 约定：克重 3 位小数、金额/金价 2 位小数、状态字段使用常量枚举
// ────────────────────────────────────────────────────────────────

/** 通用字段 */
export interface BaseEntity {
  id: number
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  deleted?: boolean
}

/** 管理员角色 */
export type RoleCode = 'SUPER' | 'OPERATOR' | 'WAREHOUSE'

export const ROLE_LABEL: Record<RoleCode, string> = {
  SUPER: '超级管理员',
  OPERATOR: '运营',
  WAREHOUSE: '仓库',
}

/** sys_admin 管理员 */
export interface Admin extends BaseEntity {
  username: string
  /** PBKDF2 派生，格式 pbkdf2$<iterations>$<saltHex>$<hashHex> */
  password: string
  realName: string
  phone?: string
  roleCode: RoleCode
  /** 0 禁用 / 1 启用 */
  status: 0 | 1
  lastLoginAt?: string
  /** 连续登录失败次数 */
  failCount?: number
  /** 锁定到期时间戳（毫秒） */
  lockedUntil?: number
}

/** sys_config 系统参数 */
export interface Config extends BaseEntity {
  configKey: string
  configValue: string
  remark?: string
}

/** sys_operation_log 操作日志 */
export interface OperationLog extends BaseEntity {
  adminId: number
  adminName: string
  module: string
  action: string
  requestUri: string
  requestBody?: string
  ip?: string
  costMs?: number
}

/** gold_material 材质字典 */
export interface Material extends BaseEntity {
  code: string
  name: string
  purity?: string
  sort: number
  status: 0 | 1
}

/** category 商品分类（两级，parentId=0 为一级） */
export interface Category extends BaseEntity {
  parentId: number
  name: string
  icon?: string
  sort: number
  status: 0 | 1
}

/** 商品自定义属性 */
export interface ProductAttr {
  name: string
  value: string
}

/** product 商品 */
export interface Product extends BaseEntity {
  name: string
  styleNo: string
  categoryId: number
  materialId: number
  cover?: string
  images: string[]
  /** 固定属性 */
  purity?: string
  sizeDesc?: string
  /** 自定义属性键值对，前台原样展示 */
  attrs: ProductAttr[]
  detailHtml?: string
  isRecommend: boolean
  /** 0 下架 / 1 上架 */
  status: 0 | 1
  sort: number
  // ── 二期预留（一期不返回给前台）──
  laborFeePerG?: number | null
  extraFeePerG?: number | null
}

/** product_sku 规格库存 */
export interface Sku extends BaseEntity {
  productId: number
  skuCode: string
  specName: string
  /** 参考单件克重（g），可空 */
  refWeight?: number | null
  /** 参考件数，可空，仅展示 */
  refQty?: number | null
  /** 总库存（克，3 位小数） */
  stockWeight: number
  /** 预占（克），二期使用 */
  lockedWeight: number
  /** 预警克数 */
  warnWeight: number
  /** 二期预留 */
  minOrderWeight?: number | null
  stepWeight?: number | null
  status: 0 | 1
  version: number
}

/** 库存流水类型 */
export type StockLogType =
  | 'IN'
  | 'OUT'
  | 'ADJUST'
  | 'LOCK'
  | 'WEIGH_OUT'
  | 'UNLOCK'
  | 'REFUND_BACK'
  | 'ORDER_OUT'
  | 'ORDER_BACK'

export const STOCK_LOG_TYPE_LABEL: Record<StockLogType, string> = {
  IN: '入库',
  OUT: '出库',
  ADJUST: '盘点调整',
  LOCK: '下单预占',
  WEIGH_OUT: '称重出库',
  UNLOCK: '取消释放',
  REFUND_BACK: '退款回库',
  ORDER_OUT: '下单扣减',
  ORDER_BACK: '取消回库',
}

/** stock_log 库存流水 */
export interface StockLog extends BaseEntity {
  skuId: number
  productId: number
  productName: string
  skuCode: string
  specName: string
  type: StockLogType
  /** 变化克数（带符号） */
  changeWeight: number
  beforeWeight: number
  afterWeight: number
  refNo?: string
  reason?: string
  operator: string
}

/** notice 公告：0 草稿 / 1 已发布 / 2 已下线 */
export interface Notice extends BaseEntity {
  title: string
  cover?: string
  contentHtml?: string
  isTop: boolean
  isPopup: boolean
  status: 0 | 1 | 2
  publishAt?: string
  expireAt?: string
}

/** banner 轮播图 */
export type BannerLinkType = 'NONE' | 'PRODUCT' | 'NOTICE' | 'URL'

export interface Banner extends BaseEntity {
  image: string
  title?: string
  linkType: BannerLinkType
  linkValue?: string
  sort: number
  status: 0 | 1
}

/** 前台用户角色：老板 / 业务员 / 客户 */
export type MallRole = 'OWNER' | 'SALES' | 'CUSTOMER'

export const MALL_ROLE_LABEL: Record<MallRole, string> = {
  OWNER: '老板',
  SALES: '业务员',
  CUSTOMER: '客户',
}

/** mall_user 前台用户（白名单手机号） */
export interface MallUser extends BaseEntity {
  /** 11 位手机号，未删除范围内唯一 */
  phone: string
  name: string
  role: MallRole
  /** 仅客户：绑定的业务员 MallUser.id */
  salesId?: number | null
  /** 绑定的微信 openid，唯一 */
  openid?: string | null
  /** 0 停用 / 1 启用 */
  status: 0 | 1
  lastLoginAt?: string
}

/** 前台会话载荷 */
export interface MallSession {
  uid: number
  role: MallRole
  exp: number
}

/** 订单状态：待确认 / 已确认 / 已完成 / 已取消 */
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '待确认',
  CONFIRMED: '已确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

/** 订单明细：下单时的商品快照 */
export interface OrderItem {
  productId: number
  skuId: number
  name: string
  styleNo: string
  specName: string
  cover: string
  /** 单件参考克重（g） */
  unitWeight: number
  /** 每克工费（元），未设置为 null */
  laborFeePerG: number | null
  qty: number
  /** qty × unitWeight，3 位小数 */
  weight: number
  /** weight × laborFeePerG，2 位小数；无工费为 null */
  laborFee: number | null
}

/** order 订单（无在线支付，提交后由业务员跟进） */
export interface Order extends BaseEntity {
  /** 例：FS20261106-0001 */
  orderNo: string
  customerId: number
  customerName: string
  customerPhone: string
  /** 下单时客户绑定的业务员 */
  salesId: number | null
  status: OrderStatus
  items: OrderItem[]
  totalQty: number
  totalWeight: number
  /** 所有明细都有工费时为合计，否则为 null */
  totalLaborFee: number | null
  remark?: string
  /** 客户端生成的提交编号，用于防重复提交 */
  clientToken: string
  confirmedAt?: string
  completedAt?: string
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
  /** 管理端是否已查看（用于新单红点） */
  seenBySales: boolean
}

/** 整库文档 */
export interface DB {
  schemaVersion: number
  seq: Record<string, number>
  sysAdmin: Admin[]
  sysConfig: Config[]
  sysOperationLog: OperationLog[]
  goldMaterial: Material[]
  category: Category[]
  product: Product[]
  productSku: Sku[]
  stockLog: StockLog[]
  notice: Notice[]
  banner: Banner[]
  mallUser: MallUser[]
  order: Order[]
}

export type TableName = Exclude<keyof DB, 'schemaVersion' | 'seq'>

/** 库存展示方式 */
export type StockDisplayMode = 'EXACT' | 'LEVEL'

/** 前台库存等级 */
export type StockLevel = 'ENOUGH' | 'LOW' | 'SOLD_OUT'

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  ENOUGH: '充足',
  LOW: '少量',
  SOLD_OUT: '售罄',
}

/** 统一分页返回 */
export interface Page<T> {
  records: T[]
  total: number
  pageNum: number
  pageSize: number
}

/** 当前登录管理员（会话载荷） */
export interface AdminSession {
  id: number
  username: string
  realName: string
  roleCode: RoleCode
  exp: number
}
