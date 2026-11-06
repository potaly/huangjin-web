# 分类实拍图制作

从商品实拍图生成首页一级分类图（216×216 香槟底圆角 PNG），输出到 `public/img/cat-photo-*.png`。

1. 抠图（macOS 14+，用系统 Vision 的前景分割，不需要下载模型）：
   `swiftc -O cutout.swift -o cutout && ./cutout <jpg目录> <输出目录>`
   每个前景实例输出一张透明底 PNG；有多个实例时另外输出 `_all.png`。
2. 手拿着拍的图会连手一起抠出来，用 `python3 goldmask.py <抠图目录> <输出目录> 文件名...` 只保留金色像素。
3. 合成卡片：`python3 tile.py <透明底主体.png> <输出.png>`。
4. 部署后执行 `npx tsx --env-file=.env.local scripts/set-category-icons.ts` 切换线上分类图标。
