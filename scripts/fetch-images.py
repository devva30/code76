"""Downloads, crops, warm-grades and exports the demo photography as WebP.

All photos are from Pexels (https://www.pexels.com/license/ — free to use).
Run:  python scripts/fetch-images.py      (re-runnable; skips existing files)
Replace any file in public/images with your own shoot using the same name.
"""
import io, os, sys, urllib.request
from PIL import Image, ImageEnhance

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'images')

# name, pexels id, output width, aspect (w/h) or None, focus x, focus y
MANIFEST = [
    # editorial
    ('editorial/hero',            20381775, 2400, None,   0.5, 0.5),
    ('editorial/hero-mobile',     20381775, 1600, 0.62,   0.66, 0.5),
    # hero slideshow (wide desktop + portrait mobile)
    ('editorial/slide-oversized',        5384428, 2400, None, 0.5, 0.5),
    ('editorial/slide-oversized-mobile', 5384428, 1600, 0.62, 0.57, 0.5),
    ('editorial/slide-colonnade',        3414716, 2400, None, 0.5, 0.5),
    ('editorial/slide-colonnade-mobile', 3414716, 1600, 0.62, 0.74, 0.5),
    ('editorial/slide-back',             6311653, 2400, None, 0.5, 0.5),
    ('editorial/slide-back-mobile',      6311653, 1600, 0.62, 0.49, 0.5),
    ('editorial/look-concrete',   9289219,  1400, 0.8,    0.5, 0.6),
    ('editorial/look-colonnade',  3414716,  1800, None,   0.5, 0.5),
    ('editorial/look-arch',       7319142,  1200, 0.72,   0.5, 0.5),
    ('editorial/look-back',       6311653,  1800, None,   0.5, 0.5),
    ('editorial/look-wall',       7824049,  1200, 0.8,    0.5, 0.4),
    ('editorial/look-light',      37704845, 1200, 0.75,   0.5, 0.6),
    ('editorial/fit-oversized',   5384428,  1400, 0.78,   0.56, 0.5),
    ('editorial/fit-regular',     4101142,  1400, 0.78,   0.5, 0.45),
    ('editorial/detail-shoulder', 30710033, 1200, 0.8,    0.5, 0.4),
    ('editorial/detail-fabric',   37704841, 1200, 0.8,    0.5, 0.5),
    ('editorial/about-arch',      7319132,  1600, None,   0.5, 0.5),
    # Form Oversized Tee
    ('products/form-noir-1',      9558577,  1000, 0.8,    0.5, 0.25),
    ('products/form-noir-2',      9558588,  1000, 0.8,    0.5, 0.3),
    ('products/form-noir-3',      9558581,  1000, 0.8,    0.5, 0.3),
    ('products/form-noir-4',      9558706,  1000, 0.8,    0.5, 0.4),
    ('products/form-rose-1',      9558568,  1000, 0.8,    0.5, 0.25),
    ('products/form-rose-2',      9558764,  1000, 0.8,    0.5, 0.3),
    ('products/form-rose-3',      9558761,  1000, 0.8,    0.5, 0.45),
    ('products/form-rose-4',      9558765,  1000, 0.8,    0.5, 0.4),
    ('products/form-chalk-1',     9558725,  1000, 0.8,    0.5, 0.3),
    ('products/form-chalk-2',     9558752,  1000, 0.8,    0.5, 0.3),
    ('products/form-chalk-3',     9558755,  1000, 0.8,    0.5, 0.3),
    ('products/form-chalk-4',     9558590,  1000, 0.8,    0.5, 0.3),
    # Daily Regular Tee
    ('products/daily-white-1',    8217461,  1000, 0.8,    0.5, 0.3),
    ('products/daily-white-2',    6311141,  1000, 0.8,    0.5, 0.3),
    ('products/daily-white-3',    11671964, 1000, 0.8,    0.5, 0.5),
    ('products/daily-white-4',    30710033, 1000, 0.8,    0.5, 0.4),
    ('products/daily-heather-1',  3760610,  1000, 0.8,    0.5, 0.45),
    ('products/daily-heather-2',  6311653,  1000, 0.8,    0.52, 0.5),
    ('products/daily-noir-1',     8532616,  1000, 0.8,    0.48, 0.5),
    ('products/daily-noir-2',     7319032,  1000, 0.8,    0.5, 0.4),
    ('products/daily-noir-3',     9289219,  1000, 0.8,    0.5, 0.6),
    # Relaxed Pocket Tee
    ('products/pocket-sand-1',    5902887,  1000, 0.8,    0.5, 0.35),
    ('products/pocket-sand-2',    33065360, 1000, 0.8,    0.5, 0.35),
    ('products/pocket-sand-3',    33065361, 1000, 0.8,    0.5, 0.35),
    ('products/pocket-sand-4',    33065359, 1000, 0.8,    0.5, 0.35),
    # Weekend Relaxed Tee
    ('products/weekend-white-1',  6786614,  1000, 0.8,    0.5, 0.35),
    ('products/weekend-white-2',  6310898,  1000, 0.8,    0.5, 0.35),
    ('products/weekend-white-3',  8217466,  1000, 0.8,    0.5, 0.35),
    ('products/weekend-white-4',  9558716,  1000, 0.8,    0.5, 0.35),
    # Heavyweight Boxy Tee
    ('products/boxy-stone-1',     20381775, 1000, 0.8,    0.69, 0.5),
    ('products/boxy-stone-2',     37704841, 1000, 0.8,    0.5, 0.5),
    ('products/boxy-stone-3',     37704845, 1000, 0.8,    0.5, 0.6),
    # Field Oversized Tee
    ('products/field-bone-1',     9558713,  1000, 0.8,    0.5, 0.3),
    ('products/field-bone-2',     5384428,  1000, 0.8,    0.56, 0.5),
    ('products/field-bone-3',     9558601,  1000, 0.8,    0.5, 0.3),
    ('products/field-bone-4',     9558758,  1000, 0.8,    0.5, 0.4),
]

