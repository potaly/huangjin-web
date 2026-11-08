# 小程序商品与库存管理 · 设计

- 日期：2026-11-08
- 范围：`huangjin-web`（新增 `/api/mall/manage/**` 接口）与 `xiaojing-mp`（新增 4 个管理页面）
- 目的：老板和业务员平时用手机操作，把 PC 后台最常用的商品和库存管理搬进小程序。属于演示版，用来收集需求。

## 1. 目标与范围

**验收标准：老板只用小程序、完全不打开 PC 后台，也能完成日常经营。** PC 后台每项功能默认都搬，只有确实不适合手机的项列入第 9 节由用户决定。

| 模块 | PC 后台能力 | 手机复杂度 | 小程序现状 | 本期 |
|---|---|---|---|---|
| 工作台 | 统计、按材质汇总、预警、最近流水 | 低 | 无 | **做**，同时作为管理入口 |
| 商品 | 筛选分页、新增编辑、上下架、批量上下架、复制、删除 | 高 | 仅客户浏览 | **做** |
| SKU | 商品表单内增删改、初始库存 | 高 | 无 | **做** |
| 商品图片 | 主图 + 最多 9 张图集 | 中 | 无 | **做** |
| 商品图文详情 | 富文本编辑 | 高 | 只读 | **做**，见第 8 节 |
| 库存 | 总览、预警、入库、出库、盘点 | 中 | 无 | **做** |
| 库存流水 | 筛选查询、导出 | 低 | 无 | **做**，导出后发送到微信 |
| 分类 | 两级增删改、图标、排序、启停 | 低到中 | 仅浏览 | **做** |
| 材质 | 增删改、排序、启停 | 低 | 仅浏览 | **做** |
| 公告 | 增删改、置顶、弹窗、定时、富文本 | 中 | 只读 | **做** |
| 轮播图 | 增删改、排序、跳转目标 | 低到中 | 仅展示 | **做**，商品和公告用选择器 |
| 系统参数 | 分组参数、二维码图片、登录开关、库存展示方式 | 低 | 无 | **做** |
| 操作日志 | 按模块和关键词查询 | 低 | 无 | **做** |
| 管理员账号 | PC 账号增删、重置密码 | 中 | 无 | 待用户决定，见第 9 节 |
| 订单、用户 | — | — | 已有 | 不变 |

## 2. 已确认的规则

| 议题 | 结论 |
|---|---|
| 权限 | 老板和业务员权限相同（用户确认），适用于商品、库存、工作台、分类、材质、公告、轮播图。系统参数和操作日志仅老板，对应 PC 上只有超级管理员能访问 |
| 图片存储 | 沿用 Redis（`lib/files.ts`），单张上限 600KB，正式上线再换对象存储 |
| 图文详情 | 只有用户进入图文编辑页并确认后才提交 `detailHtml`，否则不提交，PC 写好的内容不受影响 |

## 3. 后端

### 3.1 逻辑共用

删除商品、上下架、库存操作入参校验和执行、商品列表和库存列表的查询现在写在 PC 路由里。把它们抽到 `lib/`，PC 路由改为调用，URL、入参、返回结构和提示文案都不变。

| 位置 | 新增导出 | 来源 |
|---|---|---|
| `lib/product-service.ts` | `deleteProduct(db, id, session)`、`setProductStatus(db, id, status, session)` | PC 路由 `products/[id]`、`products/[id]/status` |
| `lib/manage-query.ts`（新文件） | `filterProducts(db, filter)`、`productRow(db, product)`、`productDetail(db, id)`、`productOptions(db)`、`stockRows(db, filter)`、`stockSummary(rows)` | PC 路由 `products`、`products/[id]`、`stocks` |
| `lib/stock-ops.ts`（新文件） | `parseStockOp(type, body)`、`runStockOp(db, type, parsed, operator)`、`STOCK_OP_LABEL` | `lib/stock-handler.ts` |

`lib/stock.ts` 不改。服务函数只做业务校验和数据变更，`addLog` 留在各自路由里，因为两端的 `requestUri` 不同。

### 3.2 小程序操作人

`lib/mall-auth.ts` 新增 `mallActor(user: MallUser): AdminSession`，把小程序用户转换成现有服务函数和 `addLog` 需要的结构：

- `id`：`user.id`
- `username`：`mall:<user.id>`，写入 `updatedBy`，不把手机号写进业务字段
- `realName`：`<姓名>（小程序）`，显示在操作日志和库存流水的操作人里
- `roleCode`：`OPERATOR`，服务函数不读取，仅满足类型
- `exp`：`0`

### 3.3 接口

全部在 `/api/mall/manage/` 下，读取用 `loadDB()` + `requireMallUser(db, ['OWNER','SALES'])`，写入在 `mutate()` 回调内鉴权并记 `addLog`。

