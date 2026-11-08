# 小程序全量管理 第二部分 · 任务与验收标准

设计见 `docs/superpowers/specs/2026-11-08-mp-admin-design.md` 第 1、2、8 节。第一部分（`2026-11-08-mp-admin.md`）已实现商品和库存。

工作方式：管理者拆任务并定验收标准；每个任务由新开的执行者完成；评估者独立于执行者，只看 spec、diff 和运行结果，不看执行者的自述。不通过就退回修复并重新评估。

通用约束：
- 后端目录 `/Users/roland/developer/xiaojing/huangjin-web-mp-admin`，分支 `feat/mp-admin`。小程序目录 `/Users/roland/developer/xiaojing/xiaojing-mp`（非 git）。
- commit message 只写正文，禁止 Claude 署名 trailer。只 `git add` 自己的文件，不加 `node_modules` 符号链接。
- PC 路由的 URL、入参、返回结构和提示文案不变。
- 小程序用 Promise 链，不用 async/await；配色和控件沿用 `manage-products`、`manage-product-edit`、`app.wxss` 的 `.m-*` 样式；每页用 `state-view` 处理加载、空、错误。

## Task 14：内容模块后端

抽 `lib/content-service.ts`，PC 的 categories、materials、notices、banners 路由改为调用；新增 `/api/mall/manage/{categories,materials,notices,banners}` 接口。

验收标准：
1. PC 路由只保留鉴权、读参、`mutate`、`addLog` 和返回，校验全部在服务函数里。
2. 服务函数覆盖现有全部规则：分类同级重名、最多两级、有子分类或商品不能删、停用一级同步停用二级；材质编码转大写且唯一、被用不能删；公告 `sanitizeHtml`、发布时补 `publishAt`；轮播外链格式、商品和公告跳转必须是数字 ID、非 NONE 必须有目标。
3. `tests/content-service.test.ts` 对上述每条规则至少一个用例。
4. 小程序接口要求 `MANAGE_ROLES`，写接口在 `mutate` 内用 `mallActor` 并 `addLog`，`requestUri` 是小程序路径。
5. 全部测试和 `tsc --noEmit` 通过。

## Task 15：工作台、批量、导出、系统参数、操作日志后端

验收标准：
1. `dashboardData(db)` 从 PC dashboard 路由抽出，PC 返回不变；`GET /api/mall/manage/dashboard` 要求 `MANAGE_ROLES`。
2. `batchSetProductStatus` 从 PC 路由抽出，返回 `{succeeded, skipped}`，规则不变；`PUT /api/mall/manage/products/batch-status` 记日志。
3. `stockLogsCsv` 从 PC 导出路由抽出，内容含 BOM；`GET /api/mall/manage/stock-logs/export` 用 Bearer 鉴权，未授权时返回 401 或 403 状态码，文件名以 `.csv` 结尾。
4. `lib/config-service.ts` 的 `listConfigs`、`saveConfigs`（含库存展示方式校验）、`queryOperationLogs` 从 PC 路由抽出；`GET/PUT /api/mall/manage/configs` 和 `GET /api/mall/manage/operation-logs` 只允许 OWNER，SALES 得到 403。
5. 纯函数有测试，全部测试和 `tsc --noEmit` 通过。

## Task 16：工作台页、分类页、材质页（小程序）

验收标准：
1. 创建 `pages/manage-home`、`pages/manage-categories`、`pages/manage-materials` 并注册到 `app.json`。`我的` 页对 OWNER、SALES 显示「管理工作台」。
2. 工作台显示全部统计、材质汇总、预警（点击进库存页且只看预警）、最近流水，入口齐全：订单、用户、商品、库存、流水、分类、材质、公告、轮播图；老板额外有系统设置和操作日志，业务员看不到。`manage-stocks` 支持 `?onlyWarn=1`。
3. 分类页：两级展示，新增一级、新增二级、编辑（名称、图标上传、排序、启用）、删除二次确认，后端错误 toast 显示。
4. 材质页：新增、编辑（编码、名称、成色、排序、启用）、删除二次确认。
5. 必填项前端校验。提交中按钮禁用。

