#!/usr/bin/env python3
# ============================================================
# بساطه تك (Basata Tech) icon generator — requires Pillow.
# Composes the white brand mark (scripts/assets/basata-mark.png,
# flat background #E30713) into:
#   public/icons/icon-192.png      rounded square, "any"
#   public/icons/icon-512.png      rounded square, "any"
#   public/icons/icon-maskable-512.png  full-bleed square, "maskable"
#   public/favicon.png             64px rounded square (browser favicon)
#   public/logo.png                240px mark tile (sidebar / boot splash)
#
# Usage: python3 scripts/gen-icons.py   (or: npm run icons)
# ============================================================
from PIL import Image, ImageDraw
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "scripts" / "assets" / "basata-mark.png"
OUT = ROOT / "public"

BRAND = (227, 7, 19, 255)  # #E30713 — flat logo red = sidebar gradient base

master = Image.open(MARK).convert("RGBA")


def rounded_tile(size: int, mark_h: int) -> Image.Image:
    """Red rounded square with the white mark centered at the given height."""
    tile = Image.new("RGBA", (size, size), BRAND)
    w = round(mark_h * master.width / master.height)
    mark = master.resize((w, mark_h), Image.LANCZOS)
    tile.alpha_composite(mark, ((size - w) // 2, (size - mark_h) // 2))
    # transparent outside the rounded corners (≈14/64, matches the old icon.svg rx)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.219), fill=255)
    tile.putalpha(mask)
    return tile


def full_bleed_tile(size: int, mark_h: int) -> Image.Image:
    """Full-bleed red square — content stays inside the maskable safe zone."""
    tile = Image.new("RGBA", (size, size), BRAND)
    w = round(mark_h * master.width / master.height)
    mark = master.resize((w, mark_h), Image.LANCZOS)
    tile.alpha_composite(mark, ((size - w) // 2, (size - mark_h) // 2))
    return tile


# "any" icons: mark ≈ 56% of canvas
(OUT / "icons").mkdir(parents=True, exist_ok=True)
rounded_tile(512, round(512 * 0.56)).save(OUT / "icons" / "icon-512.png")
rounded_tile(192, round(192 * 0.56)).save(OUT / "icons" / "icon-192.png")
# maskable: mark diagonal must fit inside the central 80% circle (h 300 → diag ≈ 402 ≤ 409)
full_bleed_tile(512, 300).save(OUT / "icons" / "icon-maskable-512.png")
rounded_tile(64, round(64 * 0.56)).save(OUT / "favicon.png")
# logo for sidebar / boot splash (sits on flat #E30713 surfaces)
master.resize((240, round(240 * master.height / master.width)), Image.LANCZOS).save(OUT / "logo.png")

for f in ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]:
    print(f"public/icons/{f} — {Image.open(OUT / 'icons' / f).size}")
print(f"public/favicon.png — {Image.open(OUT / 'favicon.png').size}")
print(f"public/logo.png — {Image.open(OUT / 'logo.png').size}")