| 方法与路径 | 说明 |
|---|---|
| `GET products?keyword=&status=&pageNum=&pageSize=` | 商品分页，返回 `filterProducts` + `productRow` 的分页结果 |
| `POST products` | 调 `createProduct`，日志「商品/新增」 |
| `GET products/[id]` | 调 `productDetail` |
| `PUT products/[id]` | 调 `updateProduct`，日志「商品/编辑」 |
| `DELETE products/[id]` | 调 `deleteProduct`，日志「商品/删除」 |
| `PUT products/[id]/status` | 调 `setProductStatus`，日志「商品/上架」或「商品/下架」 |
| `POST products/[id]/copy` | 调 `copyProduct`，日志「商品/复制」 |
| `GET product-options` | 分类平铺列表和材质列表，给选择器用 |
| `GET stocks?keyword=&materialId=&onlyWarn=&pageNum=&pageSize=` | 库存分页和 `summary` |
| `POST stocks/[op]`（`in`、`out`、`adjust`） | 调 `runStockOp`，日志「库存/入库」等 |
| `GET stock-logs?keyword=&type=&skuId=&startDate=&endDate=&pageNum=&pageSize=` | 复用 `filterLogs` |
| `POST upload` | 传图，见 3.4 |

`product-options` 返回：

```ts
{
  categories: Array<{ id: number; label: string; status: 0 | 1 }>  // label 形如「手链」「手链 / 古法」，一级在前、二级紧随
  materials: Array<{ id: number; name: string; purity?: string; status: 0 | 1 }>
}
```

包含已停用项，这样编辑老商品时选择器能显示原值；小程序在名称后标注「（已停用）」。

### 3.4 上传

`POST /api/mall/manage/upload`，`multipart/form-data`，字段名 `file`，返回 `{ url, size, mime }`。

`wx.uploadFile` 不保证 `File.type` 准确，所以新增纯函数 `sniffImageMime(buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null`（放在 `lib/files.ts`），按文件头判断真实类型，只接受这三种，用判断结果调用 `saveFile`。不接受 SVG 和 GIF。

## 4. 小程序

新增页面均在 `pages/` 下，放进主包；`我的` 页对老板和业务员显示「商品管理」「库存管理」。配色和控件沿用 `manage-users`、`manage-user-edit`。请求用 `utils/request.js`，`DELETE` 走其导出的 `request`。

### 4.1 `pages/manage-products`

顶部搜索框（款号或名称），全部/上架/下架切换。卡片显示主图、名称、款号、分类·材质、可售克重、库存等级和上下架状态。下拉刷新，触底加载下一页。点卡片进编辑页，底部固定「新增商品」。

### 4.2 `pages/manage-product-edit`

分块长表单，底部固定「保存」。

- **图片**：主图一格，图集最多 9 格。点空格选图（拍照或相册）。点图集图弹出「设为主图 / 删除」，点主图弹出「更换 / 删除」。
- **基本信息**：名称、款号（自动转大写）、分类、材质、成色、尺寸说明、工费（元/克，留空为面议）、排序、推荐开关。
- **规格**：每个 SKU 一张摘要卡（规格名、编码、单件克重、可售克重、启用状态）。点卡片或「添加规格」打开底部弹层，字段为规格名、编码、单件克重、参考件数、预警克数、启用，新规格多一个初始库存。删除已保存的规格时二次确认，提交时带 `_deleted`。
- **SKU 编码**：编码留空时，保存前用 `款号-NN` 自动补齐，序号避开表单内已有编码；PC 端新建时的规则相同。
- **自定义属性**：名称和值成对添加、删除。
- **图文详情**：一行入口，进入第 8 节的图文编辑页。
- **已有商品的操作区**：上架或下架（调 status 接口，成功后刷新）、复制（成功后跳到副本）、删除（二次确认，成功后返回列表）。
- 新增商品默认下架，保存后用 `redirectTo` 进入编辑页，在那里上架。
- 上传中不允许保存，避免提交半成品。

### 4.3 `pages/manage-stocks`

顶部汇总卡（SKU 数、总克重、预占、可售、预警数）。搜索框、「只看预警」开关、右上入口「库存流水」。SKU 卡片显示商品名、规格、编码、总/预占/可售克重、等级标签。

点卡片打开底部面板：

- 入库、出库、盘点三段切换。
- 克重输入（`digit` 键盘）。入库、出库填变动克重，盘点填调整后的总克重。
- 实时预览「变更后 X g」，前端用毫克整数计算以避免浮点误差。
- 原因必填，提供常用原因快捷填入，单号选填。
- 出库和盘点提交前二次确认。提交成功后 toast 并刷新列表。
- 面板内有「查看流水」，带 `skuId` 进入流水页。

### 4.4 `pages/manage-stock-logs`

类型切换（全部、入库、出库、盘点调整、下单扣减、取消回库），搜索框，开始和结束日期选择。卡片显示商品、规格、类型、变动克重、前后克重、原因、操作人、时间。可带 `skuId` 进入。触底加载下一页。

### 4.5 传图

`utils/upload.js` 导出 `chooseAndUpload({ count })`：

1. `wx.chooseMedia`（`mediaType: ['image']`，`sourceType: ['album','camera']`，`sizeType: ['compressed']`）。
2. 每张图若超过 600KB，用 `wx.compressImage` 依次尝试（宽 1400/质量 80、1200/70、1000/60、800/50），直到不超过 600KB；仍然超过就报错提示。
3. `wx.uploadFile` 带 `Authorization`，解析返回的 JSON，401 时跳登录，失败时 reject 带后端提示。
4. 最多 3 张并发，返回成功的 URL 和失败数，部分失败时 toast 提示。

