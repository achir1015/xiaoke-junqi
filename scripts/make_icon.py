# 產生程式圖示：立體「司令」陸軍棋子＋戴軍帽的小柯機器人＋紅旗
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024


def font(size):
    for f in ('C:/Windows/Fonts/kaiu.ttf', 'C:/Windows/Fonts/msjhbd.ttc', '/System/Library/Fonts/Supplemental/Songti.ttc'):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def layer():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


img = layer()

# 背後的紅旗
fl = layer()
f = ImageDraw.Draw(fl)
f.rounded_rectangle((176, 70, 200, 600), 10, fill=(200, 170, 90, 255))
f.ellipse((166, 46, 210, 90), fill=(240, 200, 60, 255))
import math
f.polygon([(200, 92), (500, 190), (200, 290)], fill=(31, 95, 191, 255))
f.polygon([(200, 92), (500, 190), (200, 290)], outline=(255, 210, 80, 255), width=12)
f.text((282, 192), '軍', font=font(120), fill=(255, 240, 200, 255), anchor='mm')
img = Image.alpha_composite(img, fl)

# 陰影
sh = layer()
ImageDraw.Draw(sh).rounded_rectangle((70, 420, 620, 900), 70, fill=(0, 0, 0, 150))
img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(28)))

# 陸軍棋子（長方形、紅色側面、米白棋面）
tile = layer()
d = ImageDraw.Draw(tile)
d.rounded_rectangle((56, 430, 610, 860), 70, fill=(150, 24, 30, 255))       # 側面深紅
d.rounded_rectangle((56, 400, 610, 800), 70, fill=(198, 40, 40, 255))       # 側面
d.rounded_rectangle((40, 370, 594, 760), 66, fill=(252, 247, 232, 255))     # 棋面
d.rounded_rectangle((76, 404, 558, 726), 44, outline=(198, 40, 40, 255), width=14)
d.rounded_rectangle((96, 424, 538, 706), 34, outline=(198, 40, 40, 255), width=5)
d.text((318, 572), '司令', font=font(220), fill=(198, 40, 40, 255), anchor='mm', stroke_width=6, stroke_fill=(198, 40, 40, 255))
# 三顆星
for i in range(3):
    cx, cy, R = 136 + i * 44, 460, 17
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5
        r = R if k % 2 == 0 else R * 0.42
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=(198, 40, 40, 255))
tile = tile.rotate(-6, resample=Image.BICUBIC, center=(320, 600))
img = Image.alpha_composite(img, tile)

# 小柯機器人（戴軍帽）
rb = Image.new('RGBA', (S, S), (0, 0, 0, 0))
r = ImageDraw.Draw(rb)
cx, cy = 512, 560
# 耳朵
r.rounded_rectangle((cx - 262, cy - 60, cx - 210, cy + 90), 22, fill=(40, 120, 220, 255))
r.rounded_rectangle((cx + 210, cy - 60, cx + 262, cy + 90), 22, fill=(40, 120, 220, 255))
# 頭
r.ellipse((cx - 230, cy - 200, cx + 230, cy + 230), fill=(70, 150, 240, 255))
r.ellipse((cx - 214, cy - 186, cx + 214, cy + 210), fill=(240, 246, 255, 255))
# 面罩
r.rounded_rectangle((cx - 170, cy - 90, cx + 170, cy + 110), 90, fill=(24, 36, 64, 255))
# 眼睛（笑眼）
for ex in (cx - 72, cx + 72):
    r.arc((ex - 46, cy - 30, ex + 46, cy + 50), 200, 340, fill=(90, 230, 255, 255), width=22)
r.arc((cx - 50, cy + 30, cx + 50, cy + 90), 20, 160, fill=(90, 230, 255, 255), width=14)
r.ellipse((cx - 160, cy + 60, cx - 110, cy + 100), fill=(255, 140, 160, 200))
r.ellipse((cx + 110, cy + 60, cx + 160, cy + 100), fill=(255, 140, 160, 200))
# 軍帽：帽頂＋帽簷＋紅星
r.ellipse((cx - 250, cy - 330, cx + 250, cy - 120), fill=(176, 150, 96, 255))
r.rounded_rectangle((cx - 200, cy - 250, cx + 200, cy - 120), 40, fill=(196, 170, 112, 255))
r.rounded_rectangle((cx - 210, cy - 150, cx + 210, cy - 108), 20, fill=(92, 70, 36, 255))
r.pieslice((cx - 170, cy - 150, cx + 170, cy - 40), 0, 180, fill=(70, 52, 26, 255))
# 帽徽：金色圓徽＋「柯」字
r.ellipse((cx - 56, cy - 282, cx + 56, cy - 170), fill=(240, 196, 60, 255), outline=(255, 240, 180, 255), width=6)
r.text((cx, cy - 226), '柯', font=font(70), fill=(120, 70, 10, 255), anchor='mm')
# 敬禮的小手
r.rounded_rectangle((cx + 190, cy - 180, cx + 290, cy - 90), 30, fill=(70, 150, 240, 255))
sh2 = layer()
ImageDraw.Draw(sh2).ellipse((cx - 230, cy - 170, cx + 250, cy + 270), fill=(0, 0, 0, 120))
rb = Image.alpha_composite(sh2.filter(ImageFilter.GaussianBlur(24)), rb)
k = 0.74
rb = rb.resize((int(S * k), int(S * k)), Image.LANCZOS)
img.alpha_composite(rb, (int(790 - 512 * k), int(600 - 560 * k)))

os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
img.save(os.path.join(ROOT, 'build', 'icon.png'))
img.save(os.path.join(ROOT, 'build', 'icon.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
img.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, 'assets', 'icon-256.png'))
print('ok')
