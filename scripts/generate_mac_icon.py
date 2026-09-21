#!/usr/bin/env python3
"""Derives FeedbackKitDemoMac's AppIcon.appiconset from the existing iOS app icon.

macOS (Big Sur+) always clips every app icon into its own consistent "squircle" shape in Finder/
the Dock, regardless of what shape the source image is -- but it does NOT scale content down for
you first. A full-bleed square source (correct for iOS, which masks nothing) reads as oversized
and cropped once macOS's own mask is applied on top of it. This script re-creates the source
artwork at the padding Apple's own macOS icon templates use (content sized to ~80% of a 1024
canvas, centered, itself pre-masked with an approximated squircle) so the icon looks correct
before AND after the OS's own masking.

Unlike iOS/watchOS, macOS has no "single 1024 image" shortcut in the asset catalog -- actool
silently leaves the icon "unassigned" if you try that. Finder/Dock/etc. each request a
specific bitmap resolution directly, so this writes the full discrete size set macOS actually
needs (16 up to 512, at 1x/2x) and a Contents.json that names every one of them explicitly.

Usage: python3 scripts/generate_mac_icon.py
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "DemoApp/DemoApp/Assets.xcassets/AppIcon.appiconset/icon-1024.png"
DEST_DIR = ROOT / "DemoApp/DemoMacApp/Assets.xcassets/AppIcon.appiconset"

CANVAS = 1024
# Apple's macOS Big Sur icon template: the masked "content" square is ~824pt within a 1024pt
# canvas (icon content, corner radius ~185pt at that size -- about 22.5% of the content side).
CONTENT = 824
CORNER_RADIUS = round(CONTENT * 0.225)
SUPERSAMPLE = 4  # anti-aliased mask: draw at 4x, then downsample

# (point size, scale) -> pixel size, for every slot a macOS AppIcon.appiconset needs.
SLOTS = [(pt, scale) for pt in (16, 32, 128, 256, 512) for scale in (1, 2)]


def rounded_rect_mask(size: int, radius: int, supersample: int) -> Image.Image:
    big = size * supersample
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius * supersample, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def build_master() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (CANVAS, CANVAS):
        source = source.resize((CANVAS, CANVAS), Image.LANCZOS)

    content = source.resize((CONTENT, CONTENT), Image.LANCZOS)
    mask = rounded_rect_mask(CONTENT, CORNER_RADIUS, SUPERSAMPLE)
    content.putalpha(mask)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = (CANVAS - CONTENT) // 2
    canvas.paste(content, (offset, offset), content)
    return canvas


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"source icon not found: {SOURCE}")

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    master = build_master()

    images = []
    for pt, scale in SLOTS:
        px = pt * scale
        filename = f"AppIcon-{pt}x{pt}@{scale}x.png"
        master.resize((px, px), Image.LANCZOS).save(DEST_DIR / filename)
        images.append({
            "filename": filename,
            "idiom": "mac",
            "scale": f"{scale}x",
            "size": f"{pt}x{pt}",
        })
        print(f"wrote {filename} ({px}x{px})")

    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    (DEST_DIR / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")
    print("wrote Contents.json")


if __name__ == "__main__":
    main()
