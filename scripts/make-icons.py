"""
Builds the app logo and icons. The wordmark is set from type rather than drawn
in a graphics tool, so it is reproducible: edit the constants below and re-run.
Needs Python 3 with Pillow, and a bold grotesque (Arial Bold ships with Windows
and macOS; Liberation Sans Bold is the Linux stand-in):

    python -m pip install pillow
    python scripts/make-icons.py

The lockup is WE ARE over DHEERAS, in the chapter's two colours. DHEERAS is set
larger because it is the name; WE ARE is tracked out to the same width so the
two lines read as one block. docs/brand/ keeps the retired BNI artwork, which
nothing builds from any more.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RED = (206, 31, 46, 255)  # the BNI red carried over from the old mark
DARK = (101, 104, 109, 255)  # the dark the old DHEERAS was set in
WHITE, CLEAR = (255, 255, 255, 255), (0, 0, 0, 0)

TOP, BOTTOM = "WE ARE", "DHEERAS"
BOTTOM_SIZE = 400  # everything else is a fraction of this, so one number scales the lockup
TOP_RATIO = 0.56  # WE ARE is a little over half the height of the name
BOTTOM_TRACKING = 0.05  # of the font size; the old DHEERAS was letterspaced too
GAP_RATIO = 0.34  # between the two lines, as a fraction of the DHEERAS cap height

FONTS = ["arialbd.ttf", "Arial Bold.ttf", "LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"]


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
    """WE ARE over DHEERAS, centred, on transparent — the lockup everything uses."""
    bottom = line(BOTTOM, load(BOTTOM_SIZE), DARK, BOTTOM_SIZE * BOTTOM_TRACKING)
    # WE ARE is set smaller, then tracked out until it spans the name exactly.
    top_font = load(round(BOTTOM_SIZE * TOP_RATIO))
    natural = sum(top_font.getlength(c) for c in TOP)
    top = line(TOP, top_font, RED, (bottom.width - natural) / (len(TOP) - 1))
    gap = round(bottom.height * GAP_RATIO)

    im = Image.new("RGBA", (max(top.width, bottom.width), top.height + gap + bottom.height), CLEAR)
    im.alpha_composite(top, ((im.width - top.width) // 2, 0))
    im.alpha_composite(bottom, ((im.width - bottom.width) // 2, top.height + gap))
    return im


def fit(im, max_w, max_h):
    k = min(max_w / im.width, max_h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def square(im, size, frac, bg):
    canvas = Image.new("RGBA", (size, size), bg)
    inner = fit(im, size * frac, size * frac)
    canvas.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return canvas


logo = wordmark()
# At 16px the two lines are a smudge, so the browser tab gets the chapter's
# initial on its own — the smallest thing that still reads as DHEERAS.
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
