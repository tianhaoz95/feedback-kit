#!/usr/bin/env python3
"""Generates the official GitHub App logo for FeedbackKit in PNG and SVG formats.

GitHub App logos are displayed across GitHub at various sizes (from 16x16 up to 200x200+)
and masked as circles in issue timelines and comments.

This script creates:
- branding/github-app-logo.png (512x512, optimized for GitHub App avatar upload)
- branding/github-app-logo-1024.png (1024x1024 high-res master)
- branding/github-app-logo.svg (scalable vector source)

Design features:
- Deep neutral-950 backdrop with subtle vignette and contrast border for dark & light GitHub themes
- Centered speech bubble + exclamation mark brand geometry with safe circular padding
- Subtle ambient depth glow matching FeedbackKit's brand aesthetic
- 4x supersampling for flawless antialiasing
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BRANDING_DIR = ROOT / "branding"
BRANDING_DIR.mkdir(parents=True, exist_ok=True)


def draw_logo_image(size: int) -> Image.Image:
    scale = 4  # 4x supersampling
    W = size * scale
    H = size * scale

    # Base image
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background squircle / rounded rect with subtle gradient
    # Deep sleek background: #121316 to #0d0e11
    bg_radius = int(W * 0.22)  # modern squircle corner radius
    for y in range(H):
        t = y / H
        r = int(22 * (1 - t) + 14 * t)
        g = int(24 * (1 - t) + 15 * t)
        b = int(28 * (1 - t) + 18 * t)
        # Horizontal scanline
        draw.line([(0, y), (W, y)], fill=(r, g, b, 255))

    # Mask background into squircle with 1px inset
    bg_mask = Image.new("L", (W, H), 0)
    mask_draw = ImageDraw.Draw(bg_mask)
    margin = int(W * 0.02)
    mask_draw.rounded_rectangle(
        [margin, margin, W - margin, H - margin],
        radius=bg_radius,
        fill=255,
    )
    img.putalpha(bg_mask)

    # 2. Subtle ambient purple/blue glow behind mark
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    cx, cy = W // 2, int(H * 0.48)
    glow_r = int(W * 0.32)
    glow_draw.ellipse(
        [cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
        fill=(139, 92, 246, 38),  # subtle violet glow
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(40 * scale)))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # 3. Subtle inner border for contrast on GitHub dark theme
    border_draw = ImageDraw.Draw(img)
    border_draw.rounded_rectangle(
        [margin, margin, W - margin, H - margin],
        radius=bg_radius,
        outline=(255, 255, 255, 22),
        width=int(1.5 * scale),
    )

    # 4. Brand Mark Geometry
    # Base canonical coordinates in 512 space:
    # Bubble rect: x: 116, y: 120, width: 280, height: 220, rx: 60
    # Tail path: (176, 325) -> (150, 392) -> (226, 325)
    # Exclamation bar: (238, 160, width 36, height 92, rx 18)
    # Exclamation dot: center (256, 282), r 20

    s = W / 512.0

    # Draw tail
    tail_pts = [
        (176 * s, 320 * s),
        (150 * s, 392 * s),
        (226 * s, 320 * s),
    ]
    draw.polygon(tail_pts, fill=(255, 255, 255, 255))

    # Draw bubble body with rounded corners
    bx0 = 116 * s
    by0 = 120 * s
    bx1 = (116 + 280) * s
    by1 = (120 + 220) * s
    bradius = 60 * s
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=bradius, fill=(255, 255, 255, 255))

    # 5. Exclamation mark cut into the bubble (using deep background color #141518)
    cutout_color = (20, 21, 24, 255)

    # Bar
    bar_x0 = 238 * s
    bar_y0 = 160 * s
    bar_x1 = (238 + 36) * s
    bar_y1 = (160 + 92) * s
    bar_r = 18 * s
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=bar_r, fill=cutout_color)

    # Dot
    dot_cx = 256 * s
    dot_cy = 282 * s
    dot_r = 20 * s
    draw.ellipse(
        [dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r],
        fill=cutout_color,
    )

    # Downsample with high-quality Lanczos filter
    final_img = img.resize((size, size), Image.LANCZOS)
    return final_img


def generate_svg() -> str:
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#16181d"/>
      <stop offset="100%" stop-color="#0e0f12"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="48%" r="40%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background squircle with subtle border -->
  <rect x="10" y="10" width="492" height="492" rx="108" fill="url(#bgGrad)"/>
  <rect x="10" y="10" width="492" height="492" rx="108" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.08"/>

  <!-- Ambient glow -->
  <rect x="10" y="10" width="492" height="492" rx="108" fill="url(#glow)"/>

  <!-- Speech bubble with tail -->
  <path d="M 176 320 L 150 392 L 226 320 Z" fill="#ffffff"/>
  <rect x="116" y="120" width="280" height="220" rx="60" fill="#ffffff"/>

  <!-- Exclamation mark cut into the bubble -->
  <rect x="238" y="160" width="36" height="92" rx="18" fill="#141518"/>
  <circle cx="256" cy="282" r="20" fill="#141518"/>
</svg>
"""


def main():
    print("Generating GitHub App logo assets...")

    # 1. 512x512 PNG (Standard GitHub App avatar upload size)
    img_512 = draw_logo_image(512)
    path_512 = BRANDING_DIR / "github-app-logo.png"
    img_512.save(path_512, format="PNG", optimize=True)
    print(f"Saved: {path_512}")

    # 2. 1024x1024 PNG (Retina / High-res master)
    img_1024 = draw_logo_image(1024)
    path_1024 = BRANDING_DIR / "github-app-logo-1024.png"
    img_1024.save(path_1024, format="PNG", optimize=True)
    print(f"Saved: {path_1024}")

    # 3. Vector SVG
    svg_content = generate_svg()
    path_svg = BRANDING_DIR / "github-app-logo.svg"
    path_svg.write_text(svg_content, encoding="utf-8")
    print(f"Saved: {path_svg}")

    print("Done! All assets generated in ./branding/")


if __name__ == "__main__":
    main()
