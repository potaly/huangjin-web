import sys
from PIL import Image, ImageDraw, ImageFilter
# 用法：python3 tile.py <透明底主体png> <输出png> [主体占比，默认 0.88]
# 216x216（72 的 3 倍），香槟底圆角块，主体居中，带很淡的投影
src, out = sys.argv[1], sys.argv[2]
W, R = 216, 60
FILL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.88
SS = 3; N = W * SS
obj = Image.open(src).convert('RGBA')
box = int(N * FILL)
obj.thumbnail((box, box), Image.LANCZOS)
if max(obj.size) < box:
    k = box / max(obj.size); obj = obj.resize((int(obj.width * k), int(obj.height * k)), Image.LANCZOS)
tile = Image.new('RGBA', (N, N), (0, 0, 0, 0))
mask = Image.new('L', (N, N), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, N - 1, N - 1), R * SS, fill=255)
bg = Image.new('RGBA', (N, N), '#f3ece2')
x, y = (N - obj.width) // 2, (N - obj.height) // 2
sh = Image.new('RGBA', (N, N), (0, 0, 0, 0))
shadow = Image.new('RGBA', obj.size, (90, 60, 20, 60)); shadow.putalpha(obj.getchannel('A').point(lambda v: v * 60 // 255))
sh.alpha_composite(shadow, (x, y + 6 * SS)); sh = sh.filter(ImageFilter.GaussianBlur(5 * SS))
bg.alpha_composite(sh); bg.alpha_composite(obj, (x, y))
tile.paste(bg, (0, 0), mask)
tile.resize((W, W), Image.LANCZOS).save(out, optimize=True)