## Task 17：图文编辑页、公告（小程序）

验收标准：
1. `pages/manage-rich-edit` 用 `editor` 组件，工具栏有粗体、斜体、标题、有序和无序列表、插入图片；通过 `eventChannel` 的 `init` 接收 HTML，`done` 回传，返回不点完成则不回传。相对图片地址载入时补全。
2. `manage-product-edit` 增加「图文详情」入口；只有收到 `done` 后 `buildPayload` 才带 `detailHtml`，否则字段不出现。
3. `pages/manage-notices`：状态筛选、搜索、分页、置顶和可见状态标记。
4. `pages/manage-notice-edit`：标题必填、封面上传、正文入口、置顶、弹窗、状态三选一、生效和过期时间（日期加时间，可清空）；删除二次确认；保存后列表刷新。

## Task 18：轮播图（小程序）

验收标准：
1. `pages/manage-banners`：图片、标题、状态、跳转说明、排序；点击编辑，有新增入口。
2. `pages/manage-banner-edit`：图片上传必填、标题、排序、启用、跳转类型四选一。商品和公告用可搜索的选择弹层，调用现有列表接口，存入数字 ID 并显示名称；外链校验 http(s)；编辑已有轮播时显示当前目标的名称；删除二次确认。

## Task 19：系统设置、操作日志、批量上下架、流水导出（小程序）

验收标准：
1. `pages/manage-configs`：分组与 PC 的 `app/admin/(panel)/configs/page.tsx` 一致，含「其他参数」兜底；`mall.login.required` 和 `price.allow.order.without.today` 用开关，`stock.display.mode` 用选择器，`contact.wechat.qrcode` 上传图片；保存全部后 toast。非老板进入时显示无权限。
2. `pages/manage-logs`：模块筛选、搜索、分页，显示操作人、模块、动作、时间。非老板显示无权限。
3. `manage-products` 增加批量模式：勾选、全选当前页、批量上架和下架，结果显示成功数和跳过原因，完成后退出批量模式并刷新。
4. `manage-stock-logs` 增加导出：按当前筛选条件，`wx.downloadFile` 带 `Authorization`，成功后按钮变为「发送到微信」，点击调用 `wx.shareFileMessage`；筛选变化后回到「导出」。
5. 全部小程序页面文件齐全且已注册。

## 评估协议

评估环境：`http://localhost:3301` 为内存模式的本地服务（未连接 Redis，不接触线上数据），种子数据含账号：OWNER `13900000001`、SALES `13900000002`、CUSTOMER `13900000003`，通过 `POST /api/mall/auth/phone-login` 取 token。

后端评估至少包含：
- `npx tsx --test "tests/**/*.test.ts"` 和 `npx tsc --noEmit` 的真实输出。
- 每个新接口分别用未登录、CUSTOMER、SALES、OWNER 实测权限，核对 `code` 或 HTTP 状态。
- 每个写接口实测数据变化（再读一次），并用 OWNER 查 `operation-logs` 确认日志的操作人带「（小程序）」、`requestUri` 正确。
- 被改动的 PC 路由：审查 diff 确认行为不变，并实际调用校验返回结构。

小程序评估至少包含：
- `app.json` 注册、四类文件齐全、`node --check`、WXML 标签配对。
- WXML 中的事件处理函数都在页面 JS 中存在，绑定的数据字段都有来源。
- 用 Node 桩环境（模拟 `wx`、`Page`、`getCurrentPages`，`wx.request` 转发到 `localhost:3301`）实际运行页面 JS：加载、提交、错误分支；接口路径和字段与后端一致。
- 图片上传：用真实 JPEG 经 multipart 调上传接口；压缩分支用桩验证。
- 表单校验、提交中防重复、加载和错误状态。

评估结论必须是 PASS 或 FAIL，FAIL 时列出可复现的问题和证据。
