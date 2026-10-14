"""
Builds the in-app logo, the app icons and the iOS launch screens. Needs Python 3
with Pillow:

    python -m pip install pillow
    python scripts/make-icons.py

Two pieces of artwork, each used in its own places:

- public/images/werdheeras.jpeg, the flat WE ARE / DHEERAS wordmark, is the
  logo everywhere inside the app (header, login, kiosk, quiz, forms). Its white
  backing is turned into transparency and it is cropped to the ink.
- public/images/Glossy We Are DHEERAS App Icon.png, the lockup on a glossy white
  tile, is only the installed app's icon and the screen shown while it opens.
  It comes on a black square; the black outside the tile is cut away
  (flood-filled from the corners, so nothing black inside the tile is touched).

The browser tab is the chapter's red D, set from type: at 16px either artwork
is a smudge.

After changing the icons or launch screens, bump ICON_VERSION in
src/lib/app-icons.ts: phones keep an installed app's icon under its URL.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

LOGO = "public/images/werdheeras.jpeg"
ICON = "public/images/Glossy We Are DHEERAS App Icon.png"
WHITE = (255, 255, 255, 255)
# Anything this dark that touches the corners is the black backing, not the tile.
BACKING_MAX = 40
RED = (206, 31, 46, 255)  # the chapter's red
# A heavy grotesque for the tab's D; the first one found is used.
FONTS = ["ariblk.ttf", "Arial Black.ttf", "Archivo-Black.ttf", "LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf", "arialbd.ttf"]


def letter(text, size, fill):
    """One letter set from type, trimmed to its ink."""
    for name in FONTS:
        try:
            font = ImageFont.truetype(name, size)
            break
        except OSError:
            continue
    else:
        raise SystemExit(f"No bold grotesque found. Install one of: {', '.join(FONTS)}")
    im = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((size // 2, size // 2), text, font=font, fill=fill)
    return im.crop(im.getchannel("A").getbbox())


def wordmark(path):
    """
    The flat wordmark on transparent, cropped to its ink.

    White is dropped on a short ramp rather than a hard cut, which keeps the
    soft edge of the letters (and copes with JPEG noise in the backing). This
    is a two-colour mark, so nothing in it is printed in a near-white tint.
    """
    im = Image.open(path).convert("RGBA")
    r, g, b, _ = im.split()
    # The lightest ink still reads as ink on every channel, so the darkest
    # channel is what says "something is here".
    darkest = ImageChops.darker(ImageChops.darker(r, g), b)
    alpha = darkest.point(lambda v: 255 if v <= 230 else 0 if v >= 247 else round(255 * (247 - v) / 17))
    im.putalpha(alpha)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit(f"{path} looks blank — nothing but white in it.")
    return im.crop(box)


def tile(path):
    """The glossy tile alone, on transparent, cropped to its edges."""
    im = Image.open(path).convert("RGBA")
    # Mark the backing by flood-filling a copy from each corner, then use the
    # mark as the cut-out.
    probe = im.convert("RGB")
    for corner in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]:
        if max(probe.getpixel(corner)) <= BACKING_MAX:
            ImageDraw.floodfill(probe, corner, (255, 0, 255), thresh=BACKING_MAX)
    alpha = Image.new("L", im.size, 255)
    px, ax = probe.load(), alpha.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y] == (255, 0, 255):
                ax[x, y] = 0
    im.putalpha(alpha)
    box = alpha.getbbox()
    if box is None:
        raise SystemExit(f"{path} looks blank — nothing but backing in it.")
    return im.crop(box)


def fit(im, max_w, max_h):
    k = min(max_w / im.width, max_h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def square(im, size, frac, bg):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = fit(im, size * frac, size * frac)
    canvas.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return canvas


for path in (LOGO, ICON):
    if not Path(path).is_file():
        raise SystemExit(f"No such file: {path}")
logo, icon = wordmark(LOGO), tile(ICON)
CLEAR = (0, 0, 0, 0)

Path("src/assets").mkdir(parents=True, exist_ok=True)
# Shown in the app (header, login, kiosk, quiz, forms) by src/components/brand-logo.tsx.
fit(logo, 640, 640).save("src/assets/we-are-dheeras-logo.png", optimize=True)
# Browser tab: the red D on transparent.
mark = letter("D", 512, RED)
square(mark, 256, 0.88, CLEAR).save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
square(mark, 192, 0.84, CLEAR).save("src/app/icon.png", optimize=True)
# Installable icons: the tile with its rounded corners, on transparent.
square(icon, 192, 1.0, CLEAR).save("public/icons/app-192.png", optimize=True)
square(icon, 512, 1.0, CLEAR).save("public/icons/app-512.png", optimize=True)
# iOS has no transparency and rounds the corners itself, so its icon is the tile
# filling a white square.
square(icon, 180, 1.0, WHITE).convert("RGB").save("src/app/apple-icon.png", optimize=True)
# Maskable: Android crops to circles and other shapes, so the tile shrinks until
# the lockup sits inside the central safe zone (the 80%-wide circle), on white.
square(icon, 512, 0.8, WHITE).convert("RGB").save("public/icons/app-maskable-512.png", optimize=True)

# Launch screens: the app icon centred on white while the installed app opens.
# Android draws its own from the manifest (icon + background_color); iOS shows
# only an image made for the exact screen, else a blank white page. Portrait
# only, as the manifest locks the app to portrait. Each entry is the screen in
# CSS points and its pixel ratio; src/lib/splash.ts lists the same.
SPLASH = [
    (440, 956, 3), (430, 932, 3), (428, 926, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3),
    (402, 874, 3), (393, 852, 3), (390, 844, 3), (375, 812, 3), (375, 667, 2), (320, 568, 2),
    (1032, 1376, 2), (1024, 1366, 2), (834, 1210, 2), (834, 1194, 2), (834, 1112, 2), (820, 1180, 2),
    (810, 1080, 2), (768, 1024, 2), (744, 1133, 2),
]
Path("public/splash").mkdir(parents=True, exist_ok=True)
for w, h, ratio in SPLASH:
    pw, ph = w * ratio, h * ratio
    screen = Image.new("RGBA", (pw, ph), WHITE)
    # Half a phone's width; a tablet keeps it to the same size in points.
    inner = fit(icon, min(pw * 0.5, 200 * ratio), ph)
    screen.alpha_composite(inner, ((pw - inner.width) // 2, (ph - inner.height) // 2))
    screen.convert("RGB").save(f"public/splash/splash-{pw}x{ph}.png", optimize=True)
print("Icons written.")