## 5. 错误处理

- 校验全部在服务端，失败时小程序用 toast 显示后端提示。
- 列表页用 `state-view` 处理加载、空、错误三态。
- 按钮在提交中禁用，防止重复提交。

## 6. 测试

`tsx --test` 新增：

- `mallActor` 的字段映射。
- `deleteProduct`：已上架、有未完成订单、仍有库存时拒绝；成功时商品和 SKU 软删除。
- `setProductStatus`：无主图、无启用 SKU 时拒绝上架。
- `filterProducts`、`productRow`、`productOptions`、`stockRows`、`stockSummary` 的筛选和汇总。
- `parseStockOp`：非法克重、缺原因；`runStockOp`：入库、出库、盘点的克重变化，操作人落入流水。
- `sniffImageMime`：JPEG、PNG、WEBP 识别，SVG 和其他内容返回 null。

验收：`npx tsx --test "tests/**/*.test.ts"` 和 `npx tsc --noEmit` 全部通过。小程序页面由用户在微信开发者工具中走查。

## 7. 上线前置

- 在微信公众平台把 `https://xiaojing.keyseal.top` 加入 **uploadFile 合法域名** 和 **downloadFile 合法域名**（request 合法域名已配置）。
- 推送 main 前询问用户。

## 8. 其余模块

### 8.1 后端

逻辑抽到 `lib/`，PC 路由改为调用，行为不变；日志留在路由。写接口 `addLog` 的 `requestUri` 用实际的小程序路径。

| 位置 | 内容 |
|---|---|
| `lib/content-service.ts`（新） | 分类树、分类增改删、材质列表增改删、公告列表增改删和读取、轮播列表增改删，含现有全部校验（重名、两级限制、有子分类或商品不能删、材质被用不能删、外链格式、停用一级分类同步停用二级） |
| `lib/config-service.ts`（新） | `listConfigs`、`saveConfigs`（含 `stock.display.mode` 校验）、`queryOperationLogs` |
| `lib/manage-query.ts` | 增加 `dashboardData(db)` |
| `lib/product-service.ts` | 增加 `batchSetProductStatus(db, ids, status, session)` |
| `lib/stock-logs.ts` | 增加 `stockLogsCsv(logs)` 和导出文件名函数 |

| 接口（`/api/mall/manage/` 下） | 角色 |
|---|---|
| `GET dashboard` | OWNER、SALES |
| `PUT products/batch-status` | OWNER、SALES |
| `GET stock-logs/export` | OWNER、SALES |
| `GET/POST categories`，`PUT/DELETE categories/[id]` | OWNER、SALES |
| `GET/POST materials`，`PUT/DELETE materials/[id]` | OWNER、SALES |
| `GET/POST notices`，`GET/PUT/DELETE notices/[id]` | OWNER、SALES |
| `GET/POST banners`，`PUT/DELETE banners/[id]` | OWNER、SALES |
| `GET/PUT configs` | OWNER |
| `GET operation-logs` | OWNER |

### 8.2 小程序

- `pages/manage-home`（工作台）：统计卡、按材质汇总、预警前 10（点击进库存页且只看预警）、最近流水，以及全部管理入口；系统设置和操作日志仅老板可见。`我的` 页增加「管理工作台」入口。
- `pages/manage-categories`：两级分类列表，增改删和启停用底部弹层，可上传图标。
- `pages/manage-materials`：材质列表，增改删和启停用底部弹层。
- `pages/manage-notices`、`pages/manage-notice-edit`：状态筛选、搜索、分页；编辑标题、封面、正文（进入图文编辑页）、置顶、弹窗、状态（草稿/发布/下线）、生效和过期时间。
- `pages/manage-banners`、`pages/manage-banner-edit`：列表显示图片、状态、跳转；编辑时跳转类型选无/商品/公告/外链，商品和公告用可搜索的选择弹层，不让用户手填 ID。
- `pages/manage-rich-edit`：基于微信 `editor` 组件，支持粗体、斜体、标题、列表、插入图片（走 `utils/upload.js`）。通过 `eventChannel` 接收和返回 HTML，点「完成」才回传。载入时把站内相对图片地址补成绝对地址。
- `pages/manage-configs`（仅老板）：按 PC 分组展示，登录开关和库存展示方式用选择控件，二维码上传图片，二期参数单独分组。
- `pages/manage-logs`（仅老板）：模块筛选、搜索、分页。
- 商品列表增加批量模式：勾选后批量上架或下架，显示跳过原因。
- 库存流水页增加导出：`wx.downloadFile` 带登录头下载 CSV，按钮变为「发送到微信」，点击后 `wx.shareFileMessage`。

## 9. 待用户决定

**PC 管理员账号管理（新增、重置密码、角色、PC 登录）。** 建议不搬：这些账号只用于登录 PC 后台。老板不再使用 PC 时，它们没有用途，小程序的账号由已有的用户管理负责。
