import sys, os
import numpy as np
from PIL import Image, ImageFilter
# 用法：python3 goldmask.py <抠图目录> <输出目录> 文件名...
# 在前景抠图基础上，只保留金色像素（去掉手、皮肤），再做闭运算补洞、开运算去噪点，最后裁到主体
src, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
for n in names:
    im = Image.open(os.path.join(src, n)).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    gold = (al > 0.5) & (h >= 32) & (h <= 66) & (s > 0.38) & (mx > 0.22)
    m = Image.fromarray((gold * 255).astype(np.uint8))
    k = max(3, (min(im.size) // 120) | 1)
    m = m.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))      # 闭运算：补宝石、高光造成的小洞
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))      # 开运算：去掉零星噪点
    m = Image.fromarray(np.minimum(np.asarray(m), (al * 255).astype(np.uint8)))
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    res = im.copy(); res.putalpha(m)
    bb = m.point(lambda v: 255 if v > 40 else 0).getbbox()
    if bb: res = res.crop(bb)
    res.save(os.path.join(out, n))
    print(n, res.size)
