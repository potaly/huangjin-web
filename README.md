# 黄金首饰批发商城 · 一期

面向全国批发客户的黄金首饰商城，**一期为免登录的商品与库存展示站**：客户浏览款式、规格和按克计的库存，有意向时主动联系客服，前台不显示任何价格。配套一套完整的管理后台。

> 需求来源：《黄金首饰批发商城 · 需求开发文档》一期范围。二期（登录注册、金价计价、按克下单、称重补差、微信 / 支付宝支付）的表结构与接口已在代码中预留。

## 在线地址

| 入口 | 自定义域名 | Vercel 默认域名 |
| --- | --- | --- |
| 前台商城 | https://xiaojing.keyseal.top | https://huangjin-web.vercel.app |
| 管理后台 | https://xiaojing.keyseal.top/admin | https://huangjin-web.vercel.app/admin |
| 健康检查 | https://xiaojing.keyseal.top/api/health | https://huangjin-web.vercel.app/api/health |

仓库已与 Vercel 关联，推送到 `main` 会自动构建并部署到生产环境。

演示账号：

| 角色 | 账号 | 密码 | 可用菜单 |
| --- | --- | --- | --- |
| 超级管理员 | `admin` | `admin123456` | 全部 |
| 运营 | `operator` | `operator123` | 分类、材质、商品、公告、轮播 |
| 仓库 | `warehouse` | `warehouse123` | 库存管理、库存流水 |

> ⚠️ 上线前请立即修改默认密码，并设置环境变量 `ADMIN_SESSION_SECRET`。

## 技术栈

