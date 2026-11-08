# 小程序商品与库存管理 · 设计

- 日期：2026-11-08
- 范围：`huangjin-web`（新增 `/api/mall/manage/**` 接口）与 `xiaojing-mp`（新增 4 个管理页面）
- 目的：老板和业务员平时用手机操作，把 PC 后台最常用的商品和库存管理搬进小程序。属于演示版，用来收集需求。

## 1. 功能盘点

| 模块 | PC 后台能力 | 手机复杂度 | 小程序现状 | 本期 |
|---|---|---|---|---|
| 商品 | 筛选分页、新增编辑、上下架、批量上下架、复制、删除 | 高 | 仅客户浏览 | **做**，批量上下架除外 |
| SKU | 商品表单内增删改、初始库存 | 高 | 无 | **做** |
| 商品图片 | 主图 + 最多 9 张图集 | 中 | 无 | **做** |
| 商品图文详情 | 富文本编辑 | 高 | 只读 | 不做，保留 PC 内容 |
| 库存 | 总览、预警、入库、出库、盘点 | 中 | 无 | **做** |
| 库存流水 | 筛选查询、导出 | 低 | 无 | **做**，导出除外 |
| 工作台 | 统计、预警、最近流水 | 低 | 无 | 不做 |
| 分类、材质 | 增删改 | 低到中 | 仅浏览 | 不做 |
| 公告、轮播图 | 增删改 | 中 | 仅展示 | 不做 |
| 系统参数、操作日志 | 参数编辑、日志查询 | 低 | 无 | 不做 |
| 管理员 | PC 账号管理 | 中 | 无 | 不做，与小程序用户是两套账号 |
| 订单、用户 | — | — | 已有 | 不变 |

## 2. 已确认的规则

| 议题 | 结论 |
|---|---|
| 范围 | 首批只做商品和库存 |
| 权限 | 老板和业务员权限相同，所有新接口要求 `['OWNER','SALES']`，靠操作日志和库存流水追溯 |
| 图片存储 | 沿用 Redis（`lib/files.ts`），单张上限 600KB，正式上线再换对象存储 |
| 图文详情 | 手机不编辑；小程序保存时不提交 `detailHtml`，`updateProduct` 不会改动该字段 |
| 留在 PC | 批量上下架、流水导出 |

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

- 在微信公众平台把 `https://xiaojing.keyseal.top` 加入 **uploadFile 合法域名**（request 合法域名已配置）。
- 推送 main 前询问用户。
