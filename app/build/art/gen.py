# Installer artwork for FPS Boost: MUI2 sidebar (164x314, welcome/finish pages) + header (150x57), drawn at 4x then downsampled.
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, sys
S = 4
MARK = Image.open('/root/fpsboost/fpsboost_white.png').convert('RGBA')
MARK = MARK.crop(MARK.getbbox())
def font(size, w=800):
    f = ImageFont.truetype('Inter.ttf', size * S)
    try: f.set_variation_by_axes([14 if size < 14 else 32, w])
    except Exception: pass
    return f
def bg(w, h):
    W, H = w * S, h * S
    im = Image.new('RGB', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            t = y / H
            r, g, b = 16 + 6 * t, 17 + 2 * t, 20 + 20 * t          # --bg #101114 → a deeper violet-black
            px[x, y] = (int(r), int(g), int(b))
    return im
def glow(im, cx, cy, rad, col, a):
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col + (a,))
    lay = lay.filter(ImageFilter.GaussianBlur(rad * .55))
    im.paste(lay, (0, 0), lay)
def grid(im, step, a):
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for x in range(0, im.size[0], step): d.line([x, 0, x, im.size[1]], fill=(139, 92, 246, a), width=S // 2 or 1)
    for y in range(0, im.size[1], step): d.line([0, y, im.size[0], y], fill=(139, 92, 246, a), width=S // 2 or 1)
    # fade the grid out toward the top
    m = Image.linear_gradient('L').resize(im.size)
    lay.putalpha(Image.eval(Image.composite(lay.getchannel('A'), Image.new('L', im.size, 0), m), lambda v: v))
    im.paste(lay, (0, 0), lay)
def mark(im, cx, cy, h):
    m = MARK.resize((int(MARK.width * h / MARK.height), h), Image.LANCZOS)
    p = int(h * .5)                                   # pad so the glow is not clipped to the logo's box
    a = Image.new('L', (m.width + 2 * p, m.height + 2 * p), 0); a.paste(m.getchannel('A'), (p, p))
    a = a.filter(ImageFilter.GaussianBlur(h * .14)).point(lambda v: int(v * .8))
    sh = Image.new('RGBA', a.size, (139, 92, 246, 255)); sh.putalpha(a)
    im.alpha_composite(sh, (cx - m.width // 2 - p, cy - m.height // 2 - p))
    im.paste(m, (cx - m.width // 2, cy - m.height // 2), m)
def text(d, xy, s, f, fill, anchor='mm', spacing=0):
    if not spacing: d.text(xy, s, font=f, fill=fill, anchor=anchor); return
    w = sum(d.textlength(c, font=f) for c in s) + spacing * (len(s) - 1)
    x = xy[0] - w / 2
    for c in s:
        d.text((x, xy[1]), c, font=f, fill=fill, anchor='lm'); x += d.textlength(c, font=f) + spacing

def sidebar(path, sub):
    w, h = 164, 314
    im = bg(w, h).convert('RGBA')
    glow(im, w * S // 2, 118 * S, 70 * S, (139, 92, 246), 120)
    glow(im, 20 * S, 300 * S, 60 * S, (109, 63, 224), 90)
    grid(im, 14 * S, 38)
    mark(im, w * S // 2, 112 * S, 54 * S)
    d = ImageDraw.Draw(im)
    text(d, (w * S / 2, 176 * S), 'FPS BOOST', font(17, 800), (255, 255, 255), spacing=1.2 * S)
    d.rounded_rectangle([(w / 2 - 14) * S, 190 * S, (w / 2 + 14) * S, 192 * S], radius=S, fill=(157, 116, 255))
    text(d, (w * S / 2, 206 * S), 'Boost FPS. Reduce Ping.', font(9, 500), (200, 190, 230))
    text(d, (w * S / 2, 296 * S), sub, font(8, 500), (139, 144, 158))
    im.convert('RGB').resize((w, h), Image.LANCZOS).save(path)
def header(path):
    w, h = 150, 57
    im = bg(w, h).convert('RGBA')
    glow(im, 26 * S, 28 * S, 26 * S, (139, 92, 246), 130)
    mark(im, 26 * S, 28 * S, 22 * S)
    d = ImageDraw.Draw(im)
    d.text((48 * S, 23 * S), 'FPS BOOST', font=font(13, 800), fill=(255, 255, 255), anchor='lm')
    d.text((48 * S, 37 * S), 'fpsboost.ir', font=font(8, 500), fill=(157, 116, 255), anchor='lm')
    im.convert('RGB').resize((w, h), Image.LANCZOS).save(path)

out = sys.argv[1]
sidebar(out + '/installerSidebar.bmp', 'fpsboost.ir')
sidebar(out + '/uninstallerSidebar.bmp', 'fpsboost.ir')
header(out + '/installerHeader.bmp')
