"""
Builds the app logo and icons. Needs Python 3 with Pillow:

    python -m pip install pillow
    python scripts/make-icons.py                       # set the wordmark from type
    python scripts/make-icons.py docs/brand/we-are-dheeras.png   # use that artwork

With no argument the wordmark is set from type rather than drawn in a graphics
tool, so it is reproducible: edit the constants below and re-run. That needs a
bold grotesque (Arial Bold ships with Windows and macOS; Liberation Sans Bold is
the Linux stand-in).

Given a file, that artwork becomes the lockup instead, and the type-setting is
skipped. Supply it large and on white (or transparent) with the mark centred —
the white backing is dropped and the margins are measured from the ink, so any
whitespace around the edges of the file doesn't matter.

Either way the lockup is WE ARE over DHEERAS, in the chapter's two colours.
DHEERAS is set larger because it is the name; WE ARE is tracked out to the same
width so the two lines read as one block. docs/brand/ keeps the retired BNI
artwork, which nothing builds from any more.
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

RED = (206, 31, 46, 255)  # the BNI red carried over from the old mark
DARK = (101, 104, 109, 255)  # the dark the old DHEERAS was set in
WHITE, CLEAR = (255, 255, 255, 255), (0, 0, 0, 0)

TOP, BOTTOM = "WE ARE", "DHEERAS"
BOTTOM_SIZE = 400  # everything else is a fraction of this, so one number scales the lockup
TOP_RATIO = 0.55  # WE ARE is a little over half the height of the name
# Both lines are set tight: the chapter's mark has DHEERAS almost touching, with
# WE ARE only slightly opened up so the shorter line doesn't look cramped.
BOTTOM_TRACKING = 0.0  # of the font size
TOP_TRACKING = 0.03
GAP_RATIO = 0.16  # between the two lines, as a fraction of the DHEERAS cap height

# Black, not Bold: the mark is heavy, and at Bold the letters look underset
# beside the weight the chapter uses on its banners.
FONTS = [
    "ariblk.ttf",
    "Arial Black.ttf",
    "Archivo-Black.ttf",
    "LiberationSans-Bold.ttf",
    "DejaVuSans-Bold.ttf",
    "arialbd.ttf",
]


def load(size):
    for name in FONTS:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    raise SystemExit(f"No bold grotesque found. Install one of: {', '.join(FONTS)}")


def line(text, font, fill, tracking):
    """One line of letterspaced caps, trimmed to its ink."""
    widths = [font.getlength(c) for c in text]
    total = round(sum(widths) + tracking * (len(text) - 1))
    im = Image.new("RGBA", (total + 8, font.size * 2), CLEAR)
    draw = ImageDraw.Draw(im)
    x = 4.0
    for c, w in zip(text, widths):
        draw.text((x, font.size // 2), c, font=font, fill=fill)
        x += w + tracking
    return im.crop(im.getchannel("A").getbbox())


def wordmark():
    """
    WE ARE over DHEERAS, ranged left, on transparent — the lockup everything uses.

    Ranged left rather than centred, and each line set at its own natural width:
    WE ARE is the shorter line and is meant to look it, sitting over the start of
    the name the way it does on the chapter's banners. (It used to be tracked out
    until it spanned DHEERAS exactly, which made the two lines one grey block.)
    """
    bottom = line(BOTTOM, load(BOTTOM_SIZE), DARK, BOTTOM_SIZE * BOTTOM_TRACKING)
    top_size = round(BOTTOM_SIZE * TOP_RATIO)
    top = line(TOP, load(top_size), RED, top_size * TOP_TRACKING)
    gap = round(bottom.height * GAP_RATIO)

    im = Image.new("RGBA", (max(top.width, bottom.width), top.height + gap + bottom.height), CLEAR)
    im.alpha_composite(top, (0, 0))
    im.alpha_composite(bottom, (0, top.height + gap))
    return im


def artwork(path):
    """
    A lockup drawn elsewhere, read in place of the type-set one.

    The file is flattened onto white first, so artwork saved with transparency
    and artwork saved on a white card are read the same way. That white is the
    backing rather than part of the mark, so it is turned back into
    transparency: the lockup can then sit on any colour, and `square()` below
    measures its margins from the ink instead of from the file's edges.

    White is dropped on a short ramp rather than a hard cut, which keeps the
    soft edge of the letters. Anything printed in a near-white tint would go
    with it — this is a two-colour wordmark, so there is nothing up there.
    """
    source = Image.open(path).convert("RGBA")
    card = Image.new("RGBA", source.size, WHITE)
    card.alpha_composite(source)

    r, g, b, _ = card.split()
    # The lightest ink still reads as ink on every channel, so the darkest
    # channel is what says "something is here".
    darkest = ImageChops.darker(ImageChops.darker(r, g), b)
    alpha = darkest.point(lambda v: 255 if v <= 230 else 0 if v >= 247 else round(255 * (247 - v) / 17))
    card.putalpha(alpha)

    box = alpha.getbbox()
    if box is None:
        raise SystemExit(f"{path} looks blank — nothing but white in it.")
    return card.crop(box)


def fit(im, max_w, max_h):
    k = min(max_w / im.width, max_h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def square(im, size, frac, bg):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = fit(im, size * frac, size * frac)
    canvas.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return canvas


source = sys.argv[1] if len(sys.argv) > 1 else None
if source and not Path(source).is_file():
    raise SystemExit(f"No such file: {source}")
logo = artwork(source) if source else wordmark()
print(f"Lockup: {source}" if source else "Lockup: set from type")
# At 16px the two lines are a smudge, so the browser tab gets the chapter's
# initial on its own — the smallest thing that still reads as DHEERAS. It stays
# type-set even when the lockup comes from a file: cutting one letter back out
# of supplied artwork guesses where that letter ends.
mark = line("D", load(512), RED, 0)

Path("src/assets").mkdir(parents=True, exist_ok=True)
# Shown in the app (header, login, kiosk) by src/components/brand-logo.tsx.
fit(logo, 640, 640).quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
    "src/assets/bni-dheeras-logo.png", optimize=True
)
# Browser tab.
square(mark, 256, 0.88, CLEAR).save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
square(mark, 192, 0.84, CLEAR).save("src/app/icon.png", optimize=True)
# Home screen / installed app: on white, so iOS (which has no transparency)
# shows no black. A wide, short lockup is fitted by its width, so the fraction
# is generous — it leaves the deep margins above and below that the shape wants.
app = square(logo, 1024, 0.84, WHITE).convert("RGB")
app.resize((180, 180), Image.LANCZOS).save("src/app/apple-icon.png", optimize=True)
app.resize((192, 192), Image.LANCZOS).save("public/icons/app-192.png", optimize=True)
app.resize((512, 512), Image.LANCZOS).save("public/icons/app-512.png", optimize=True)
# Maskable: Android crops to circles and other shapes, so the artwork shrinks
# into the central safe zone — the 80%-wide circle, which this lockup's corners
# have to sit inside, not just its width.
square(logo, 512, 0.72, WHITE).convert("RGB").save("public/icons/app-maskable-512.png", optimize=True)
print("Icons written.")
