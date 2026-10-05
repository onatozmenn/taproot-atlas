#!/usr/bin/env python3
"""Generate Taproot Atlas brand assets (favicon, touch icons, OG image).

Droplet in Old Glory Blue (#0a3161) packed with white stars, matching
web/src/components/Logo.tsx. Run: python scripts/make-brand-assets.py
Outputs go to web/public/ (Vite copies them to dist/ untouched).
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "public")
BLUE = (10, 49, 97, 255)
WHITE = (255, 255, 255, 255)
INK = (17, 20, 24)
MUTED = (91, 97, 107)

WIN_FONTS = r"C:\Windows\Fonts"


def star(draw, cx, cy, outer, inner, fill):
    pts = []
    for k in range(10):
        r = outer if k % 2 == 0 else inner
        a = math.radians(k * 36 - 90)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    draw.polygon(pts, fill=fill)


def droplet_shape(draw, mask_draw, cx, y0, r, fill):
    """Teardrop: circle + apex triangle, drawn on draw and mask_draw."""
    draw.ellipse([cx - r, y0 - r, cx + r, y0 + r], fill=fill)
    draw.polygon([(cx, y0 - 2.05 * r), (cx - 0.98 * r, y0 + 0.15 * r), (cx + 0.98 * r, y0 + 0.15 * r)], fill=fill)
    mask_draw.ellipse([cx - r, y0 - r, cx + r, y0 + r], fill=255)
    mask_draw.polygon(
        [(cx, y0 - 2.05 * r), (cx - 0.98 * r, y0 + 0.15 * r), (cx + 0.98 * r, y0 + 0.15 * r)], fill=255
    )


def droplet_icon(px):
    """RGBA droplet-with-stars at px x px, supersampled for smooth edges."""
    s = 8
    W = px * s
    cx, y0, r = W / 2, W * 0.625, W * 0.297
    # Blue base with droplet alpha.
    base = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    mask = Image.new("L", (W, W), 0)
    droplet_shape(ImageDraw.Draw(base), ImageDraw.Draw(mask), cx, y0, r, BLUE)
    base.putalpha(mask)
    # White stars, clipped to the droplet.
    stars = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ds = ImageDraw.Draw(stars)
    gap = W * 0.128
    row = 0
    y = W * 0.14
    while y <= W * 0.88:
        off = 0 if row % 2 == 0 else gap / 2
        x = W * 0.25 + off
        while x <= W * 0.77:
            star(ds, x, y, W * 0.045, W * 0.018, WHITE)
            x += gap
        y += gap
        row += 1
    clipped = Image.composite(stars, Image.new("RGBA", (W, W), (0, 0, 0, 0)), mask)
    return Image.alpha_composite(base, clipped).resize((px, px), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)

    icon48 = droplet_icon(48)
    icon48.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    droplet_icon(32).save(os.path.join(OUT, "favicon-32x32.png"))
    droplet_icon(16).save(os.path.join(OUT, "favicon-16x16.png"))
    droplet_icon(180).save(os.path.join(OUT, "apple-touch-icon.png"))
    droplet_icon(192).save(os.path.join(OUT, "icon-192.png"))
    droplet_icon(512).save(os.path.join(OUT, "icon-512.png"))

    # OG card 1200x630: white, droplet left, serif headline + muted subline.
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), (255, 255, 255))
    mark = droplet_icon(360).convert("RGB", dither=None)
    # paste with alpha
    rgba = droplet_icon(360)
    card.paste(rgba, (110, 135), rgba)
    d = ImageDraw.Draw(card)
    try:
        headline = ImageFont.truetype(os.path.join(WIN_FONTS, "georgia.ttf"), 88)
        headline_b = ImageFont.truetype(os.path.join(WIN_FONTS, "georgiab.ttf"), 88)
        sub = ImageFont.truetype(os.path.join(WIN_FONTS, "arial.ttf"), 40)
    except OSError:
        headline = headline_b = sub = ImageFont.load_default()
    d.text((540, 170), "Taproot Atlas", font=headline_b, fill=INK)
    d.text((540, 300), "Where does your tap water", font=sub, fill=INK)
    d.text((540, 355), "come from?", font=sub, fill=INK)
    d.text((540, 440), "EPA & NYC open records", font=sub, fill=MUTED)
    card.save(os.path.join(OUT, "og-image.png"))

    print("wrote:", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