def is_banner(name):
    return name.startswith('editorial/hero') or name.startswith('editorial/slide-')

def crisp(im):
    """Banner grade: gentle warmth, full contrast and a light sharpen for high-density screens."""
    from PIL import ImageFilter
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.015 + 1)))
    b = b.point(lambda v: int(v * 0.975))
    im = Image.merge('RGB', (r, g, b))
    im = ImageEnhance.Color(im).enhance(0.98)
    return im.filter(ImageFilter.UnsharpMask(radius=1.1, percent=55, threshold=2))

def warm(im):
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.025 + 2)))
    b = b.point(lambda v: int(v * 0.955))
    im = Image.merge('RGB', (r, g, b))
    im = ImageEnhance.Color(im).enhance(0.92)
    return ImageEnhance.Contrast(im).enhance(0.97)

def crop(im, aspect, fx, fy):
    w, h = im.size
    if aspect is None: return im
    if w / h > aspect:
        nw = int(h * aspect); x = int(max(0, min(w - nw, fx * w - nw / 2)))
        return im.crop((x, 0, x + nw, h))
    nh = int(w / aspect); y = int(max(0, min(h - nh, fy * h - nh / 2)))
    return im.crop((0, y, w, y + nh))

# Third-party neck labels visible in some source frames are cloned out.
# name -> list of (relative x, relative y, search radius as fraction of width, clone dx, clone dy)
RETOUCH = {
    'products/boxy-stone-2':    [(0.53, 0.32, 0.06, 0.0, 0.11)],
    'editorial/detail-fabric':  [(0.53, 0.32, 0.06, 0.0, 0.11)],
    'products/boxy-stone-3':    [(0.40, 0.66, 0.04, 0.05, 0.06)],
    'editorial/look-light':     [(0.30, 0.70, 0.04, 0.05, 0.06)],
}

def retouch(im, specs):
    from PIL import ImageDraw, ImageFilter
    w, h = im.size
    gray = im.convert('L')
    for rx, ry, rr, dx, dy in specs:
        cx, cy, r = int(rx * w), int(ry * h), int(rr * w)
        box = (max(0, cx - r), max(0, cy - r), min(w, cx + r), min(h, cy + r))
        dark = [(x, y) for y in range(box[1], box[3]) for x in range(box[0], box[2]) if gray.getpixel((x, y)) < 95]
        if not dark: continue
        xs, ys = [d[0] for d in dark], [d[1] for d in dark]
        pad = int(0.012 * w)
        x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
        ox, oy = int(dx * w), int(dy * h)
        patch = im.crop((x0 + ox, y0 + oy, x1 + ox, y1 + oy))
        mask = Image.new('L', patch.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((pad // 2, pad // 2, patch.width - pad // 2, patch.height - pad // 2), radius=pad, fill=255)
        im.paste(patch, (x0, y0), mask.filter(ImageFilter.GaussianBlur(pad / 2)))
    return im

cache = {}
for name, pid, width, aspect, fx, fy in MANIFEST:
    out = os.path.join(ROOT, name + '.webp')
    if os.path.exists(out) and '--force' not in sys.argv: continue
    if (pid, is_banner(name)) not in cache:
        size = 4200 if is_banner(name) else 2600
        url = f'https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w={size}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        cache[(pid, is_banner(name))] = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=90).read())).convert('RGB')
    im = crop(cache[(pid, is_banner(name))], aspect, fx, fy)
    if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im = crisp(im) if is_banner(name) else warm(im)
    if name in RETOUCH: im = retouch(im, RETOUCH[name])
    im.save(out, 'WEBP', quality=(78 if name.endswith('-mobile') else 84) if is_banner(name) else 78, method=6)
    print(f'{name}: {im.size}')