参考 [potaly/activation-service](https://github.com/potaly/activation-service) 的技术选型，整套系统部署在 Vercel 上：

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 14（App Router）+ TypeScript |
| 样式 | Tailwind CSS 3 |
| 接口 | Next.js Route Handlers（`/api/mall/**`、`/api/admin/**`） |
| 存储 | Upstash Redis / Vercel KV；未配置时自动降级为内存存储 |
| 鉴权 | HMAC-SHA256 签名的 httpOnly Cookie + PBKDF2 口令派生 |
| 部署 | Vercel（区域 `hkg1`） |

> 原文档规划的是 Spring Boot 3 + MySQL + Redis + Vue3 + uni-app。因本期要求部署到 Vercel（无状态 Serverless，无法运行 Java 常驻进程），改为与参考项目一致的 Next.js 全栈方案：业务规则、数据模型、接口路径与分期边界均按原文档实现。

## 已实现功能（一期全量）

### 前台（免登录，移动端优先，PC 以小程序风格居中展示）

- **首页** `/`：搜索、轮播图、公告滚动条、首页弹窗公告（每天首次进入弹一次）、分类入口、推荐款式、最新上架
- **商品分类** `/category`：左侧一级分类 + 右侧二级分类
- **商品列表** `/goods`：关键词 / 分类 / 材质筛选，按综合 / 库存克数 / 上新排序，上拉加载更多，售罄置灰
- **商品详情** `/goods/[id]`：图片轮播、规格属性表、各 SKU 库存克重、详情富文本、同类推荐
  - 「咨询客服」自动复制「商品名 + 款号 + 规格」到剪贴板，方便粘贴到微信
  - 支持复制款号、复制商品链接
- **公告** `/notice`、`/notice/[id]`：置顶优先，按发布时间倒序
- **联系我们** `/contact`：客服电话一键拨打、微信号一键复制、二维码长按识别、工作时间、公司地址、采购流程
- 所有页面右下角悬浮「联系客服」按钮

### 管理后台 `/admin`

| 菜单 | 功能 |
| --- | --- |
| 工作台 | 商品数与上架数、各材质库存总克数、库存预警列表、最近库存变动 |
| 商品分类 | 两级分类，名称、图标、排序、启停 |
| 材质字典 | 材质 CRUD、启停（二期金价按材质录入） |
| 商品管理 | 新增 / 编辑 / 复制商品，上下架、批量上下架、删除；SKU 表格、初始库存、规格属性、富文本详情 |
| 库存管理 | SKU 库存总览（总库存 / 预占 / 可售），入库、出库、盘点调整（单位克，必填原因） |
| 库存流水 | 按关键词 / 类型 / 日期查询，导出 CSV（Excel 可直接打开） |
| 公告管理 | 富文本正文、封面、置顶、首页弹窗、生效 / 失效时间、草稿 / 发布 / 下线 |
| 轮播图管理 | 图片、跳转类型（不跳转 / 商品 / 公告 / 外链）、排序、启停 |
| 管理员账号 | 账号 CRUD、角色分配、启停、重置密码、修改自己的密码 |
| 系统参数 | 客服信息、库存展示方式等；二期参数先行保留 |
| 操作日志 | 记录全部后台写操作 |

## 核心业务规则

### 库存（按克）

- 库存以 SKU 为单位，单位「克」，保留 **3 位小数**
- 三个数：总库存 `stockWeight`、预占 `lockedWeight`、可售 = 总库存 − 预占（一期无下单，可售即总库存）
- 每次库存变化写一条流水，记录变化克数与变化前后克数
- 可售低于 SKU 预警克数时，工作台提示

### 定点数运算

JS 没有 `BigDecimal`，`lib/num.ts` 统一走整数定点运算：克重放大 1000 倍、金额放大 100 倍后用整数加减，四舍五入按 HALF_UP，禁止浮点直接累加。克重比较用 `compareWeight`，不用 `===`。

### 一期不返回价格

`lib/mall.ts` 的视图模型**显式构造**返回对象（而不是把实体整个 spread 出去），保证一期前台接口在后端就不含任何金价、工费、价格字段 —— 不依赖前端隐藏。

### 库存展示方式

系统参数 `stock.display.mode`：

- `EXACT`（默认）：显示精确克数，如「库存 1,250.360 g」
- `LEVEL`：只显示「充足 / 少量 / 售罄」（少量 = 可售低于预警克数）

## 本地开发

```bash
npm install
cp .env.example .env.local   # 至少填写 ADMIN_SESSION_SECRET
npm run dev
```

打开 http://localhost:3000 ，后台在 http://localhost:3000/admin 。

其他脚本：

```bash
npm run build       # 生产构建
npm run typecheck   # TypeScript 校验
node scripts/gen-images.mjs   # 重新生成 public/img 下的占位图
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_SESSION_SECRET` | 是 | 后台会话签名密钥，请使用足够长的随机串 |
| `UPSTASH_REDIS_REST_URL` | 否 | Upstash Redis REST 地址；不配置则使用内存存储 |
| `UPSTASH_REDIS_REST_TOKEN` | 否 | Upstash Redis REST Token |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | 否 | Vercel KV 的等价变量名，同样被支持 |
| `INIT_ADMIN_USERNAME` | 否 | 初始超管用户名，默认 `admin` |
| `INIT_ADMIN_PASSWORD` | 否 | 初始超管密码，默认 `admin123456` |

**没有配置 Redis 时**，系统使用内存存储：读取种子数据正常，所有页面可完整浏览与操作，但写入只在当前 Serverless 实例生命周期内有效，实例回收后会重置回种子数据。后台工作台会显著提示当前存储模式。

接入 Redis 的步骤：在 Vercel 项目的 Storage 中创建 Upstash Redis（或在 upstash.com 自行创建），把 REST URL 与 Token 填入上面的环境变量，重新部署即可自动写入种子数据并持久化。

## 数据模型

一期 10 张表（见 `lib/types.ts`），字段与原文档 §6 一致：

`sys_admin`、`sys_config`、`sys_operation_log`、`gold_material`、`category`、`product`、`product_sku`、`stock_log`、`notice`、`banner`

整库以单个 JSON 文档存放在 Redis 的 `huangjin:db` 键下，写操作通过 Redis 分布式锁（`SET NX PX`）串行化。一期数据量小（商品、SKU、公告、轮播、参数），这个方案足够且便于迁移 —— 后续量级上来后可按表拆键或迁移到 Postgres，只需替换 `lib/store.ts`。

图片单独存放在 `huangjin:file:{id}` 键下，通过 `/api/files/{id}` 读取，不混进整库文档；接入阿里云 OSS 时只需替换 `lib/files.ts`。

## 接口

统一返回 `{ code, msg, data }`，`code === 0` 表示成功；分页返回 `{ records, total, pageNum, pageSize }`。

### 前台 `/api/mall`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/home` | 轮播、有效公告前 3 条、弹窗公告、分类、推荐与最新商品 |
| GET | `/categories` | 分类树 |
| GET | `/materials` | 启用材质（列表筛选用） |
| GET | `/products` | 商品分页：`keyword`、`categoryId`、`materialId`、`sort`、`recommend` |
| GET | `/products/{id}` | 商品详情：属性、SKU 列表与库存、同类推荐 |
| GET | `/notices`、`/notices/{id}` | 公告列表、详情 |
| GET | `/settings/public` | 客服信息与库存展示方式 |

### 后台 `/api/admin`

`auth/captcha`、`auth/login`、`auth/logout`、`auth/me`、`dashboard`、`materials`、`categories`、`products`（含 `{id}/status`、`{id}/copy`、`batch-status`）、`stocks`（含 `in`、`out`、`adjust`）、`stock-logs`（含 `export`）、`notices`、`banners`、`admins`（含 `{id}/reset-password`、`change-password`）、`configs`、`operation-logs`、`upload`

## 安全

- 后台登录需图形验证码；连续 5 次失败锁定 15 分钟
- 会话 Cookie 为 httpOnly + SameSite=Lax，生产环境附加 Secure，有效期 2 小时
- 口令使用 PBKDF2-SHA256（12 万次迭代）派生，比较用 `timingSafeEqual`
- 富文本在服务端经白名单过滤（`lib/sanitize.ts`），剥离脚本、事件属性与危险协议
- 接口按角色鉴权：运营不能进系统管理，仓库只能操作库存
- 操作日志中的 `password` / `secret` / `token` 字段自动脱敏

## 目录结构

```
huangjin-web/
├── app/
│   ├── (mall)/              # 前台页面（共享 480px 居中壳层与底部 tabBar）
│   ├── admin/
│   │   ├── login/           # 登录页（无侧边栏）
│   │   └── (panel)/         # 后台页面（共享侧边栏布局）
│   └── api/
│       ├── mall/            # 前台接口
│       ├── admin/           # 后台接口
│       ├── files/[id]/      # 图片读取
│       └── health/          # 健康检查
├── components/
│   ├── mall/                # 商城壳层、客服弹窗、轮播、商品卡片
│   ├── admin/               # 后台壳层、表格、弹窗、图片上传、富文本编辑器
│   ├── Toast.tsx
│   └── ui.tsx
├── lib/
│   ├── types.ts             # 数据模型（对应文档 §6）
│   ├── store.ts             # 存储适配层（Redis / 内存）
│   ├── seed.ts              # 种子数据
│   ├── auth.ts              # 口令派生与会话签名
│   ├── captcha.ts           # 图形验证码
│   ├── api.ts               # 统一返回、鉴权守卫、分页、操作日志
│   ├── num.ts               # 克重 / 金额定点运算
│   ├── stock.ts             # 库存服务
│   ├── mall.ts              # 前台视图模型（不含价格字段）
│   ├── product-service.ts   # 商品 + SKU 写入
│   ├── sanitize.ts          # 富文本白名单过滤
│   └── files.ts             # 图片存储
├── scripts/gen-images.mjs   # 生成 public/img 下的 SVG 占位图
└── public/img/              # 商品图、分类图标、轮播图、二维码（均为本地 SVG）
```

## 二期预留

代码中已预留，二期开发时在对应位置补齐即可：

- `product.laborFeePerG` / `extraFeePerG`、`sku.minOrderWeight` / `stepWeight`
- `sku.lockedWeight` 预占字段与 `LOCK` / `WEIGH_OUT` / `UNLOCK` / `REFUND_BACK` 流水类型
- 系统参数 `order.pay.timeout.minutes`、`order.auto.confirm.days`、`order.weigh.tolerance.percent`、`price.allow.order.without.today`
- 首页「今日金价卡片」、商品详情「加入购物车 / 立即购买」、后台「金价 / 订单 / 客户」菜单的插入位置均有注释标记

## 上线前检查清单

- [ ] 配置 `ADMIN_SESSION_SECRET` 为随机长字符串
- [ ] 配置 Upstash Redis，确认后台工作台显示「Redis 持久化」
- [ ] 修改全部演示账号的密码，删除不需要的账号
- [ ] 在系统参数中填写真实的客服电话、微信号、二维码、工作时间、公司地址
- [ ] 替换 `public/img` 下的占位图为真实商品实拍图（或在后台逐个上传）
- [ ] 录入首批商品与库存
- [ ] 域名 ICP 备案（二期支付回调必须 HTTPS）
