"""Generate the PWA icons and the compressed cover from the hand-painted cover.png (Recepten2).

Usage: python tools/make-icons.py
Outputs (public/): cover.webp, icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png,
icons/apple-touch-icon.png, icons/icon-192-next.png, icons/icon-512-next.png, icons/icon-maskable-512-next.png
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "cover.png"
PUB = ROOT / "public"
ICONS = PUB / "icons"
ICONS.mkdir(parents=True, exist_ok=True)

PAPER = (234, 243, 251)      # papier-blauw, the cover's background
NEXT_YELLOW = (247, 201, 72)  # band for the NEXT test channel icon

cover = Image.open(SRC).convert("RGB")
w, h = cover.size

# 1. Compressed cover for the app (header of "Het verhaal", install cards).
small = cover.copy()
small.thumbnail((1200, 1200))
small.save(PUB / "cover.webp", "WEBP", quality=80, method=6)

# 2. Square crop around the centre of the painting (the handwritten title) for the icons.
side = min(w, h)
left = (w - side) // 2
square = cover.crop((left, 0, left + side, side))


def make_icon(size: int, maskable: bool, next_channel: bool) -> Image.Image:
    """Any-purpose icons use the crop edge to edge; maskable icons keep the art inside the
    central 80% safe zone on a paper-blue field so platform masks do not cut the title."""
    canvas = Image.new("RGB", (size, size), PAPER)
    if maskable:
        inner = int(size * 0.80)
        art = square.resize((inner, inner), Image.LANCZOS)
        off = (size - inner) // 2
        canvas.paste(art, (off, off))
    else:
        canvas = square.resize((size, size), Image.LANCZOS)
    if next_channel:
        band_h = max(8, size // 6)
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, size - band_h, size, size), fill=NEXT_YELLOW)
    return canvas


for next_channel, suffix in ((False, ""), (True, "-next")):
    make_icon(192, False, next_channel).save(ICONS / f"icon-192{suffix}.png", optimize=True)
    make_icon(512, False, next_channel).save(ICONS / f"icon-512{suffix}.png", optimize=True)
    make_icon(512, True, next_channel).save(ICONS / f"icon-maskable-512{suffix}.png", optimize=True)

# iOS home-screen icon: 180x180, opaque, no transparency.
make_icon(180, False, False).save(ICONS / "apple-touch-icon.png", optimize=True)

print("icons written to", ICONS)
for p in sorted(ICONS.glob("*.png")) + [PUB / "cover.webp"]:
    print(f"  {p.name:28} {p.stat().st_size / 1024:6.1f} KB")
